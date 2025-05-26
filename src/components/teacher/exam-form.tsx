'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Trash2, Brain, Save, FileText, Settings2, CalendarDays, Clock, CheckCircle, Loader2, CalendarIcon, AlertTriangle as AlertTriangleIconLucide, ListChecks, Edit, Sparkles, Lightbulb, HelpCircle as HelpCircleIcon, Users, Percent, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import type { Question, QuestionOption, ExamStatus } from '@/types/supabase';
import { format, parseISO, isValid as isValidDate, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_RESPONSE_PARSE_FAILURE_KEY } from '@/app/api/generate-questions-openrouter/route';


export interface ExamFormData {
  title: string;
  description: string;
  duration: number;
  allowBacktracking: boolean;
  enable_webcam_proctoring: boolean;
  questions: Question[];
  startTime: Date | null;
  endTime: Date | null;
  status: ExamStatus;
  exam_id?: string;
  exam_code?: string;
  defaultMarksPerQuestion?: number;
}

interface AiGeneratedQuestion {
  question: string;
  options: { id: string; text: string }[];
  answer: string; // ID of the correct option
}

interface ExamFormProps {
  initialData?: ExamFormData | null;
  onSave: (data: ExamFormData) => Promise<{ success: boolean; error?: string; examId?: string }>;
  isEditing?: boolean;
}

const AI_QUESTION_BATCH_SIZE = 5; // Default small batch size if needed, not directly used by new logic
const MAX_AI_REQUEST_RETRIES = 2; // Max retries for a single request or a batch if parsing fails
const SINGLE_REQUEST_THRESHOLD = 20; // If <= this, make a single API call
const FALLBACK_BATCH_SIZE = 15; // If single large call fails, use this batch size

