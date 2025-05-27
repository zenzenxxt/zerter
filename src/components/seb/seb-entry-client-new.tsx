
'use client';

import React, { useEffect, useState, useCallback, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, XCircle, Info, LogOut, ServerCrash, CheckCircle, Ban, CircleSlash, BookOpen, UserCircle2, CalendarDays, ListChecks, Shield, ClockIcon, FileTextIcon, HelpCircleIcon, Wifi, Maximize, Zap, CameraIcon as CameraIconLucide, CameraOff } from 'lucide-react'; // Renamed CameraIcon
import type { Exam, CustomUser, FlaggedEvent, FlaggedEventType } from '@/types/supabase';
import { useToast, toast as globalToast } from '@/hooks/use-toast';
import { format, isValid as isValidDate, parseISO } from 'date-fns';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive } from '@/lib/seb-utils';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import logoAsset from '../../../logo.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FilesetResolver } from "@mediapipe/tasks-vision";

function getSafeErrorMessage(e: any, defaultMessage = "An unknown error occurred."): string {
  if (e && typeof e === 'object') {
    if (e.name === 'AbortError') {
      return "The request timed out. Please check your connection and try again.";
    } else if (typeof e.message === 'string' && e.message.trim() !== '') {
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

const TOKEN_VALIDATION_TIMEOUT_MS = 15000;

interface SecurityCheck {
  id: string;
  label: string;
  checkFn: () => boolean | Promise<boolean>;
  isCritical: boolean;
  status: 'pending' | 'checking' | 'passed' | 'failed' | 'skipped';
  details?: string;
  icon?: React.ElementType;
}

const generalRules = [
  { text: "Ensure your internet connection is stable throughout the exam.", icon: Wifi },
  { text: "Do not switch tabs, open other applications, or use unauthorized tools.", icon: Ban },
  { text: "Only one submission is allowed per student for this exam.", icon: FileTextIcon },
  { text: "The time limit is strictly enforced. The exam will auto-submit when time expires.", icon: ClockIcon },
  { text: "Read all questions and instructions carefully before answering.", icon: BookOpen },
  { text: "Keep your exam environment secure and free from distractions.", icon: Shield },
  { text: "Attempting to use disallowed shortcuts or tools will be flagged.", icon: AlertTriangle },
  { text: "Ensure SEB is in fullscreen mode if required by your institution.", icon: Maximize },
];

interface SebEntryClientNewProps {
  entryTokenFromPath?: string | null;
}

export function SebEntryClientNew({ entryTokenFromPath }: SebEntryClientNewProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams(); 
  const { supabase, isLoading: authContextLoading } = useAuth();
  const { toast } = useGlobalToast();

  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<string>('initializing');
  const [pageError, setPageError] = useState<string | null>(null);

  const [validatedStudentId, setValidatedStudentId] = useState<string | null>(null);
  const [validatedExamId, setValidatedExamId] = useState<string | null>(null);
  const [isPreviouslySubmitted, setIsPreviouslySubmitted] = useState(false);

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [studentProfile, setStudentProfile] = useState<CustomUser | null>(null);
  const [isDataReadyForExam, setIsDataReadyForExam] = useState(false);

  const [showExitSebButton, setShowExitSebButton] = useState(true);
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [isSubmittingViaApi, setIsSubmittingViaApi] = useState(false);

  const [accumulatedMediaPipeFlags, setAccumulatedMediaPipeFlags] = useState<FlaggedEvent[]>([]);
  const [accumulatedBrowserFlags, setAccumulatedBrowserFlags] = useState<FlaggedEvent[]>([]);
  const [actualStartTime, setActualStartTime] = useState<string | null>(null);


  const isDevModeActive = process.env.NEXT_PUBLIC_DEV_MODE_SKIP_SEB_LAUNCH === "true";

  useEffect(() => {
    setMounted(true);
  }, []);

  const tokenFromQueryHook = useMemo(() => {
    if (mounted && searchParamsHook) {
      return searchParamsHook.get('token');
    }
    return null;
  }, [searchParamsHook, mounted]);

  useEffect(() => {
    const initialChecks: SecurityCheck[] = [
      { id: 'sebEnv', label: 'SEB Environment', checkFn: isSebEnvironment, isCritical: !isDevModeActive, status: 'pending', icon: Shield },
      { id: 'online', label: 'Internet Connection', checkFn: isOnline, isCritical: true, status: 'pending', icon: Wifi },
      {
        id: 'webcamAndMediaPipe',
        label: 'Webcam & Proctoring Models',
        checkFn: async () => {
          // This check's criticality is determined later based on examDetails
          if (!examDetails || !(examDetails.enable_webcam_proctoring ?? false)) return true; // Skip if proctoring is not enabled for the exam
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Release camera immediately after check
            await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
            return true;
          } catch (err) {
            console.error("[SebEntryClientNew] Webcam/MediaPipe prerequisite check failed:", err);
            globalToast({ title: "Webcam/Proctoring Check Failed", description: getSafeErrorMessage(err, "Could not access webcam or load proctoring models."), variant: "destructive", duration: 7000 });
            return false;
          }
        },
        isCritical: false, // Will be updated once examDetails are fetched
        status: 'pending',
        icon: CameraIconLucide,
      },
      { id: 'devTools', label: 'Developer Tools', checkFn: () => !areDevToolsLikelyOpen(), isCritical: true, status: 'pending', icon: Zap },
      { id: 'webDriver', label: 'Automation Tools', checkFn: () => !isWebDriverActive(), isCritical: true, status: 'pending', icon: Ban },
    ];
    
    if (examDetails) {
      const proctoringEnabledForThisExam = examDetails.enable_webcam_proctoring ?? false;
      setSecurityChecks(
        initialChecks.map(check =>
          check.id === 'webcamAndMediaPipe'
            ? { ...check, isCritical: proctoringEnabledForThisExam, status: 'pending' } 
            : { ...check, status: 'pending'}
        )
      );
    } else {
      // Initialize with webcam check as non-critical by default until exam details are loaded
      setSecurityChecks(initialChecks.map(c => ({ ...c, status: 'pending', isCritical: c.id === 'webcamAndMediaPipe' ? false : c.isCritical })));
    }
  }, [isDevModeActive, examDetails]); 

  const handleExitSeb = useCallback(() => {
    globalToast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, [globalToast]);


  useEffect(() => {
    const effectId = `[SebEntryClientNew MainEffect ${Date.now().toString().slice(-4)}]`;
    
    async function validateAndFetchInternal() {
      console.log(`${effectId} Running. Stage: ${stage}, Mounted: ${mounted}, AuthLoading: ${authContextLoading}, PageError: ${pageError}`);
      const effectiveTokenToUse = entryTokenFromPath || tokenFromQueryHook;
      console.log(`${effectId} effectiveTokenToUse: ${effectiveTokenToUse ? effectiveTokenToUse.substring(0,10) + "..." : "null"}`);

      if (stage === 'initializing' || (stage === 'validatingToken' && !validatedExamId)) {
        if (!effectiveTokenToUse && mounted) {
          const errorMsg = "CRITICAL: SEB entry token missing or could not be determined.";
          console.error(`${effectId} ${errorMsg}. entryTokenFromPath: ${entryTokenFromPath}, tokenFromQueryHook: ${tokenFromQueryHook}`);
          setPageError(errorMsg); setStage('error'); return;
        }
        if (!effectiveTokenToUse) {
           console.log(`${effectId} Waiting: Token not yet available (component might not be fully mounted or searchParams not resolved).`);
           return;
        }

        if (!isDevModeActive && !isSebEnvironment()) {
          const errorMsg = "This page must be accessed within Safe Exam Browser (production mode).";
          setPageError(errorMsg); setStage('error'); return;
        }

        if (stage !== 'validatingToken') setStage('validatingToken');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TOKEN_VALIDATION_TIMEOUT_MS);

        try {
          const res = await fetch(`/api/seb/validate-token?token=${encodeURIComponent(effectiveTokenToUse)}`, {
            method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          });
          clearTimeout(timeoutId);
          let responseBodyText = await res.text();
          let apiErrorMsg = `Token validation API request failed with status: ${res.status}.`;

          if (res.ok) {
            try {
              const responseBodyJson = JSON.parse(responseBodyText);
              if (responseBodyJson.error) throw new Error(responseBodyJson.error);
              setValidatedStudentId(responseBodyJson.studentId);
              setValidatedExamId(responseBodyJson.examId);
              setIsPreviouslySubmitted(responseBodyJson.isAlreadySubmitted || false);
              setStage('fetchingDetails');
            } catch (jsonParseError: any) {
                throw new Error(getSafeErrorMessage(jsonParseError, "Failed to parse server response after successful validation."));
            }
          } else {
            try {
                const errorBodyJson = JSON.parse(responseBodyText);
                if (errorBodyJson && typeof errorBodyJson.error === 'string' && errorBodyJson.error.trim() !== '') {
                    apiErrorMsg = errorBodyJson.error;
                } else {
                    apiErrorMsg += ` Server response: ${responseBodyText.substring(0,150)}${responseBodyText.length > 150 ? '...' : ''}`;
                }
            } catch (jsonParseError) {
                apiErrorMsg += ` Server response (non-JSON): ${responseBodyText.substring(0,150)}${responseBodyText.length > 150 ? '...' : ''}`;
            }
            throw new Error(apiErrorMsg);
          }
        } catch (e: any) {
          const errorMsg = getSafeErrorMessage(e, "Error during token validation.");
          setPageError(`Token Validation Error: ${errorMsg}`); setStage('error');
        }
        return;
      }

      if (stage === 'fetchingDetails') {
        if (!supabase) {
          const errorMsg = "CRITICAL: Service connection failed. Cannot load exam details.";
          setPageError(errorMsg); setStage('error'); return;
        }
        if (!validatedExamId || !validatedStudentId) { 
            setPageError("Internal error: Missing validated IDs for fetching details."); setStage('error'); return;
        }

        let fetchedExam: Exam | null = null;
        let fetchedStudent: CustomUser | null = null;

        try {
          const { data: examData, error: examError } = await supabase
            .from('ExamX')
            .select('*, enable_webcam_proctoring') 
            .eq('exam_id', validatedExamId)
            .single();
          if (examError || !examData) {
              const fetchExamErrorMsg = getSafeErrorMessage(examError, `Exam ${validatedExamId} not found or access denied.`);
              setPageError(`Failed to load exam details: ${fetchExamErrorMsg}`); setStage('error'); return;
          }
          fetchedExam = examData as Exam;

          const { data: studentData, error: studentError } = await supabase.from('proctorX').select('*').eq('user_id', validatedStudentId).single();
          if (studentError || !studentData) {
            const fetchStudentErrorMsg = getSafeErrorMessage(studentError, `Student ${validatedStudentId} not found or access denied.`);
            setPageError(`Failed to load student profile: ${fetchStudentErrorMsg}`); setStage('error'); return;
          }
          fetchedStudent = studentData as CustomUser;

          setExamDetails(fetchedExam); 
          setStudentProfile(fetchedStudent);
          
          if (fetchedExam.questions && fetchedExam.questions.length > 0) {
            setIsDataReadyForExam(true);
            if (isPreviouslySubmitted) {
                setStage('examCompleted');
            } else {
                setStage('readyToStart');
            }
          } else {
            const noQuestionsError = "This exam currently has no questions. Please contact your instructor.";
            setPageError(`Cannot start exam: ${noQuestionsError}`); setStage('error');
          }
        } catch (e: any) {
          const errorMsg = getSafeErrorMessage(e, "Failed to load exam/student info.");
          setPageError(`Data Loading Error: ${errorMsg}`); setStage('error');
        }
      }
    }

    if (mounted && !pageError) { 
      if(authContextLoading && stage === 'initializing') {
        // Still wait if auth context is loading and we are at the very beginning
      } else {
        validateAndFetchInternal();
      }
    }
  }, [stage, entryTokenFromPath, tokenFromQueryHook, isDevModeActive, supabase, authContextLoading, mounted]); // Removed pageError and states set by this effect

  const runSecurityChecks = useCallback(async () => {
    if (!examDetails || !studentProfile || !validatedStudentId) {
      const errorMsg = "Cannot run security checks: Essential exam or student data is missing.";
      setPageError(errorMsg); setStage('error'); return;
    }

    setStage('performingSecurityChecks');
    let allCriticalPassed = true;
    
    let currentChecks = [...securityChecks]; 

    for (let i = 0; i < currentChecks.length; i++) {
      const check = currentChecks[i];
      
      currentChecks[i] = { ...check, status: 'checking' };
      setSecurityChecks([...currentChecks]); 
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));

      const proctoringEnabledForThisExam = examDetails.enable_webcam_proctoring ?? false;
      if (check.id === 'webcamAndMediaPipe' && !proctoringEnabledForThisExam) {
        currentChecks[i] = { ...check, status: 'skipped', details: 'Skipped (Proctoring Disabled by Exam Setting)', isCritical: false };
        setSecurityChecks([...currentChecks]);
        continue; 
      }

      try {
        const passed = await check.checkFn();
        currentChecks[i] = { ...check, status: passed ? 'passed' : 'failed', details: passed ? 'OK' : `Failed: ${check.label}` };
        if (!passed && check.isCritical) { 
          allCriticalPassed = false;
        }
      } catch (e: any) {
        const errorMsg = getSafeErrorMessage(e, `Error during security check: ${check.label}`);
        currentChecks[i] = { ...check, status: 'failed', details: errorMsg };
        if (check.isCritical) allCriticalPassed = false;
      }
      setSecurityChecks([...currentChecks]);
      if (!allCriticalPassed && currentChecks[i].isCritical && currentChecks[i].status === 'failed') break;
    }

    if (allCriticalPassed) {
      setStage('startingExamSession');
    } else {
      const failedCritical = currentChecks.find(c => c.status === 'failed' && c.isCritical);
      let errorMsg = `Critical security check failed: ${failedCritical?.details || failedCritical?.label || 'Unknown Check'}. Cannot start exam.`;
      setPageError(errorMsg); setStage('securityChecksFailed');
    }
  }, [examDetails, studentProfile, validatedStudentId, securityChecks]);


  const handleStartExamSession = useCallback(async () => {
    if (!isDataReadyForExam || !examDetails || !validatedStudentId || !supabase || !studentProfile || !examDetails.questions || examDetails.questions.length === 0) {
      let errorParts: string[] = [];
      if (!isDataReadyForExam) errorParts.push("Data not fully ready");
      if (!examDetails) errorParts.push("ExamDetails missing"); else if (!examDetails.questions || examDetails.questions.length === 0) errorParts.push("Exam has no questions");
      if (!validatedStudentId) errorParts.push("ValidatedStudentId missing"); if (!supabase) errorParts.push("Supabase client unavailable"); if (!studentProfile) errorParts.push("StudentProfile missing");
      const errorMsg = `Essential data missing to start exam session: ${errorParts.join(', ')}. Cannot proceed.`;
      setPageError(errorMsg); setStage('error'); return;
    }
    
    try {
      const examStartTime = new Date().toISOString();
      setActualStartTime(examStartTime); 

      const { error: submissionUpsertError } = await supabase.from('ExamSubmissionsX')
        .upsert({
          exam_id: examDetails.exam_id, student_user_id: validatedStudentId, status: 'In Progress', started_at: examStartTime,
          answers: null, flagged_events: null, score: null, submitted_at: null,
          marks_obtained: null, total_possible_marks: null,
        }, { onConflict: 'exam_id, student_user_id' })
        .select();

      if (submissionUpsertError) {
        const warningMsg = getSafeErrorMessage(submissionUpsertError, "Could not record exam start accurately.");
        globalToast({ title: "Start Record Warning", description: warningMsg, variant: "default" });
      }
      setStage('examInProgress');
    } catch (e: any) {
      const errorMsg = getSafeErrorMessage(e, "Failed to initialize exam session state.");
      setPageError(errorMsg); setStage('error');
    }
  }, [examDetails, validatedStudentId, supabase, studentProfile, globalToast, isDataReadyForExam]);

  useEffect(() => {
    if (stage === 'startingExamSession') {
      handleStartExamSession();
    }
  }, [stage, handleStartExamSession]);

  const handleMediaPipeFlagEvent = useCallback((eventData: { type: FlaggedEventType; details?: string }) => {
    if (!validatedStudentId || !validatedExamId || !examDetails || !(examDetails.enable_webcam_proctoring ?? false)) return;
    const newFlag: FlaggedEvent = {
        studentId: validatedStudentId,
        examId: validatedExamId,
        timestamp: new Date(),
        type: eventData.type,
        details: eventData.details,
    };
    setAccumulatedMediaPipeFlags(prev => [...prev, newFlag]);
    globalToast({ title: "Proctoring Alert", description: `${newFlag.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${newFlag.details || 'Activity detected.'}`, variant: "destructive", duration: 4000 });
  }, [validatedStudentId, validatedExamId, examDetails, globalToast]);

  const handleBrowserFlagEvent = useCallback((eventData: { type: FlaggedEventType; details?: string }) => {
    if (!validatedStudentId || !validatedExamId ) return; 
     const newFlag: FlaggedEvent = {
        studentId: validatedStudentId,
        examId: validatedExamId,
        timestamp: new Date(),
        type: eventData.type,
        details: eventData.details,
    };
    setAccumulatedBrowserFlags(prev => [...prev, newFlag]);
  }, [validatedStudentId, validatedExamId]);


  const handleExamSubmitOrTimeUp = useCallback(async (answers: Record<string, string>, browserFlagsFromInterface: FlaggedEvent[], examInterfaceActualStartTime: string, submissionType: 'submit' | 'timeup') => {
    if (!validatedExamId || !validatedStudentId || !examDetails || !studentProfile || !examInterfaceActualStartTime) {
      const errorMsg = "Student, Exam details, or actual start time missing for submission. Cannot submit.";
      globalToast({ title: "Submission Error", description: errorMsg, variant: "destructive" });
      setPageError(errorMsg); setStage('error'); return;
    }
    setStage('submittingExam'); setIsSubmittingViaApi(true);

    let allFlaggedEvents: FlaggedEvent[] = [...browserFlagsFromInterface, ...accumulatedBrowserFlags];
    if (examDetails.enable_webcam_proctoring ?? false) { 
        allFlaggedEvents = [...allFlaggedEvents, ...accumulatedMediaPipeFlags];
    }

    const submissionPayload = {
      exam_id: validatedExamId, student_user_id: validatedStudentId, answers: answers,
      flagged_events: allFlaggedEvents.length > 0 ? allFlaggedEvents : null,
      status: 'Completed' as 'Completed',
      started_at: examInterfaceActualStartTime, 
    };

    try {
      const response = await fetch('/api/seb/submit-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submissionPayload),
      });

      let responseBodyText = await response.text();
      if (!response.ok) {
        let apiErrorMsg = `API submission failed with status: ${response.status}.`;
        try {
            const errorBodyJson = JSON.parse(responseBodyText);
            if (errorBodyJson && typeof errorBodyJson.error === 'string' && errorBodyJson.error.trim() !== '') {
                apiErrorMsg = errorBodyJson.error;
            } else {
                apiErrorMsg += ` Server response: ${responseBodyText.substring(0,100)}${responseBodyText.length > 100 ? '...' : ''}`;
            }
        } catch (jsonParseError) {
            apiErrorMsg += ` Server response (non-JSON): ${responseBodyText.substring(0,100)}${responseBodyText.length > 100 ? '...' : ''}`;
        }
        throw new Error(apiErrorMsg);
      }

      let responseBodyJson;
      try {
        responseBodyJson = JSON.parse(responseBodyText);
      } catch (jsonParseError) {
        throw new Error("Could not parse submission confirmation from server.");
      }

      globalToast({ title: submissionType === 'submit' ? "Exam Submitted!" : "Exam Auto-Submitted!", description: "Your responses have been recorded.", duration: 6000 });
      setExamDetails(prev => prev ? ({ ...prev, status: 'Completed' }) : null);
      setIsPreviouslySubmitted(true);
      setStage('examCompleted');
    } catch (e: any) {
      const errorMsg = getSafeErrorMessage(e, "Failed to submit exam.");
      setPageError(`Submission Error: ${errorMsg}`); setStage('error');
      globalToast({ title: "Submission Error", description: errorMsg, variant: "destructive", duration: 10000 });
    } finally {
      setIsSubmittingViaApi(false);
    }
  }, [validatedExamId, validatedStudentId, examDetails, studentProfile, globalToast, accumulatedMediaPipeFlags, accumulatedBrowserFlags]);

  const isLoadingCriticalStages = stage === 'initializing' || stage === 'validatingToken' || stage === 'fetchingDetails' || (authContextLoading && stage === 'initializing');


  if (isLoadingCriticalStages && !pageError) {
    let message = "Initializing Secure Exam Environment...";
    if (stage === 'validatingToken') message = "Validating exam session token...";
    if (stage === 'fetchingDetails') message = "Loading exam and student details...";
    if (authContextLoading && stage === 'initializing') message = "Initializing secure context...";

    return (
      <div className="flex flex-col items-center justify-center text-center min-h-screen w-full bg-background text-foreground overflow-hidden p-2">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 stroke-width-1.5" />
        <h2 className="text-xl font-medium text-foreground mb-2">{message}</h2>
      </div>
    );
  }

  if (stage === 'error' || stage === 'securityChecksFailed') {
    const displayError = pageError || "An unknown error occurred. Could not prepare the exam session.";
    const errorTitle = stage === 'securityChecksFailed' ? "Security Check Failed" : "Exam Access Error";
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground overflow-hidden p-2">
        <Card className="w-full max-w-lg text-center bg-card p-6 sm:p-8 rounded-xl shadow-xl border-destructive/50">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-5 stroke-width-1.5" />
          <h2 className="text-2xl font-semibold mb-3 text-destructive">{errorTitle}</h2>
          <p className="text-sm mb-6 whitespace-pre-wrap text-muted-foreground">{displayError}</p>
          {showExitSebButton && (
              <Button onClick={handleExitSeb} className="w-full btn-gradient-destructive">Exit SEB</Button>
          )}
        </Card>
      </main>
    );
  }

  if (stage === 'performingSecurityChecks') {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground overflow-hidden p-2">
        <Card className="w-full max-w-lg text-center bg-card p-6 sm:p-8 rounded-xl shadow-xl border-border/30">
          <CardHeader className="border-b border-border/20 pb-3 mb-5 p-0">
            <Shield className="h-12 w-12 text-primary mx-auto mb-3 stroke-width-1.5" />
            <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">Security System Check</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground pt-1">Verifying your exam environment. Please wait.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-left p-0">
            {securityChecks.map(check => {
              const IconComponent = check.icon || HelpCircleIcon;
              let statusText = check.status.charAt(0).toUpperCase() + check.status.slice(1);
              if (check.status === 'skipped') statusText = "Skipped (Proctoring Disabled by Exam Setting)";

              return (
                <div key={check.id} className={cn(
                  "flex justify-between items-center p-2 rounded-md border text-sm",
                  check.status === 'pending' ? 'border-border/50 bg-muted/30 text-muted-foreground' :
                  check.status === 'checking' ? 'border-primary/60 bg-primary/10 text-primary animate-pulse' :
                  check.status === 'passed' ? 'border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-400' :
                  check.status === 'skipped' ? 'border-slate-400/50 bg-slate-400/10 text-slate-500 dark:text-slate-400' :
                  'border-destructive/60 bg-red-500/10 text-red-700 dark:text-red-400'
                )}>
                  <div className="flex items-center gap-2">
                    <IconComponent className={cn("h-4 w-4 stroke-width-1.5",
                       check.status === 'pending' ? 'text-muted-foreground/70' :
                       check.status === 'checking' ? 'text-primary' :
                       check.status === 'passed' ? 'text-green-600 dark:text-green-400' :
                       check.status === 'skipped' ? 'text-slate-500 dark:text-slate-400' :
                       'text-red-600 dark:text-red-400'
                    )} />
                    <span className="font-medium text-foreground">{check.label}</span>
                  </div>
                  {check.status === 'pending' && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin stroke-width-1.5" />}
                  {check.status === 'checking' && <Loader2 className="h-4 w-4 text-primary animate-spin stroke-width-1.5" />}
                  {check.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 stroke-width-1.5" />}
                  {check.status === 'skipped' && <Info className="h-4 w-4 text-slate-500 dark:text-slate-400 stroke-width-1.5" />}
                  {check.status === 'failed' && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 stroke-width-1.5" />}
                </div>
              );
            })}
          </CardContent>
           <div className="mt-6">
             <Button className="w-full btn-primary-solid opacity-70" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin stroke-width-1.5" /> Checking Environment...
              </Button>
          </div>
        </Card>
      </main>
    );
  }

  if (stage === 'startingExamSession' || stage === 'submittingExam') {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-screen w-full bg-background text-foreground overflow-hidden p-2">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 stroke-width-1.5" />
        <h2 className="text-xl font-medium text-foreground mb-2">
          {stage === 'startingExamSession' ? "Preparing your exam session..." : "Submitting Exam..."}
        </h2>
        {stage === 'submittingExam' && <p className="text-sm text-muted-foreground">Please wait, do not close SEB.</p>}
      </div>
    );
  }

  if (!examDetails || !studentProfile || !isDataReadyForExam) {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground overflow-hidden p-2">
        <Card className="w-full max-w-lg text-center bg-card p-6 sm:p-8 rounded-xl shadow-xl border-destructive/50">
          <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5 stroke-width-1.5" />
          <h2 className="text-xl font-semibold mb-3 text-destructive">Data Error</h2>
          <p className="text-sm mb-6 text-muted-foreground">Essential exam or student data could not be loaded. Please contact support.</p>
          {showExitSebButton && (
              <Button onClick={handleExitSeb} className="w-full max-w-xs btn-gradient-destructive">Exit SEB</Button>
          )}
        </Card>
      </main>
    );
  }

  if (stage === 'examInProgress') {
    if (!actualStartTime) {
       return (
          <div className="flex flex-col items-center justify-center text-center min-h-screen w-full bg-background text-foreground overflow-hidden p-2">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 stroke-width-1.5" />
            <h2 className="text-xl font-medium text-foreground mb-2">Finalizing exam start...</h2>
          </div>
        );
    }
    return (
      <ExamTakingInterface
        examDetails={examDetails}
        questions={examDetails.questions || []}
        parentIsLoading={isSubmittingViaApi} 
        onAnswerChange={() => { }} 
        onSubmitExam={(answers, browserFlags, interfaceActualStartTime) => handleExamSubmitOrTimeUp(answers, browserFlags, interfaceActualStartTime, 'submit')}
        onTimeUp={(answers, browserFlags, interfaceActualStartTime) => handleExamSubmitOrTimeUp(answers, browserFlags, interfaceActualStartTime, 'timeup')}
        onMediaPipeFlag={handleMediaPipeFlagEvent}
        onBrowserFlag={handleBrowserFlagEvent}
        isDemoMode={false}
        userIdForActivityMonitor={studentProfile.user_id}
        studentName={studentProfile.name}
        studentRollNumber={studentProfile.user_id} 
        studentAvatarUrl={studentProfile.avatar_url}
        examStarted={true}
        actualStartTime={actualStartTime}
      />
    );
  }

  const isExamEffectivelyCompleted = stage === 'examCompleted' || isPreviouslySubmitted;
  let examStatusText = "Ready to Start";
  if (isPreviouslySubmitted) examStatusText = "Already Submitted";
  else if (stage === 'examCompleted') examStatusText = "Completed";


  return (
    <div className="min-h-screen w-full flex flex-col sm:flex-row bg-background text-foreground overflow-hidden">
      <div className="w-full sm:w-2/5 lg:w-1/3 flex flex-col bg-slate-50 dark:bg-slate-800/30 p-3 sm:p-5">
        <header className="flex items-center justify-start shrink-0 h-16 mb-3">
          <Image src={logoAsset} alt="ZenTest Logo" width={160} height={45} className="h-12 sm:h-14 w-auto" />
        </header>

        <div className="flex-grow overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 text-foreground dark:text-slate-200">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">{examDetails.title}</h1>
          {examDetails.description && <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{examDetails.description}</p>}

          <div className="space-y-1 text-xs sm:text-sm pt-2 border-t border-border/20 dark:border-slate-700/50">
            <p className="flex items-center gap-1.5 text-muted-foreground"><FileTextIcon className="h-3.5 w-3.5 text-primary shrink-0 stroke-width-1.5" /> Questions: <span className="font-medium text-foreground">{examDetails.questions?.length || 0}</span></p>
            {examDetails.start_time && isValidDate(parseISO(examDetails.start_time)) &&
              <p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-primary shrink-0 stroke-width-1.5" /> Start: <span className="font-medium text-foreground">{format(parseISO(examDetails.start_time), "MMM d, hh:mm a")}</span></p>
            }
            {examDetails.end_time && isValidDate(parseISO(examDetails.end_time)) &&
              <p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-primary shrink-0 stroke-width-1.5" /> End: <span className="font-medium text-foreground">{format(parseISO(examDetails.end_time), "MMM d, hh:mm a")}</span></p>
            }
            <p className="flex items-center gap-1.5 text-muted-foreground"><ListChecks className="h-3.5 w-3.5 text-primary shrink-0 stroke-width-1.5" /> Backtracking: <span className="font-medium text-foreground">{examDetails.allow_backtracking ? 'Allowed' : 'Not Allowed'}</span></p>
            <p className="flex items-center gap-1.5 text-muted-foreground"><CameraIconLucide className="h-3.5 w-3.5 text-primary shrink-0 stroke-width-1.5"/> Proctoring: <span className="font-medium text-foreground">{(examDetails.enable_webcam_proctoring ?? false) ? 'Enabled' : 'Disabled'}</span></p>
          </div>
        </div>
        {showExitSebButton && (
            <div className="mt-auto shrink-0 pt-3 border-t border-border/20 dark:border-slate-700/50">
                <Button variant="outline" onClick={handleExitSeb} className="w-full btn-outline-subtle py-2 rounded-md text-xs sm:text-sm">
                    <LogOut className="mr-1.5 h-3.5 w-3.5 stroke-width-1.5" /> Exit SEB
                </Button>
            </div>
        )}
      </div>

      <div className="w-full sm:w-3/5 lg:w-2/3 flex flex-col p-3 sm:p-5 space-y-4 bg-background text-foreground">
        <div className="flex justify-end items-start shrink-0">
          <div className="flex items-center gap-2 p-2 border border-border/20 rounded-lg bg-card shadow-sm">
            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/60">
              <AvatarImage src={studentProfile.avatar_url || undefined} alt={studentProfile.name || 'Student'} />
              <AvatarFallback className="bg-muted text-muted-foreground text-base sm:text-lg">
                {(studentProfile.name || "S").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm sm:text-base font-semibold text-foreground">{studentProfile.name}</p>
              <p className="text-xs text-muted-foreground">ID: {studentProfile.user_id}</p>
              {studentProfile.email && <p className="text-xs text-muted-foreground">{studentProfile.email}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          <div className="border border-border/20 rounded-lg p-3 text-center bg-card shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Exam Duration</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{examDetails.duration} minutes</p>
          </div>
          <div className="border border-border/20 rounded-lg p-3 text-center bg-card shadow-sm">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">Status</p>
            <p className={cn("text-2xl sm:text-3xl font-bold tabular-nums", isExamEffectivelyCompleted ? "text-green-600 dark:text-green-400" : "text-primary")}>
              {examStatusText}
            </p>
          </div>
        </div>

        <div className="glass-pane p-3 sm:p-4 rounded-lg shadow-lg border border-border/20 flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 text-foreground dark:text-slate-200">
          <h3 className="text-base sm:text-md font-semibold mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary stroke-width-1.5" /> General Rules & Instructions
          </h3>
          <ul className="space-y-1.5 text-xs sm:text-sm seb-rules-list">
            {generalRules.map((rule, index) => {
              const RuleIcon = rule.icon;
              return (
                <li key={index} className="flex items-start gap-1.5">
                  <RuleIcon className="h-4 w-4 text-primary shrink-0 mt-0.5 stroke-width-1.5" />
                  <span>{rule.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex justify-center mt-auto pt-3 shrink-0">
          {isExamEffectivelyCompleted ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full max-w-sm">
                    <Button className="w-full py-2 text-sm sm:text-base opacity-60 cursor-not-allowed bg-primary/70 hover:bg-primary/60 text-primary-foreground/80" disabled>
                      <CircleSlash className="mr-1.5 h-4 w-4 stroke-width-1.5" /> Exam Submitted
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground border-border shadow-lg">
                  <p>You have already submitted this exam.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              onClick={runSecurityChecks}
              className="w-full max-w-sm py-2 text-sm sm:text-base shadow-xl btn-gradient"
              disabled={stage !== 'readyToStart' || !isDataReadyForExam || !examDetails.questions || examDetails.questions.length === 0 || isSubmittingViaApi}
            >
              <PlayCircle className="mr-1.5 h-4 sm:h-5 w-4 sm:w-5 stroke-width-1.5" />
              {(!examDetails.questions || examDetails.questions.length === 0) ? "No Questions in Exam" : "Start Exam & Security Checks"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

    