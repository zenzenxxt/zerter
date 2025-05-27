
// src/app/api/generate-seb-token/route.ts
import { NextResponse, type NextRequest } from 'next/server';

// Simplified local helper for safe error message extraction for server-side logging
function getLocalSafeServerErrorMessage(e: any, defaultMessage = "An unknown server error occurred."): string {
  if (e && typeof e === 'object') {
    if (e.name === 'AbortError') {
      return "The request timed out. Please check your connection and try again.";
    }
    if (typeof e.message === 'string' && e.message.trim() !== '') {
      return e.message;
    }
    try {
      const strError = JSON.stringify(e);
      if (strError !== '{}' && strError.length > 2) return `Error object: ${strError}`;
    } catch (stringifyError) { /* Fall through */ }
  }
  if (e !== null && e !== undefined) {
    const stringifiedError = String(e);
    if (stringifiedError.trim() !== '' && stringifiedError !== '[object Object]') {
      return stringifiedError;
    }
  }
  return defaultMessage;
}


export async function POST(request: NextRequest) {
  const operationId = `[API GenerateSEBToken POST ${Date.now().toString().slice(-5)}]`;
  console.log(`${operationId} Handler invoked. Request URL: ${request.url}`); // Very first log

  let localJwt: any = null;
  let jwtModuleErrorMsg: string | null = null;
  let currentJwtSecretValue: string | undefined | null = null;

  try { 
    console.log(`${operationId} STEP 1: Attempting to load 'jsonwebtoken' module...`);
    try {
      localJwt = require('jsonwebtoken'); 
      if (typeof localJwt.sign !== 'function') {
        jwtModuleErrorMsg = 'jsonwebtoken module loaded but localJwt.sign is not a function. Module might be corrupted or not loaded correctly.';
        console.error(`${operationId} CRITICAL: ${jwtModuleErrorMsg}`);
      } else {
        console.log(`${operationId} jsonwebtoken module loaded successfully using require().`);
      }
    } catch (e: any) {
      const safeMessage = getLocalSafeServerErrorMessage(e, "Failed to initialize 'jsonwebtoken' module.");
      jwtModuleErrorMsg = `Failed to load 'jsonwebtoken' module at runtime: ${safeMessage}`;
      console.error(`${operationId} CRITICAL: ${jwtModuleErrorMsg}`, e);
    }

    if (jwtModuleErrorMsg) {
      console.error(`${operationId} Returning 500 due to JWT module error: ${jwtModuleErrorMsg}`);
      return NextResponse.json({ error: `Server configuration error: ${jwtModuleErrorMsg}` }, { status: 500 });
    }
    if (!localJwt) { 
        const noJwtLibError = "Server configuration error: JWT library critically failed to initialize after require attempt.";
        console.error(`${operationId} CRITICAL: ${noJwtLibError}`);
        return NextResponse.json({ error: noJwtLibError }, { status: 500 });
    }
    console.log(`${operationId} STEP 2: 'jsonwebtoken' module seems available.`);

    console.log(`${operationId} STEP 3: Checking JWT secret (NEXT_PUBLIC_JWT_SECRET)...`);
    currentJwtSecretValue = process.env.NEXT_PUBLIC_JWT_SECRET;
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`${operationId} JWT Secret Value Check (Dev Only): Is present? ${!!currentJwtSecretValue}, Type: ${typeof currentJwtSecretValue}, Length: ${currentJwtSecretValue?.length || 0}`);
    }

    if (!currentJwtSecretValue || typeof currentJwtSecretValue !== 'string' || currentJwtSecretValue.trim() === '') {
      const errorMsg = 'Server configuration error (JWT secret missing, empty, or not a string for generation). Ensure NEXT_PUBLIC_JWT_SECRET is set in the environment.';
      console.error(`${operationId} CRITICAL: NEXT_PUBLIC_JWT_SECRET is not configured, empty, or not a string.`);
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    console.log(`${operationId} NEXT_PUBLIC_JWT_SECRET is available (length: ${currentJwtSecretValue?.length || 0}).`);
    console.log(`${operationId} STEP 4: JWT secret check passed.`);


    let body;
    console.log(`${operationId} STEP 5: Attempting to parse request body...`);
    try {
      body = await request.json();
      console.log(`${operationId} Request body parsed successfully:`, body);
    } catch (parseError: any) {
      const errorMsg = getLocalSafeServerErrorMessage(parseError, "Failed to parse request body as JSON.");
      console.error(`${operationId} Error parsing request body: ${errorMsg}`, parseError);
      return NextResponse.json({ error: `Invalid request body: ${errorMsg}` }, { status: 400 });
    }
    console.log(`${operationId} STEP 6: Request body parsing passed.`);

    const { studentId, examId } = body;

    if (!studentId || !examId) {
      const errorMsg = "Missing studentId or examId in request body.";
      console.warn(`${operationId} ${errorMsg} Body:`, body);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    console.log(`${operationId} Extracted studentId: ${studentId}, examId: ${examId}`);
    console.log(`${operationId} STEP 7: Payload extraction passed.`);


    const payload = { studentId, examId, type: 'sebEntry' };
    let token;

    console.log(`${operationId} STEP 8: Attempting to sign JWT with payload:`, payload);
    try {
      token = localJwt.sign(payload, currentJwtSecretValue, { expiresIn: '1h' });
      console.log(`${operationId} JWT signed successfully. Token (first 20 chars): ${token ? token.substring(0,20) + "..." : "TOKEN_GENERATION_FAILED_OR_EMPTY"}`);
    } catch (signError: any) {
      const errorMsg = getLocalSafeServerErrorMessage(signError, "JWT signing process failed. Check JWT secret and payload.");
      console.error(`${operationId} Error during jwt.sign: ${errorMsg}`, signError);
      return NextResponse.json({ error: `Token generation failed internally: ${errorMsg}` }, { status: 500 });
    }
    console.log(`${operationId} STEP 9: JWT signing passed.`);

    console.log(`${operationId} Preparing to send 200 response with token.`);
    return NextResponse.json({ token }, { status: 200 });

  } catch (e: any) { 
    // This is the outermost catch block.
    // It should ideally only catch truly unexpected synchronous errors that weren't handled above.
    const errorType = typeof e;
    const isErrorObject = e instanceof Error;
    let errorMessageText = "A critical unhandled server error occurred in token generation API route.";
    
    if (isErrorObject) {
      errorMessageText = e.message || errorMessageText;
    } else if (typeof e === 'string' && e.trim() !== '') {
      errorMessageText = e;
    } else {
      try {
        const stringifiedError = JSON.stringify(e);
        if (stringifiedError !== '{}' && stringifiedError.length > 2) {
            errorMessageText = `Error object: ${stringifiedError}`;
        }
      } catch (stringifyError) { /* Fallback to default if stringify fails */ }
    }
    
    console.error(`${operationId} CRITICAL UNHANDLED EXCEPTION in POST handler: Type: ${errorType}, IsErrorInstance: ${isErrorObject}, Message: ${errorMessageText}. Full Error:`, e);
    
    // Attempt to return a JSON response even from this outermost catch
    try {
        return NextResponse.json({ error: `Critical server error during token generation (Operation ID: ${operationId}). Message: ${String(errorMessageText)}` }, { status: 500 });
    } catch (responseError: any) {
        console.error(`${operationId} FAILED TO SEND JSON RESPONSE even from outer catch:`, responseError.message, responseError);
        // Fallback to basic Response if NextResponse.json fails
        const bodyText = `{"error": "Critical server error (operation ID: ${operationId}) and failed to send standardized JSON response. Check server logs."}`;
        return new Response(bodyText, {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
  }
}

    