export function ExamForm({ initialData, onSave, isEditing = false }: ExamFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [defaultMarksPerQuestion, setDefaultMarksPerQuestion] = useState(1);
  const [currentQuestionMarks, setCurrentQuestionMarks] = useState<number>(defaultMarksPerQuestion);
  const [allowBacktracking, setAllowBacktracking] = useState(true);
  const [enableWebcamProctoring, setEnableWebcamProctoring] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("17:00");
  const [questions, setQuestions] = useState<Question[]>([]);

  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<QuestionOption[]>(
    Array.from({ length: 4 }, (_, i) => ({ id: `opt-new-${i}-${Date.now()}`, text: '' }))
  );
  const [currentCorrectOptionId, setCurrentCorrectOptionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiNumQuestions, setAiNumQuestions] = useState<number>(10); // Default for dialog input
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiDefaultMarks, setAiDefaultMarks] = useState<number>(defaultMarksPerQuestion);
  const [aiIsGenerating, setAiIsGenerating] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<AiGeneratedQuestion[]>([]);
  const [aiSelectedIndices, setAiSelectedIndices] = useState<number[]>([]);
  const [aiApiError, setAiApiError] = useState<string | null>(null);
  const [aiRawOutput, setAiRawOutput] = useState<string | null>(null);
  const [copiedStates, setCopiedStates] = useState<boolean[]>([]);

  const [aiBatchProgressMessage, setAiBatchProgressMessage] = useState<string>('');
  const [totalAiQuestionsRequested, setTotalAiQuestionsRequested] = useState<number>(0);
  const [currentAiQuestionsGenerated, setCurrentAiQuestionsGenerated] = useState<number>(0);


  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setDuration(initialData.duration || 60);
      const initialDefaultMarks = initialData.defaultMarksPerQuestion || 1;
      setDefaultMarksPerQuestion(initialDefaultMarks);
      setCurrentQuestionMarks(initialDefaultMarks);
      setAllowBacktracking(initialData.allowBacktracking !== undefined ? initialData.allowBacktracking : true);
      setEnableWebcamProctoring(initialData.enable_webcam_proctoring ?? false);
      setQuestions(initialData.questions || []);

      const initialStartTimeObj = initialData.startTime ? (typeof initialData.startTime === 'string' ? parseISO(initialData.startTime) : initialData.startTime) : null;
      const initialEndTimeObj = initialData.endTime ? (typeof initialData.endTime === 'string' ? parseISO(initialData.endTime) : initialData.endTime) : null;

      if (initialStartTimeObj && isValidDate(initialStartTimeObj)) {
        setStartTime(initialStartTimeObj);
        setStartTimeStr(format(initialStartTimeObj, "HH:mm"));
      } else {
        setStartTime(null); setStartTimeStr("09:00");
      }
      if (initialEndTimeObj && isValidDate(initialEndTimeObj)) {
        setEndTime(initialEndTimeObj);
        setEndTimeStr(format(initialEndTimeObj, "HH:mm"));
      } else {
        setEndTime(null); setEndTimeStr("17:00");
      }
    } else {
        setDefaultMarksPerQuestion(1);
        setCurrentQuestionMarks(1);
        setEnableWebcamProctoring(false);
        setAllowBacktracking(true);
        setTitle('');
        setDescription('');
        setDuration(60);
        setQuestions([]);
        setStartTime(null);
        setEndTime(null);
        setStartTimeStr("09:00");
        setEndTimeStr("17:00");
    }
  }, [initialData]);

  useEffect(() => {
    setCurrentQuestionMarks(defaultMarksPerQuestion);
    setAiDefaultMarks(defaultMarksPerQuestion);
  }, [defaultMarksPerQuestion]);

  const handleDateTimeChange = (date: Date | undefined, type: 'start' | 'end', timeStr: string) => {
    if (!date) {
      if (type === 'start') setStartTime(null); else setEndTime(null); return;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    let newDateTime = setMilliseconds(setSeconds(setMinutes(setHours(new Date(date), hours), minutes), 0), 0);
    if (type === 'start') {
      setStartTime(newDateTime);
      if (endTime && newDateTime >= endTime) {
        setEndTime(null); setEndTimeStr(format(new Date(newDateTime.getTime() + 60 * 60 * 1000), "HH:mm"));
        toast({ title: "Time Adjusted", description: "End time was adjusted as it was before the new start time.", variant: "default" });
      }
    } else setEndTime(newDateTime);
  };

  const handleTimeChange = (timeValue: string, type: 'start' | 'end') => {
    let targetDate = type === 'start' ? startTime : endTime;
    if (!targetDate) targetDate = new Date();
    if (type === 'start') setStartTimeStr(timeValue); else setEndTimeStr(timeValue);
    handleDateTimeChange(new Date(targetDate), type, timeValue);
  };

  const resetOptionIdsAndText = (): QuestionOption[] => Array.from({ length: 4 }, (_, i) => ({ id: `opt-new-${i}-${Date.now() + i}`, text: '' }));
  const generateOptionId = (prefix = 'opt-gen') => `${prefix}-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;

  const handleAddQuestion = useCallback(() => {
    if (!currentQuestionText.trim()) { toast({ title: "Incomplete Question", description: "Please fill in the question text.", variant: "destructive" }); return; }
    const filledOptions = currentOptions.filter(opt => opt.text.trim() !== '');
    if (filledOptions.length < 2) { toast({ title: "Not Enough Options", description: "Please provide at least two options.", variant: "destructive" }); return; }
    const isCorrectOptionAmongFilled = filledOptions.some(opt => opt.id === currentCorrectOptionId);
    if (!currentCorrectOptionId || !isCorrectOptionAmongFilled) { toast({ title: "No Correct Answer", description: "Please select a valid correct answer from the provided options.", variant: "destructive" }); return; }
    if (currentQuestionMarks <= 0) { toast({ title: "Invalid Marks", description: "Marks for the question must be greater than 0.", variant: "destructive" }); return; }


    const newOptionsWithUniqueIds = filledOptions.map(opt => ({ ...opt, id: generateOptionId() }));
    const originalCorrectOptionObject = filledOptions.find(opt => opt.id === currentCorrectOptionId);
    const originalCorrectOptionText = originalCorrectOptionObject?.text;
    const newCorrectOptionInArray = newOptionsWithUniqueIds.find(opt => opt.text === originalCorrectOptionText);
    const finalCorrectOptionId = newCorrectOptionInArray ? newCorrectOptionInArray.id : '';

    if (!finalCorrectOptionId) {
      toast({ title: "Error Adding Question", description: "Could not map correct option. Please try again.", variant: "destructive" });
      return;
    }

    const newQuestion: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: currentQuestionText,
      options: newOptionsWithUniqueIds,
      correctOptionId: finalCorrectOptionId,
      marks: currentQuestionMarks,
    };

    setQuestions(prevQuestions => [...prevQuestions, newQuestion]);
    setCurrentQuestionText(''); setCurrentOptions(resetOptionIdsAndText()); setCurrentCorrectOptionId('');
    setCurrentQuestionMarks(defaultMarksPerQuestion);
    toast({ description: "Question added to list below." });
  }, [currentQuestionText, currentOptions, currentCorrectOptionId, currentQuestionMarks, defaultMarksPerQuestion, toast]);

  const handleRemoveQuestion = useCallback((id: string) => {
    setQuestions(prevQuestions => prevQuestions.filter(q => q.id !== id));
    toast({ description: "Question removed." });
  }, [toast]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setCurrentOptions(prevOptions => {
      const newOptions = [...prevOptions]; newOptions[index] = { ...newOptions[index], text: value }; return newOptions;
    });
  }, []);

  const fetchAiQuestionsBatch = async (numToFetch: number, attempt: number): Promise<AiGeneratedQuestion[] | null> => {
    const payload = { topic: aiTopic, numQuestions: numToFetch, difficulty: aiDifficulty };
    setAiBatchProgressMessage(
      `Generating ${numToFetch} questions... ${attempt > 1 ? `(Attempt ${attempt}/${MAX_AI_REQUEST_RETRIES + 1})` : ''}`
    );
    try {
      const response = await fetch('/api/generate-questions-openrouter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let apiErrorMsg = `API request failed: ${response.status}`;
      let rawOutputForDisplay: string | null = responseText.substring(0, 500);
      let errorKey: string | undefined = undefined;

      if (!response.ok) {
        try {
          const errorJson = JSON.parse(responseText);
          apiErrorMsg = errorJson.error || apiErrorMsg;
          if (errorJson.rawOutput) rawOutputForDisplay = errorJson.rawOutput;
          if (errorJson.errorKey) errorKey = errorJson.errorKey;
        } catch (e) {
          if (response.status === 504) {
            apiErrorMsg = `Request for ${numToFetch} questions timed out (504).`;
            errorKey = '504_TIMEOUT'; // Custom key for timeout
          }
        }
        throw { message: apiErrorMsg, rawOutput: rawOutputForDisplay, errorKey, status: response.status };
      }
      const batchData = JSON.parse(responseText);
      if (Array.isArray(batchData)) return batchData;
      
      throw { message: "AI returned unexpected data format.", rawOutput: responseText, errorKey: AI_RESPONSE_PARSE_FAILURE_KEY };

    } catch (error: any) {
      throw error; // Re-throw the structured error
    }
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) { toast({ title: "Topic Missing", description: "Please enter a topic.", variant: "destructive" }); return; }
    if (aiDefaultMarks <= 0) { toast({ title: "Invalid Marks", description: "Marks for AI questions must be > 0.", variant: "destructive" }); return; }

    setAiIsGenerating(true); setAiGeneratedQuestions([]); setAiSelectedIndices([]);
    setAiApiError(null); setAiRawOutput(null);
    setTotalAiQuestionsRequested(aiNumQuestions); setCurrentAiQuestionsGenerated(0);
    setAiBatchProgressMessage('');

    let accumulatedQuestions: AiGeneratedQuestion[] = [];
    let mainRequestSucceeded = false;

    if (aiNumQuestions <= SINGLE_REQUEST_THRESHOLD) {
      // Strategy 1: Single request for small amounts
      setAiBatchProgressMessage(`Attempting to generate all ${aiNumQuestions} questions at once...`);
      for (let attempt = 1; attempt <= MAX_AI_REQUEST_RETRIES + 1; attempt++) {
        try {
          const questionsData = await fetchAiQuestionsBatch(aiNumQuestions, attempt);
          if (questionsData) {
            accumulatedQuestions = questionsData;
            mainRequestSucceeded = true;
            break; // Success
          }
        } catch (error: any) {
          if (error.errorKey === AI_RESPONSE_PARSE_FAILURE_KEY && attempt <= MAX_AI_REQUEST_RETRIES) {
            toast({ title: `AI Response Parse Error (Attempt ${attempt})`, description: `${error.message}. Retrying...`, variant: 'default', duration: 4000 });
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          setAiApiError(error.message); setAiRawOutput(error.rawOutput || null);
          toast({ title: `Error Generating Questions`, description: error.message, variant: 'destructive', duration: 10000 });
          break; // Unrecoverable error for this strategy or retries exhausted
        }
      }
    } else {
      // Strategy 2: Large request, fallback to batching
      setAiBatchProgressMessage(`Attempting to generate all ${aiNumQuestions} questions at once...`);
      let initialLargeRequestFailedDueToRecoverableError = false;
      try {
        const questionsData = await fetchAiQuestionsBatch(aiNumQuestions, 1);
        if (questionsData) {
          accumulatedQuestions = questionsData;
          mainRequestSucceeded = true;
        }
      } catch (error: any) {
        if (error.status === 504 || error.errorKey === AI_RESPONSE_PARSE_FAILURE_KEY) {
          toast({ title: "Large Request Issue", description: `${error.message}. Falling back to smaller batches.`, variant: "default", duration: 5000 });
          initialLargeRequestFailedDueToRecoverableError = true;
        } else {
          setAiApiError(error.message); setAiRawOutput(error.rawOutput || null);
          toast({ title: `Error Generating Questions`, description: error.message, variant: 'destructive', duration: 10000 });
        }
      }

      if (!mainRequestSucceeded && initialLargeRequestFailedDueToRecoverableError) {
        // Fallback to batching
        const totalBatches = Math.ceil(aiNumQuestions / FALLBACK_BATCH_SIZE);
        for (let i = 0; i < totalBatches; i++) {
          const numInThisBatch = Math.min(FALLBACK_BATCH_SIZE, aiNumQuestions - accumulatedQuestions.length);
          if (numInThisBatch <= 0) break;

          setAiBatchProgressMessage(
            `Generating batch ${i + 1} of ${totalBatches} (${numInThisBatch} questions)...`
          );
          let batchSuccess = false;
          for (let attempt = 1; attempt <= MAX_AI_REQUEST_RETRIES + 1; attempt++) {
            try {
              const batchData = await fetchAiQuestionsBatch(numInThisBatch, attempt);
              if (batchData) {
                accumulatedQuestions.push(...batchData);
                setCurrentAiQuestionsGenerated(accumulatedQuestions.length);
                batchSuccess = true;
                break; // Batch successful
              }
            } catch (error: any) {
              if (error.errorKey === AI_RESPONSE_PARSE_FAILURE_KEY && attempt <= MAX_AI_REQUEST_RETRIES) {
                toast({ title: `Parse Error (Batch ${i+1}, Attempt ${attempt})`, description: `${error.message}. Retrying batch...`, variant: 'default', duration: 4000 });
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
              }
              setAiApiError(error.message); setAiRawOutput(error.rawOutput || null);
              toast({ title: `Error in Batch ${i + 1}`, description: error.message, variant: 'destructive', duration: 10000 });
              break; // Unrecoverable error for this batch or retries exhausted
            }
          }
          if (!batchSuccess) break; // Stop if a batch ultimately fails
        }
      }
    }

    setAiGeneratedQuestions(accumulatedQuestions);
    setCurrentAiQuestionsGenerated(accumulatedQuestions.length);
    if (accumulatedQuestions.length > 0) {
        setCopiedStates(new Array(accumulatedQuestions.length).fill(false));
        toast({ description: `Generated ${accumulatedQuestions.length} questions.` });
    } else if (!aiApiError) {
        toast({ title: "No Questions Generated", description: "The AI did not return any questions for your request.", variant: "default" });
    }
    setAiIsGenerating(false); setAiBatchProgressMessage('');
  };


  const handleAiQuestionSelection = (index: number, checked: boolean) => {
    setAiSelectedIndices(prev => checked ? [...prev, index] : prev.filter(i => i !== index));
  };

  const handleSelectAllAiQuestions = (checked: boolean) => {
    if (checked) setAiSelectedIndices(aiGeneratedQuestions.map((_, i) => i));
    else setAiSelectedIndices([]);
  };

  const addSelectedAiQuestionsToExam = () => {
    const selectedQuestionsFromAI = aiSelectedIndices.map(index => aiGeneratedQuestions[index]);
    const newExamQuestions: Question[] = selectedQuestionsFromAI.map(aiQ => {
      const mappedOptions: QuestionOption[] = aiQ.options.map(aiOpt => ({
        id: generateOptionId('ai-opt'),
        text: aiOpt.text,
      }));
      const aiCorrectOptionObject = aiQ.options.find(opt => opt.id === aiQ.answer);
      let finalCorrectOptionId = '';
      if (aiCorrectOptionObject) {
        const correspondingMappedOption = mappedOptions.find(mo => mo.text === aiCorrectOptionObject.text);
        if (correspondingMappedOption) finalCorrectOptionId = correspondingMappedOption.id;
      }
      if (!finalCorrectOptionId && mappedOptions.length > 0) finalCorrectOptionId = mappedOptions[0].id;

      return {
        id: generateOptionId('ai-q'),
        text: aiQ.question,
        options: mappedOptions,
        correctOptionId: finalCorrectOptionId,
        marks: aiDefaultMarks > 0 ? aiDefaultMarks : 1,
      };
    });
    setQuestions(prev => [...prev, ...newExamQuestions]);
    toast({ description: `${newExamQuestions.length} AI questions added to the exam.` });
    setShowAiDialog(false);
    setAiGeneratedQuestions([]); setAiSelectedIndices([]); setAiTopic(''); setAiNumQuestions(10); setAiApiError(null); setAiRawOutput(null);
    setAiDefaultMarks(defaultMarksPerQuestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "Missing Title", description: "Exam title is required.", variant: "destructive" }); return; }
    if (duration <= 0) { toast({ title: "Invalid Duration", description: "Duration must be greater than 0 minutes.", variant: "destructive" }); return; }
    if (defaultMarksPerQuestion <= 0) { toast({ title: "Invalid Default Marks", description: "Default marks per question must be greater than 0.", variant: "destructive"}); return;}
    if (!startTime || !endTime) { toast({ title: "Scheduling Required", description: "Published exams must have both a start and end time.", variant: "destructive" }); return; }
    if (startTime >= endTime) { toast({ title: "Invalid Dates", description: "Start time must be before end time.", variant: "destructive" }); return; }
    if (questions.length === 0) { toast({ title: "No Questions", description: "Please add at least one question to the exam.", variant: "destructive" }); return; }
    setIsLoading(true);
    const examFormData: ExamFormData = {
        exam_id: initialData?.exam_id,
        title, description, duration,
        defaultMarksPerQuestion,
        allowBacktracking,
        enable_webcam_proctoring: enableWebcamProctoring,
        questions,
        startTime, endTime, status: 'Published',
        exam_code: initialData?.exam_code
    };
    const result = await onSave(examFormData);
    if (result.success && result.examId) {
      toast({ title: "Success!", description: `Exam ${isEditing ? 'updated' : 'created'} successfully.` });
      router.push(`/teacher/dashboard/exams/${result.examId}/details`);
    } else {
      toast({ title: "Error", description: result.error || `Failed to ${isEditing ? 'update' : 'create'} exam.`, variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="card-3d w-full">
        <CardHeader className="p-6">
          <CardTitle className="text-2xl flex items-center gap-2 text-slate-700">
            {isEditing ? <Edit className="h-6 w-6 text-blue-500" strokeWidth={1.5} /> : <PlusCircle className="h-6 w-6 text-blue-500" strokeWidth={1.5} />}
            {isEditing ? `Edit Exam: ${initialData?.title || ''}` : 'Create New Exam'}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {isEditing ? 'Modify the details of your existing exam.' : 'Fill in the details to create a new exam. All exams created/edited here will be "Published".'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <section className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><FileText className="h-5 w-5 text-blue-500" strokeWidth={1.5} /> Basic Information</h3>
            <div className="space-y-2">
              <Label htmlFor="examTitle" className="text-slate-600">Exam Title</Label>
              <Input id="examTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Final Year Mathematics" required className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="examDescription" className="text-slate-600">Description (Optional)</Label>
              <Textarea id="examDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief overview of the exam content and instructions." className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
            </div>
          </section>

          <section className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><Settings2 className="h-5 w-5 text-blue-500" strokeWidth={1.5} /> Exam Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="examDuration" className="flex items-center gap-1 text-slate-600"><Clock className="h-4 w-4" strokeWidth={1.5} /> Duration (minutes)</Label>
                <Input id="examDuration" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} min="1" required className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
              </div>
              <div className="space-y-2">
                 <Label htmlFor="defaultMarks" className="flex items-center gap-1 text-slate-600"><CheckCircle className="h-4 w-4" strokeWidth={1.5}/> Default Marks/Question</Label>
                 <Input id="defaultMarks" type="number" value={defaultMarksPerQuestion} onChange={(e) => setDefaultMarksPerQuestion(Math.max(1, parseInt(e.target.value) || 1))} min="1" required className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
               <div className="flex items-center space-x-2">
                <Switch id="allowBacktracking" checked={allowBacktracking} onCheckedChange={setAllowBacktracking} />
                <Label htmlFor="allowBacktracking" className="text-slate-600">Allow Backtracking</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="enableWebcamProctoring" checked={enableWebcamProctoring} onCheckedChange={setEnableWebcamProctoring} />
                <Label htmlFor="enableWebcamProctoring" className="text-slate-600 flex items-center gap-1">
                    <Camera className="h-4 w-4" strokeWidth={1.5}/> Enable Webcam Proctoring
                </Label>
              </div>
            </div>
            <Alert variant="default" className="mt-2 bg-blue-50/50 border-blue-500/30 text-blue-700">
                <AlertTriangleIconLucide className="inline h-4 w-4 mr-1 text-blue-500" strokeWidth={1.5} />
                <AlertTitle className="font-semibold text-blue-600">Important Scheduling Note</AlertTitle>
                <AlertDescription className="text-sm text-blue-700/90">
                    Exams created or edited here are automatically set to &quot;Published&quot; status. Accurate start and end times are mandatory for students to access the exam.
                </AlertDescription>
             </Alert>
            <div className="space-y-2 mt-4">
              <Label className="flex items-center gap-1 font-medium text-slate-700"><CalendarDays className="h-4 w-4 text-blue-500" strokeWidth={1.5} /> Scheduling (Required)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="startTimeDate" className="text-slate-600">Start Date &amp; Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal border-slate-300 text-slate-700 hover:bg-slate-100", !startTime && "text-slate-400")}>
                          <CalendarIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />{startTime ? format(startTime, "PPP") : <span>Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border-slate-200 shadow-xl"><Calendar mode="single" selected={startTime ?? undefined} onSelect={(date) => handleDateTimeChange(date, 'start', startTimeStr)} initialFocus /></PopoverContent>
                    </Popover>
                    <Input type="time" value={startTimeStr} onChange={(e) => handleTimeChange(e.target.value, 'start')} className="w-[120px] border-slate-300 focus:border-blue-500 focus:ring-blue-500" required/>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endTimeDate" className="text-slate-600">End Date &amp; Time</Label>
                   <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal border-slate-300 text-slate-700 hover:bg-slate-100", !endTime && "text-slate-400")}>
                          <CalendarIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />{endTime ? format(endTime, "PPP") : <span>Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border-slate-200 shadow-xl"><Calendar mode="single" selected={endTime ?? undefined} onSelect={(date) => handleDateTimeChange(date, 'end', endTimeStr)} initialFocus disabled={(date) => startTime ? date < startTime : false} /></PopoverContent>
                    </Popover>
                     <Input type="time" value={endTimeStr} onChange={(e) => handleTimeChange(e.target.value, 'end')} className="w-[120px] border-slate-300 focus:border-blue-500 focus:ring-blue-500" required/>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><ListChecks className="h-5 w-5 text-blue-500" strokeWidth={1.5} /> Manage Questions ({questions.length} added)</h3>
            <div className="flex flex-wrap gap-2 my-4">
               <Dialog open={showAiDialog} onOpenChange={(open) => {
                  setShowAiDialog(open);
                  if (!open) {
                    setAiTopic(''); setAiNumQuestions(10); setAiDifficulty('medium');
                    setAiDefaultMarks(defaultMarksPerQuestion);
                    setAiGeneratedQuestions([]); setAiSelectedIndices([]);
                    setAiApiError(null); setAiRawOutput(null); setAiIsGenerating(false);
                    setAiBatchProgressMessage(''); setCurrentAiQuestionsGenerated(0); setTotalAiQuestionsRequested(0);
                  }
               }}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">
                    <Brain className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add Questions with AI Assistant
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] bg-white border-slate-200 shadow-xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-700"><Brain className="h-5 w-5 text-blue-500" /> AI Question Generator</DialogTitle>
                    <DialogDescription className="text-slate-500">Generate multiple-choice questions with 4 options. Max 50 questions.</DialogDescription>
                  </DialogHeader>
                   <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="aiTopic" className="text-slate-600">Topic</Label>
                      <Input id="aiTopic" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g., Photosynthesis, World War II, Python Data Types" className="border-slate-300" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="aiNumQuestions" className="text-slate-600">Number of Questions</Label>
                        <Input id="aiNumQuestions" type="number" value={aiNumQuestions} onChange={(e) => setAiNumQuestions(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} min="1" max="50" className="border-slate-300"/>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aiDifficulty" className="text-slate-600">Difficulty</Label>
                        <Select value={aiDifficulty} onValueChange={(v) => setAiDifficulty(v as any)}>
                          <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                          <SelectContent className="bg-white border-slate-200"><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent>
                        </Select>
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="aiDefaultMarks" className="text-slate-600">Marks per AI Question</Label>
                        <Input id="aiDefaultMarks" type="number" value={aiDefaultMarks} onChange={(e) => setAiDefaultMarks(Math.max(1, parseInt(e.target.value) || 1))} min="1" className="border-slate-300"/>
                      </div>
                    </div>
                    <Button onClick={handleAiGenerate} disabled={aiIsGenerating || !aiTopic.trim()} className="bg-blue-500 hover:bg-blue-600 text-white">
                      {aiIsGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {aiIsGenerating ? 'Generating...' : `Generate ${aiNumQuestions} Question(s)`}
                    </Button>
                  </div>
                   {aiIsGenerating && (
                    <div className="text-center text-slate-500 py-2">
                        <Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>
                        {aiBatchProgressMessage || `Thinking... AI is generating questions.`}
                        <p className="text-xs mt-1">Generated {currentAiQuestionsGenerated} of {totalAiQuestionsRequested} questions.</p>
                        <p className="text-xs mt-1">This may take a minute or more, especially for many questions...</p>
                    </div>
                  )}
                  {aiApiError && <Alert variant="destructive"><AlertTriangleIconLucide className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{aiApiError}{aiRawOutput && <pre className="mt-2 text-xs bg-red-100 p-2 rounded max-h-20 overflow-auto">{aiRawOutput}</pre>}</AlertDescription></Alert>}

                  {aiGeneratedQuestions.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-slate-700">
                          Generated Questions ({currentAiQuestionsGenerated} / {totalAiQuestionsRequested})
                        </Label>
                        <div className="flex items-center space-x-2">
                           <Checkbox
                              id="selectAllAi"
                              checked={aiGeneratedQuestions.length > 0 && aiSelectedIndices.length === aiGeneratedQuestions.length}
                              onCheckedChange={(checked) => handleSelectAllAiQuestions(Boolean(checked))}
                              disabled={aiGeneratedQuestions.length === 0}
                            />
                           <Label htmlFor="selectAllAi" className="text-sm text-slate-600">Select All</Label>
                        </div>
                      </div>
                      <ScrollArea className="h-[300px] w-full rounded-md border border-slate-200 p-3 bg-slate-50/50">
                        {aiGeneratedQuestions.map((q, index) => (
                          <div key={`ai-q-${index}`} className="mb-2 p-2 border-b border-slate-200 last:border-b-0">
                            <div className="flex items-start gap-2">
                              <Checkbox id={`ai-q-select-${index}`} checked={aiSelectedIndices.includes(index)} onCheckedChange={(checked) => handleAiQuestionSelection(index, Boolean(checked))} className="mt-1"/>
                              <Label htmlFor={`ai-q-select-${index}`} className="flex-1 text-sm font-medium text-slate-700">{index+1}. {q.question}</Label>
                            </div>
                            <ul className="list-disc list-inside pl-8 text-xs text-slate-500 mt-1">
                              {q.options.map(opt => (<li key={opt.id} className={opt.id === q.answer ? "text-green-600 font-semibold" : ""}>{opt.id}: {opt.text}</li>))}
                            </ul>
                          </div>
                        ))}
                      </ScrollArea>
                      <Button onClick={addSelectedAiQuestionsToExam} disabled={aiSelectedIndices.length === 0} className="w-full bg-green-500 hover:bg-green-600 text-white">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Selected ({aiSelectedIndices.length}) to Exam
                      </Button>
                    </div>
                  )}
                  <DialogFooter className="sm:justify-start pt-4">
                    <DialogClose asChild><Button type="button" variant="outline" className="border-slate-300">Close</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-white">
              <CardHeader className="p-4"><CardTitle className="text-md font-semibold text-slate-700">Add New Question Manually</CardTitle></CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-1">
                  <Label htmlFor="questionText" className="text-slate-600">Question Text</Label>
                  <Textarea id="questionText" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} placeholder="Enter the question" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
                </div>
                 <div className="space-y-1">
                  <Label htmlFor="questionMarks" className="text-slate-600">Marks for this Question</Label>
                  <Input id="questionMarks" type="number" value={currentQuestionMarks} onChange={(e) => setCurrentQuestionMarks(Math.max(1, parseInt(e.target.value) || 1))} min="1" className="border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
                </div>
                <div>
                  <Label className="text-slate-600">Options &amp; Correct Answer (Provide at least 2 options)</Label>
                  <RadioGroup value={currentCorrectOptionId} onValueChange={setCurrentCorrectOptionId} className="mt-2 space-y-2">
                    {currentOptions.map((opt, index) => (
                      <div key={opt.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md bg-white hover:bg-slate-50 has-[[data-state=checked]]:bg-blue-50 has-[[data-state=checked]]:border-blue-500">
                        <RadioGroupItem value={opt.id} id={opt.id} /> <Label htmlFor={opt.id} className="sr-only">Select Option {index + 1} as correct</Label>
                        <Input value={opt.text} onChange={(e) => handleOptionChange(index, e.target.value)} placeholder={`Option ${index + 1}`} className="flex-grow border-slate-300 focus:border-blue-500 focus:ring-blue-500"/>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter className="p-4">
                <Button type="button" onClick={handleAddQuestion} size="sm" className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm">
                  <PlusCircle className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add This Question
                </Button>
              </CardFooter>
            </Card>

            {questions.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold text-slate-700">Added Questions:</h4>
                <ScrollArea className="h-[300px] w-full rounded-md border border-slate-200 p-1 bg-slate-50/50">
                  <ul className="space-y-2 p-2">
                    {questions.map((q, index) => (
                      <li key={q.id} className="p-3 border border-slate-200 rounded-md bg-white shadow-sm flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-700 text-sm">{index + 1}. {q.text} <span className="text-xs text-blue-600">({q.marks || defaultMarksPerQuestion} Marks)</span></p>
                          <ul className="list-none text-xs text-slate-500 pl-4 space-y-1">
                            {q.options.map((opt) => (
                              <li key={opt.id} className={cn("flex items-center gap-2", opt.id === q.correctOptionId ? 'text-green-600 font-semibold' : '')}>
                                {opt.id === q.correctOptionId && <CheckCircle className="h-3.5 w-3.5 text-green-600" strokeWidth={1.5} />}
                                <span>{opt.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveQuestion(q.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full h-7 w-7">
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </section>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 p-6 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={() => router.back()} className="border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg">
            {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" strokeWidth={2} /> : <Save className="mr-2 h-4 w-4" strokeWidth={1.5} />}
            {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Exam')}
          </Button>
        </CardFooter>
      </div>
    </form>
  );
}
