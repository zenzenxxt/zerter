
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Brain, Sparkles, Loader2, Lightbulb, ClipboardCopy, ClipboardCheck, HelpCircle as HelpCircleIcon, PlusCircle, AlertTriangle as AlertTriangleIcon } from 'lucide-react'; // Renamed AlertTriangle to AlertTriangleIcon
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GeneratedQuestionOption {
  id: string;
  text: string;
}
interface GeneratedQuestion {
  question: string;
  options: GeneratedQuestionOption[];
  answer: string; // ID of the correct option
}

interface QuestionGenerationInput {
  topic: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export function QuestionGenerator() {
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedStates, setCopiedStates] = useState<boolean[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rawApiOutput, setRawApiOutput] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGeneratedQuestions(null);
    setApiError(null);
    setRawApiOutput(null);

    const payload: QuestionGenerationInput = {
      topic,
      numQuestions: Number(numQuestions),
      difficulty,
    };

    try {
      const response = await fetch('/api/generate-questions-openrouter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text(); 

      if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}.`;
        let rawOutputForDisplay = null;
        try {
          const errorJson = JSON.parse(responseText);
          errorMsg = errorJson.error || errorMsg;
          if (errorJson.rawOutput) rawOutputForDisplay = errorJson.rawOutput;
        } catch (parseErr) {
          rawOutputForDisplay = responseText.substring(0, 500); 
          if (response.status === 504) {
            errorMsg = "The request to the AI timed out (504 Gateway Timeout). This can happen if the AI takes too long to generate questions. Try requesting fewer questions, a different model, or check your server's timeout limits. If this persists, the selected AI model might be too slow for your current setup.";
          }
        }
        setApiError(errorMsg);
        if (rawOutputForDisplay) setRawApiOutput(rawOutputForDisplay);
        toast({ title: 'Error Generating Questions', description: errorMsg, variant: 'destructive', duration: 15000 });
        setIsLoading(false);
        return; 
      }

      try {
        const questionsData = JSON.parse(responseText);
        if (Array.isArray(questionsData) && questionsData.every(q => q.question && Array.isArray(q.options) && q.answer)) {
          setGeneratedQuestions(questionsData as GeneratedQuestion[]);
          setCopiedStates(new Array(questionsData.length).fill(false));
          toast({ title: 'Success!', description: `${questionsData.length} questions generated.` });
        } else {
          const errorMsg = "Received unexpected data format from API (expected an array of questions with options and answer).";
          setApiError(errorMsg);
          setRawApiOutput(responseText);
          toast({ title: 'API Format Error', description: errorMsg, variant: 'destructive' });
        }
      } catch (parseError: any) {
        const errorMsg = "Failed to parse successful API response. Content was not valid JSON.";
        setApiError(errorMsg);
        setRawApiOutput(responseText);
        toast({ title: 'API Content Error', description: errorMsg, variant: 'destructive' });
      }

    } catch (error: any) { 
      console.error('Error generating questions (fetch or client-side):', error);
      const errorMsg = error.message || 'Failed to generate questions. Please check the console.';
      setApiError(errorMsg);
      toast({ title: 'Client Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = (question: GeneratedQuestion, index: number) => {
    let textToCopy = `Question: ${question.question}\n`;
    if (question.options && question.options.length > 0) {
      textToCopy += "Options:\n";
      question.options.forEach(opt => {
        textToCopy += `- ${opt.id}: ${opt.text}\n`;
      });
      const correctAnswerText = question.options.find(opt => opt.id === question.answer)?.text || 'N/A';
      textToCopy += `Correct Answer: ${question.answer} (${correctAnswerText})\n`;
    } else {
       textToCopy += `Answer: ${question.answer}\n`;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      const newCopiedStates = [...copiedStates];
      newCopiedStates[index] = true;
      setCopiedStates(newCopiedStates);
      toast({description: "Copied to clipboard!"});
      setTimeout(() => {
        const resetCopiedStates = [...newCopiedStates];
        resetCopiedStates[index] = false;
        setCopiedStates(resetCopiedStates);
      }, 2000);
    }).catch(err => {
      toast({description: "Failed to copy.", variant: "destructive"});
    });
  };


  return (
    <div className="card-3d w-full max-w-2xl mx-auto">
      <CardHeader className="p-6">
        <CardTitle className="flex items-center gap-2 text-2xl text-slate-700">
          <Brain className="h-7 w-7 text-blue-500" /> AI Question Assistant
        </CardTitle>
        <CardDescription className="text-slate-500">
          Generate exam questions quickly using AI. Just provide a topic, number of questions (max 10 for this standalone tool), and difficulty level. Questions will be multiple choice with 4 options.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="topic" className="flex items-center gap-1 text-slate-600"><Lightbulb className="h-4 w-4 text-blue-500/80"/>Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Photosynthesis, World War II, Python Data Types"
              required
              className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numQuestions" className="flex items-center gap-1 text-slate-600"><HelpCircleIcon className="h-4 w-4 text-blue-500/80"/>Number of Questions</Label>
              <Input
                id="numQuestions"
                type="number"
                value={numQuestions}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val, 10) < 1) {
                    setNumQuestions(1); 
                  } else {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) {
                      setNumQuestions(Math.min(parsed, 10)); // Max 10 for this page
                    }
                  }
                }}
                min="1"
                max="10" 
                required
                className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty" className="flex items-center gap-1 text-slate-600"><Sparkles className="h-4 w-4 text-blue-500/80"/>Difficulty Level</Label>
              <Select value={difficulty} onValueChange={(value) => setDifficulty(value as 'easy' | 'medium' | 'hard')}>
                <SelectTrigger id="difficulty" className="border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 shadow-xl">
                  <SelectItem value="easy" className="text-slate-700 hover:bg-slate-100">Easy</SelectItem>
                  <SelectItem value="medium" className="text-slate-700 hover:bg-slate-100">Medium</SelectItem>
                  <SelectItem value="hard" className="text-slate-700 hover:bg-slate-100">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-6 border-t border-slate-200">
          <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" /> Generate Questions
              </>
            )}
          </Button>
        </CardFooter>
      </form>
      
      {isLoading && (
        <div className="text-center text-slate-500 py-4 px-6">
            <Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>
            Thinking... AI is generating questions. This may take a minute or more, especially for many questions...
        </div>
      )}

      {apiError && (
        <div className="p-6 border-t border-slate-200">
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
            {rawApiOutput && (
                <div className="mt-2">
                    <p className="text-xs font-semibold">Raw Server Response Snippet:</p>
                    <pre className="mt-1 p-2 text-xs bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded whitespace-pre-wrap break-all max-h-40 overflow-auto">
                        {rawApiOutput}
                    </pre>
                </div>
            )}
          </Alert>
        </div>
      )}

      {generatedQuestions && generatedQuestions.length > 0 && !apiError && (
        <div className="p-6 border-t border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
            <Lightbulb className="h-5 w-5 text-yellow-500" /> Generated Questions ({generatedQuestions.length})
          </h3>
          <Accordion type="single" collapsible className="w-full">
            {generatedQuestions.map((q, index) => (
              <AccordionItem value={`item-${index}`} key={index} className="border-slate-200">
                <AccordionTrigger className="hover:no-underline text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-t-md data-[state=open]:bg-slate-100 text-sm">
                  <span className="text-left flex-1">Question {index + 1}: {q.question.substring(0,70)}{q.question.length > 70 ? '...' : ''}</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 bg-slate-50 p-4 text-sm">
                  <p className="font-medium text-slate-700"><strong>Full Question:</strong> {q.question}</p>
                  {q.options && q.options.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-600">Options:</p>
                      <ul className="list-disc list-inside pl-4 text-slate-500">
                        {q.options.map(opt => (
                          <li key={opt.id}>{opt.id}. {opt.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                   <p className="text-green-700">
                    <strong>Correct Answer:</strong> {q.answer}
                    {q.options && q.options.find(opt => opt.id === q.answer) ? ` (${q.options.find(opt => opt.id === q.answer)!.text})` : ''}
                  </p>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyToClipboard(q, index)}
                      className="border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      {copiedStates[index] ? <ClipboardCheck className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
                      {copiedStates[index] ? 'Copied!' : 'Copy Q&A'}
                    </Button>
                    <Button size="sm" disabled className="bg-blue-500 text-white opacity-50">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add to Exam (Soon)
                    </Button> 
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
       {!generatedQuestions && !isLoading && !apiError && (
         <Alert variant="default" className="m-6 border-blue-500/20 bg-blue-50 text-blue-700">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            <AlertTitle className="font-semibold text-blue-600">Get Started with AI</AlertTitle>
            <AlertDescription>
              Enter a topic and other details above, then click "Generate Questions" to see the AI in action!
            </AlertDescription>
          </Alert>
       )}
    </div>
  );
}
