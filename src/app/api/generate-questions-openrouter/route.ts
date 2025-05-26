
import { NextResponse, type NextRequest } from 'next/server';

interface QuestionRequestPayload {
  topic: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface OpenRouterErrorDetail {
  message: string;
  type?: string;
  param?: string | null;
  code?: string | null;
}
interface OpenRouterErrorResponse {
  error: OpenRouterErrorDetail | string;
}

interface OpenRouterSuccessResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
}

export const AI_RESPONSE_PARSE_FAILURE_KEY = "AI_RESPONSE_PARSE_FAILURE";
const MAX_API_KEYS = 7;

async function makeOpenRouterRequest(
  apiKey: string,
  payload: any,
  operationId: string
): Promise<{ response: Response; responseBodyText: string }> {
  console.log(`${operationId} Attempting request with API key ending in ...${apiKey.slice(-4)}`);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseBodyText = await response.text();
  return { response, responseBodyText };
}

export async function POST(request: NextRequest) {
  const operationId = `[API /generate-questions-openrouter POST ${Date.now().toString().slice(-5)}]`;
  console.log(`${operationId} Request received.`);

  const apiKeys: string[] = [];
  for (let i = 1; i <= MAX_API_KEYS; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) {
      apiKeys.push(key);
    }
  }
  // Fallback to the single OPENROUTER_API_KEY if no numbered keys are found
  if (apiKeys.length === 0 && process.env.OPENROUTER_API_KEY) {
    apiKeys.push(process.env.OPENROUTER_API_KEY);
  }


  if (apiKeys.length === 0) {
    console.error(`${operationId} CRITICAL: No OpenRouter API keys configured (OPENROUTER_API_KEY or OPENROUTER_API_KEY_1..7) in .env`);
    return NextResponse.json({ error: 'OpenRouter API key(s) are not configured on the server.' }, { status: 500 });
  }
  console.log(`${operationId} Loaded ${apiKeys.length} API key(s).`);

  let body: QuestionRequestPayload;
  try {
    body = (await request.json()) as QuestionRequestPayload;
  } catch (e) {
    console.error(`${operationId} Invalid JSON payload:`, e);
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { topic, numQuestions, difficulty } = body;

  if (!topic || !numQuestions || !difficulty) {
    console.warn(`${operationId} Missing required parameters: topic, numQuestions, or difficulty.`);
    return NextResponse.json({ error: 'Missing required parameters: topic, numQuestions, difficulty.' }, { status: 400 });
  }

  const promptContent = `Generate ${numQuestions} exam questions about the topic "${topic}" with ${difficulty} difficulty.
  Each question should be multiple-choice with 4 options.
  Your response MUST be a valid JSON array of objects. Each object in the array must have the following structure:
  {
    "question": "The full text of the question",
    "options": [
      { "id": "A", "text": "Option A text" },
      { "id": "B", "text": "Option B text" },
      { "id": "C", "text": "Option C text" },
      { "id": "D", "text": "Option D text" }
    ],
    "answer": "The ID of the correct option (e.g., 'A', 'B', 'C', or 'D')"
  }
  Ensure the entire output is ONLY this JSON array and nothing else. Do not include any introductory text, explanations, or markdown formatting like \`\`\`json.`;

  const openRouterPayload = {
    model: 'mistralai/mistral-small-3.1-24b-instruct:free',
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant that helps teachers generate exam questions. Your output MUST be a valid JSON array of objects, where each object represents a question with 'question' (string), 'options' (array of objects with 'id' and 'text'), and 'answer' (string - the ID of the correct option) fields. Do not include any markdown formatting like \`\`\`json or explanations.`,
      },
      {
        role: 'user',
        content: promptContent,
      },
    ],
  };

  let lastError: { message: string; status: number; rawOutput?: string } | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const currentApiKey = apiKeys[i];
    console.log(`${operationId} Attempting API call with key #${i + 1}`);
    try {
      const { response, responseBodyText } = await makeOpenRouterRequest(currentApiKey, openRouterPayload, operationId);

      if (response.ok) {
        const responseData = JSON.parse(responseBodyText) as OpenRouterSuccessResponse;
        const messageContent = responseData.choices?.[0]?.message?.content;

        if (!messageContent) {
          console.error(`${operationId} No content received from OpenRouter model in successful response. Data:`, responseData);
          lastError = { message: 'No content received from OpenRouter model.', status: 500 };
          // This is not a rate limit, might be an issue with the model or request, probably stop.
          return NextResponse.json({ error: lastError.message }, { status: lastError.status });
        }

        let jsonStringToParse = messageContent;
        try {
          const arrayStartIndex = messageContent.indexOf('[');
          const arrayEndIndex = messageContent.lastIndexOf(']');
          if (arrayStartIndex !== -1 && arrayEndIndex !== -1 && arrayEndIndex > arrayStartIndex) {
            jsonStringToParse = messageContent.substring(arrayStartIndex, arrayEndIndex + 1);
          } else {
            const objectStartIndex = messageContent.indexOf('{');
            const objectEndIndex = messageContent.lastIndexOf('}');
            if (objectStartIndex !== -1 && objectEndIndex !== -1 && objectEndIndex > objectStartIndex) {
              jsonStringToParse = messageContent.substring(objectStartIndex, objectEndIndex + 1);
            }
          }
          
          const questions = JSON.parse(jsonStringToParse);

          if (!Array.isArray(questions) || !questions.every(q => q.question && Array.isArray(q.options) && q.answer)) {
            console.error(`${operationId} Parsed content is not in the expected JSON array format, even after attempting extraction. Parsed String:`, jsonStringToParse.substring(0,300), 'Original Content:', messageContent.substring(0,300));
            // If parsing fails, this specific key might not be the issue, but the model's output with the current prompt.
            // We treat this as a fatal error for this request attempt.
            return NextResponse.json({ errorKey: AI_RESPONSE_PARSE_FAILURE_KEY, error: 'AI response, after potential extraction, was not a valid question array.', rawOutput: messageContent }, { status: 500 });
          }
          console.log(`${operationId} Successfully generated and parsed ${questions.length} questions with key #${i + 1}.`);
          return NextResponse.json(questions, { status: 200 });
        } catch (parseError) {
          console.error(`${operationId} Failed to parse OpenRouter response content as JSON even after extraction attempts with key #${i+1}:`, parseError, "\nAttempted to parse string:", jsonStringToParse.substring(0,300), "\nOriginal content from model:", messageContent.substring(0,300));
          // This is a fatal error for this request.
          return NextResponse.json({ errorKey: AI_RESPONSE_PARSE_FAILURE_KEY, error: 'Failed to parse AI response as JSON. The model might have included non-JSON text or the structure was invalid.', rawOutput: messageContent }, { status: 500 });
        }
      } else if (response.status === 429) {
        let errorBodyJson: OpenRouterErrorResponse | null = null;
        try {
          errorBodyJson = JSON.parse(responseBodyText);
        } catch (e) { /* Ignore if not JSON */ }

        const errorMessage = (errorBodyJson?.error && typeof errorBodyJson.error === 'object' ? errorBodyJson.error.message : typeof errorBodyJson?.error === 'string' ? errorBodyJson.error : responseBodyText) || "Rate limit hit";
        
        console.warn(`${operationId} Rate limit exceeded for key #${i + 1}. Error: ${errorMessage.substring(0,100)}`);
        lastError = { message: errorMessage, status: 429, rawOutput: responseBodyText.substring(0, 500) };
        if (errorMessage.toLowerCase().includes("rate limit exceeded")) {
          if (i < apiKeys.length - 1) {
            console.log(`${operationId} Trying next API key...`);
            continue; // Try next key
          } else {
            console.warn(`${operationId} All API keys rate-limited.`);
            lastError.message = "All available API keys are rate-limited. Please try again later or add more credits to your OpenRouter account.";
            return NextResponse.json({ error: lastError.message, rawOutput: lastError.rawOutput }, { status: lastError.status });
          }
        } else {
          // If 429 but not a message we recognize as a standard rate limit, treat as fatal for this request.
          console.error(`${operationId} Received 429 for key #${i+1} but message doesn't seem to be a standard rate limit: ${errorMessage}`);
          lastError = { message: `OpenRouter API Error (429): ${errorMessage}`, status: 429, rawOutput: responseBodyText.substring(0, 500) };
          return NextResponse.json({ error: lastError.message, rawOutput: lastError.rawOutput }, { status: lastError.status });
        }
      } else {
        // Handle other non-OK responses
        let errorBodyTextForClient = `OpenRouter API request failed with status ${response.status}.`;
        try {
            const errorBodyJson = JSON.parse(responseBodyText) as OpenRouterErrorResponse;
            if (errorBodyJson.error) {
              if (typeof errorBodyJson.error === 'string') errorBodyTextForClient = errorBodyJson.error;
              else if (typeof errorBodyJson.error.message === 'string' && errorBodyJson.error.message.trim() !== '') errorBodyTextForClient = errorBodyJson.error.message;
            }
        } catch (jsonParseError) {
            errorBodyTextForClient += ` Response: ${responseBodyText.substring(0,100)}${responseBodyText.length > 100 ? "..." : ""}`;
        }
        console.error(`${operationId} OpenRouter API Error for key #${i+1}. Status: ${response.status}. Message: ${errorBodyTextForClient}. Raw: ${responseBodyText.substring(0,300)}`);
        // This is considered a fatal error for the current request, don't try other keys for general API errors.
        return NextResponse.json({ error: errorBodyTextForClient, rawOutput: responseBodyText.substring(0, 500), status: response.status }, { status: response.status });
      }
    } catch (fetchError: any) {
      console.error(`${operationId} Network or unexpected error during fetch with key #${i + 1}:`, fetchError);
      lastError = { message: `Network error or unexpected issue: ${fetchError.message || 'Unknown fetch error'}`, status: 500 };
      // If one key fails due to network, others might too, but we could try. For now, let's assume it's potentially transient.
      // If this is the last key, or to be safer, we can return this error.
      if (i === apiKeys.length - 1) {
        return NextResponse.json({ error: lastError.message }, { status: lastError.status });
      }
      console.log(`${operationId} Trying next API key due to fetch error...`);
    }
  }

  // If loop finishes and lastError is set (meaning all keys failed, likely with rate limits)
  if (lastError) {
    console.error(`${operationId} All API key attempts failed. Last error:`, lastError);
    return NextResponse.json({ error: lastError.message, rawOutput: lastError.rawOutput }, { status: lastError.status });
  }

  // Should not be reached if keys are available and logic is correct
  console.error(`${operationId} Fallthrough: No API keys successfully processed and no definitive error returned.`);
  return NextResponse.json({ error: 'Failed to generate questions after trying all available methods.' }, { status: 500 });
}
