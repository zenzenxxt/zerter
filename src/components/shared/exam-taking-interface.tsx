
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Clock, Bookmark, ChevronLeft, ChevronRight, LogOut, Move, CameraOff as CameraOffIcon, Maximize2, Eye, EyeOff } from 'lucide-react';
import { useActivityMonitor } from '@/hooks/use-activity-monitor';
import { addInputRestrictionListeners, disableContextMenu, attemptBlockShortcuts, disableCopyPaste } from '@/lib/seb-utils';
import { useToast as useGlobalToast } from '@/hooks/use-toast';
import type { Question, Exam, FlaggedEvent, FlaggedEventType } from '@/types/supabase';
import { cn } from "@/lib/utils";
import logoAsset from '../../../logo.png';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FaceLandmarker, FilesetResolver, VisionRunningMode } from "@mediapipe/tasks-vision";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ExamTakingInterfaceProps {
  examDetails: Exam;
  questions: Question[];
  parentIsLoading: boolean;
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmitExam: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[], actualStartTime: string) => Promise<void>;
  onTimeUp: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[], actualStartTime: string) => Promise<void>;
  onMediaPipeFlag: (eventData: { type: FlaggedEventType; details?: string }) => void;
  onBrowserFlag: (eventData: { type: FlaggedEventType; details?: string }) => void;
  isDemoMode?: boolean;
  userIdForActivityMonitor: string;
  studentName?: string | null;
  studentRollNumber?: string | null;
  studentAvatarUrl?: string | null;
  examStarted: boolean;
  actualStartTime: string | null;
}

const FLAG_COOLDOWN_MS = 5000;
const NO_FACE_TIMEOUT_MS = 3000;
const HEAD_YAW_THRESHOLD = 0.28;

const INITIAL_PROCTOR_UI_WIDTH = 240;
const INITIAL_PROCTOR_UI_HEIGHT = 180;
const MIN_PROCTOR_UI_WIDTH = 160;
const MIN_PROCTOR_UI_HEIGHT = 120;
const MAX_PROCTOR_UI_WIDTH = 480;
const MAX_PROCTOR_UI_HEIGHT = 360;
const STATUS_BAR_HEIGHT = 32;

export function ExamTakingInterface({
  examDetails,
  questions,
  parentIsLoading,
  onAnswerChange,
  onSubmitExam: parentOnSubmitExam,
  onTimeUp: parentOnTimeUp,
  onMediaPipeFlag,
  onBrowserFlag,
  isDemoMode = false,
  userIdForActivityMonitor,
  studentName,
  studentRollNumber,
  studentAvatarUrl,
  examStarted,
  actualStartTime: initialActualStartTime,
}: ExamTakingInterfaceProps) {
  const { toast } = useGlobalToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(examDetails.duration * 60);
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmittingInternally, setIsSubmittingInternally] = useState(false);
  
  const [actualExamStartTimeState, setActualExamStartTimeState] = useState<string | null>(initialActualStartTime);

  const [isWebcamInitialized, setIsWebcamInitialized] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastNoFaceTimeRef = useRef<number | null>(null);
  const lastFlagTimesRef = useRef<Record<string, number>>({});
  const requestRef = useRef<number>();

  const proctoringUiRef = useRef<HTMLDivElement>(null);
  const [isDraggingProctorUi, setIsDraggingProctorUi] = useState(false);
  const [proctorUiPosition, setProctorUiPosition] = useState({ top: 10, left: typeof window !== 'undefined' ? Math.max(10, window.innerWidth / 2 - INITIAL_PROCTOR_UI_WIDTH / 2) : 10 });
  const dragStartOffset = useRef({ x: 0, y: 0 });

  const [isResizingProctorUi, setIsResizingProctorUi] = useState(false);
  const [proctorUiSize, setProctorUiSize] = useState({ width: INITIAL_PROCTOR_UI_WIDTH, height: INITIAL_PROCTOR_UI_HEIGHT });
  const resizeStartInfo = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const onSubmitExamRef = useRef(parentOnSubmitExam);
  const onTimeUpRef = useRef(parentOnTimeUp);
  const onMediaPipeFlagRef = useRef(onMediaPipeFlag);
  const onBrowserFlagRef = useRef(onBrowserFlag);
  const questionButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const shouldRenderProctoringUI = useMemo(() => (examDetails.enable_webcam_proctoring ?? false) && !isDemoMode, [examDetails.enable_webcam_proctoring, isDemoMode]);

  useEffect(() => {
    if (examStarted && !actualExamStartTimeState && questions.length > 0 && !parentIsLoading) {
      console.log("[ExamTakingInterface] Setting actual exam start time state.");
      setActualExamStartTimeState(new Date().toISOString());
    }
  }, [examStarted, actualExamStartTimeState, questions, parentIsLoading]);

  useEffect(() => {
    questionButtonRefs.current = questionButtonRefs.current.slice(0, questions.length);
  }, [questions.length]);

  useEffect(() => {
    if (questionButtonRefs.current[currentQuestionIndex]) {
      questionButtonRefs.current[currentQuestionIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentQuestionIndex]);

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);
  const allowBacktracking = useMemo(() => examDetails.allow_backtracking === true, [examDetails.allow_backtracking]);

  useEffect(() => { onSubmitExamRef.current = parentOnSubmitExam; }, [parentOnSubmitExam]);
  useEffect(() => { onTimeUpRef.current = parentOnTimeUp; }, [parentOnTimeUp]);
  useEffect(() => { onMediaPipeFlagRef.current = onMediaPipeFlag; }, [onMediaPipeFlag]);
  useEffect(() => { onBrowserFlagRef.current = onBrowserFlag; }, [onBrowserFlag]);

  useEffect(() => {
    if (currentQuestion?.id && !visitedQuestions[currentQuestion.id]) {
      setVisitedQuestions(prev => ({ ...prev, [currentQuestion.id!]: true }));
    }
  }, [currentQuestion, visitedQuestions]);

  const handleBrowserFlagEventInternal = useCallback((eventData: { type: FlaggedEventType; details?: string }) => {
    if (isDemoMode || !shouldRenderProctoringUI) return;
    onBrowserFlagRef.current(eventData);
    toast({
      title: "Activity Alert (System)",
      description: `${eventData.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} detected. ${eventData.details || ''}`,
      variant: "destructive",
      duration: 3000,
    });
  }, [isDemoMode, toast, shouldRenderProctoringUI]);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examDetails.exam_id,
    enabled: !isDemoMode && examStarted && shouldRenderProctoringUI,
    onFlagEvent: (event) => handleBrowserFlagEventInternal({ type: event.type, details: event.details }),
  });

  useEffect(() => {
    if (isDemoMode || !examStarted || !shouldRenderProctoringUI) return;
    const cleanupInputRestriction = addInputRestrictionListeners(handleBrowserFlagEventInternal);
    const onContextMenu = (e: MouseEvent) => disableContextMenu(e, handleBrowserFlagEventInternal);
    const onKeyDown = (e: KeyboardEvent) => attemptBlockShortcuts(e, handleBrowserFlagEventInternal);
    const onCopy = (e: ClipboardEvent) => disableCopyPaste(e, handleBrowserFlagEventInternal);
    const onPaste = (e: ClipboardEvent) => disableCopyPaste(e, handleBrowserFlagEventInternal);

    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);

    return () => {
      cleanupInputRestriction();
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [isDemoMode, examStarted, shouldRenderProctoringUI, handleBrowserFlagEventInternal]);

  const handleTimeUpCallback = useCallback(async () => {
    if (parentIsLoading || !examStarted || isSubmittingInternally || !actualExamStartTimeState) return;
    setIsSubmittingInternally(true);
    toast({ title: isDemoMode ? "Demo Time's Up!" : "Time's Up!", description: isDemoMode ? "The demo exam duration has ended." : "Auto-submitting your exam.", variant: isDemoMode ? "default" : "destructive" });
    await onTimeUpRef.current(answers, [], actualExamStartTimeState); 
  }, [answers, isDemoMode, toast, parentIsLoading, examStarted, isSubmittingInternally, actualExamStartTimeState]);

  useEffect(() => {
    if (!examStarted) return;
    if (timeLeftSeconds <= 0) {
      if (!isSubmittingInternally) {
        handleTimeUpCallback();
      }
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeftSeconds(prevTime => Math.max(0, prevTime - 1));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeftSeconds, handleTimeUpCallback, examStarted, isSubmittingInternally]);

  const emitMediaPipeFlag = useCallback((type: FlaggedEventType, details?: string) => {
    if (!shouldRenderProctoringUI) return;
    const now = Date.now();
    if (lastFlagTimesRef.current[type] && (now - lastFlagTimesRef.current[type] < FLAG_COOLDOWN_MS)) {
      console.log(`[MediaPipeFlag Throttled] Type: ${type}`);
      return;
    }
    console.log(`[MediaPipeFlag Emitted] Type: ${type}, Details: ${details || 'N/A'}`);
    lastFlagTimesRef.current[type] = now;
    onMediaPipeFlagRef.current({ type, details });
  }, [shouldRenderProctoringUI, onMediaPipeFlagRef]);

  const predictWebcam = useCallback(async () => {
    if (!faceLandmarkerRef.current || !videoRef.current || !canvasRef.current) {
      if (faceLandmarkerRef.current && requestRef.current) requestAnimationFrame(predictWebcam);
      return;
    }
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    const canvas = canvasRef.current;

    if (video.paused || video.ended || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      if (faceLandmarkerRef.current) requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }
    
    canvas.width = proctorUiSize.width;
    canvas.height = proctorUiSize.height;

    let results;
    try {
      results = landmarker.detectForVideo(video, performance.now());
    } catch (detectError: any) {
      console.error("[ExamTakingInterface] Error during MediaPipe detectForVideo:", detectError.message, detectError);
      if (faceLandmarkerRef.current) requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    if (results) {
      if (results.faceLandmarks.length === 0) {
        if (lastNoFaceTimeRef.current === null) {
          lastNoFaceTimeRef.current = Date.now();
        } else if (Date.now() - lastNoFaceTimeRef.current > NO_FACE_TIMEOUT_MS) {
          emitMediaPipeFlag('NO_FACE_DETECTED', 'No face detected for over 3 seconds.');
        }
      } else {
        lastNoFaceTimeRef.current = null;
        if (results.faceLandmarks.length > 1) {
          emitMediaPipeFlag('MULTIPLE_FACES_DETECTED', `Multiple faces (${results.faceLandmarks.length}) detected.`);
        } else if (results.faceBlendshapes?.[0]?.categories) {
          const headYawCategory = results.faceBlendshapes[0].categories.find(c => c.categoryName === 'headYaw');
          if (headYawCategory && Math.abs(headYawCategory.score) > HEAD_YAW_THRESHOLD) {
            emitMediaPipeFlag('USER_LOOKING_AWAY', `Head turned significantly (Yaw: ${headYawCategory.score.toFixed(2)}).`);
          }
        }
      }
    }
    
    const canvasCtx = canvas.getContext("2d");
    if (canvasCtx && video.videoWidth > 0 && video.videoHeight > 0) {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (drawError: any) {
        console.error("[ExamTakingInterface] Error during canvas drawImage:", drawError.message, drawError);
      }
    }
    
    if (faceLandmarkerRef.current) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [emitMediaPipeFlag, proctorUiSize]);

  useEffect(() => {
    const videoElement = videoRef.current;
    let vision: FilesetResolver | null = null;
    let localStreamForCleanup: MediaStream | null = null;

    const cleanupProctoring = () => {
      console.log("[ExamTakingInterface Cleanup] Starting cleanup...");
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
        console.log("[ExamTakingInterface Cleanup] Cancelled animation frame.");
      }

      const landmarkerInstanceToClose = faceLandmarkerRef.current;
      faceLandmarkerRef.current = null; // Important: Set to null before async close

      if (landmarkerInstanceToClose && typeof landmarkerInstanceToClose.close === 'function') {
        console.log("[ExamTakingInterface Cleanup] Closing FaceLandmarker instance...");
        try {
          const closePromise = landmarkerInstanceToClose.close();
          if (closePromise && typeof closePromise.then === 'function') {
            closePromise
              .then(() => console.log("[ExamTakingInterface Cleanup] FaceLandmarker closed successfully via promise."))
              .catch((e: any) => {
                if (e?.message?.includes("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.")) {
                  console.warn("[ExamTakingInterface Cleanup] MediaPipe Info during close (async):", e.message);
                } else {
                  console.error("[ExamTakingInterface Cleanup] Error closing FaceLandmarker (async):", e);
                }
              });
          } else {
            console.warn("[ExamTakingInterface Cleanup] FaceLandmarker.close() did not return a promise.");
          }
        } catch (syncCloseError: any) {
           if (syncCloseError?.message?.includes("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.")) {
              console.warn("[ExamTakingInterface Cleanup] MediaPipe Info during close (sync):", syncCloseError.message);
           } else {
              console.error("[ExamTakingInterface Cleanup] Error closing FaceLandmarker (sync):", syncCloseError);
           }
        }
      } else {
        console.log("[ExamTakingInterface Cleanup] No active FaceLandmarker instance to close or close is not a function.");
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        console.log("[ExamTakingInterface Cleanup] Stopped localStreamRef tracks.");
      }
      
      if (videoElement && videoElement.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        console.log("[ExamTakingInterface Cleanup] Stopped videoElement srcObject tracks.");
      }
      setIsWebcamInitialized(false);
      console.log("[ExamTakingInterface Cleanup] Completed. isWebcamInitialized set to false.");
    };

    const setupWebcamAndFaceLandmarker = async () => {
      console.log("[ExamTakingInterface Setup] Attempting to setup webcam and FaceLandmarker...");
      setIsWebcamInitialized(false); 
      setWebcamError(null);
      
      if (!videoElement) {
        console.error("[ExamTakingInterface Setup] Video element ref not found.");
        setWebcamError("Video element not available.");
        onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: "Video element ref missing."});
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 } } });
        console.log("[ExamTakingInterface Setup] User media stream obtained.");
        localStreamRef.current = stream;
        localStreamForCleanup = stream; // For cleanup
        videoElement.srcObject = stream;

        videoElement.onloadedmetadata = async () => {
          console.log("[ExamTakingInterface Setup] Video metadata loaded.");
          try {
            await videoElement.play();
          } catch (playError: any) {
            console.error("[ExamTakingInterface Setup] Video play() promise rejected:", playError.message, playError);
            setWebcamError(playError.message || "Failed to start video playback.");
            onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: `Video play error: ${playError.message}` });
            setIsWebcamInitialized(false); 
          }
        };
        
        videoElement.onplaying = async () => {
          console.log("[ExamTakingInterface Setup] Video is now actively playing. Initializing MediaPipe...");
          setIsWebcamInitialized(false); setWebcamError(null); // Reset before MediaPipe init attempt
          try {
            vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
            const landmarker = await FaceLandmarker.createFromOptions(vision, {
              baseOptions: { 
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, 
                delegate: "CPU" // Force CPU delegate
              },
              outputFaceBlendshapes: true, 
              runningMode: VisionRunningMode.VIDEO, 
              numFaces: 2,
            });
            console.log("[ExamTakingInterface Setup] FaceLandmarker initialized successfully.");
            faceLandmarkerRef.current = landmarker; 
            setIsWebcamInitialized(true); 
            setWebcamError(null);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            requestRef.current = requestAnimationFrame(predictWebcam);
          } catch (landmarkerError: any) {
            let actualErrorMessage = landmarkerError.message || "Failed to initialize MediaPipe FaceLandmarker.";
            console.error("[ExamTakingInterface Setup] Error initializing FaceLandmarker:", actualErrorMessage, landmarkerError);
            setWebcamError(actualErrorMessage);
            onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: `MediaPipe init error: ${actualErrorMessage.substring(0,100)}` });
            setIsWebcamInitialized(false); 
          }
        };
      } catch (err: any) {
        let flagType: FlaggedEventType = 'WEBCAM_UNAVAILABLE'; 
        let actualErrorMessage = err.message || "Webcam is unavailable or access was denied.";
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") flagType = 'WEBCAM_UNAVAILABLE';
        else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") flagType = 'WEBCAM_PERMISSION_DENIED';
        
        console.error(`[ExamTakingInterface Setup] Error getting user media (${err.name}):`, actualErrorMessage, err);
        setWebcamError(actualErrorMessage); 
        onMediaPipeFlagRef.current({ type: flagType, details: actualErrorMessage }); 
        setIsWebcamInitialized(false); 
      }
    };

    if (examStarted && shouldRenderProctoringUI) {
      setupWebcamAndFaceLandmarker();
    } else {
      cleanupProctoring();
    }

    return cleanupProctoring;
  }, [examStarted, shouldRenderProctoringUI, onMediaPipeFlagRef, predictWebcam]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && (!isWebcamInitialized || webcamError) && shouldRenderProctoringUI) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(50,50,50,0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '10px Arial';
        const message = webcamError || 'Webcam off / Initializing...';
        const lines = []; const maxCharsPerLine = Math.floor(canvas.width / 6);
        for (let i = 0; i < message.length; i += maxCharsPerLine) lines.push(message.substring(i, i + maxCharsPerLine));
        lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 - (lines.length / 2 - index - 0.5) * 12));
      }
    }
  }, [isWebcamInitialized, webcamError, shouldRenderProctoringUI, proctorUiSize]);

  const handleProctorUiMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!proctoringUiRef.current || !e.target || !(e.target as HTMLElement).classList.contains('proctor-status-bar-drag-handle')) return;
    setIsDraggingProctorUi(true); const rect = proctoringUiRef.current.getBoundingClientRect();
    dragStartOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; e.preventDefault();
  };

  const handleProctorUiMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingProctorUi || !proctoringUiRef.current) return; e.preventDefault();
    let newTop = e.clientY - dragStartOffset.current.y; let newLeft = e.clientX - dragStartOffset.current.x;
    const { offsetWidth, offsetHeight } = proctoringUiRef.current;
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - offsetHeight));
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - offsetWidth));
    setProctorUiPosition({ top: newTop, left: newLeft });
  }, [isDraggingProctorUi]);

  const handleProctorUiMouseUp = useCallback(() => setIsDraggingProctorUi(false), []);

  useEffect(() => {
    if (isDraggingProctorUi) {
      window.addEventListener('mousemove', handleProctorUiMouseMove); window.addEventListener('mouseup', handleProctorUiMouseUp);
    } else {
      window.removeEventListener('mousemove', handleProctorUiMouseMove); window.removeEventListener('mouseup', handleProctorUiMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleProctorUiMouseMove); window.removeEventListener('mouseup', handleProctorUiMouseUp);
    };
  }, [isDraggingProctorUi, handleProctorUiMouseMove, handleProctorUiMouseUp]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault(); setIsResizingProctorUi(true);
    resizeStartInfo.current = { x: e.clientX, y: e.clientY, width: proctorUiSize.width, height: proctorUiSize.height };
  }, [proctorUiSize]);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingProctorUi) return; e.preventDefault();
    const dx = e.clientX - resizeStartInfo.current.x; const dy = e.clientY - resizeStartInfo.current.y;
    let newWidth = resizeStartInfo.current.width + dx; let newHeight = resizeStartInfo.current.height + dy;
    newWidth = Math.max(MIN_PROCTOR_UI_WIDTH, Math.min(newWidth, MAX_PROCTOR_UI_WIDTH));
    newHeight = Math.max(MIN_PROCTOR_UI_HEIGHT, Math.min(newHeight, MAX_PROCTOR_UI_HEIGHT));
    setProctorUiSize({ width: newWidth, height: newHeight });
  }, [isResizingProctorUi]);

  const handleResizeMouseUp = useCallback(() => setIsResizingProctorUi(false), []);

  useEffect(() => {
    if (isResizingProctorUi) {
      window.addEventListener('mousemove', handleResizeMouseMove); window.addEventListener('mouseup', handleResizeMouseUp);
    } else {
      window.removeEventListener('mousemove', handleResizeMouseMove); window.removeEventListener('mouseup', handleResizeMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove); window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [isResizingProctorUi, handleResizeMouseMove, handleResizeMouseUp]);

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    if (isSubmittingInternally) return;
    setAnswers((prevAnswers) => ({ ...prevAnswers, [questionId]: optionId }));
    onAnswerChange(questionId, optionId);
  }, [onAnswerChange, isSubmittingInternally]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
  }, [currentQuestionIndex, questions.length]);

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (!allowBacktracking) {
        toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
    }
  }, [allowBacktracking, currentQuestionIndex, toast]);

  const handleQuestionNavigation = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      if (!allowBacktracking && index < currentQuestionIndex) { toast({ description: "Backtracking is not allowed for this exam.", variant: "default" }); return; }
      setCurrentQuestionIndex(index);
    }
  }, [allowBacktracking, currentQuestionIndex, questions.length, toast]);

  const handleToggleMarkForReview = useCallback(() => {
    if (currentQuestion?.id) setMarkedForReview(prev => ({ ...prev, [currentQuestion.id!]: !prev[currentQuestion.id!] }));
  }, [currentQuestion?.id]);

  const confirmAndSubmitExam = async () => {
    if (parentIsLoading || isSubmittingInternally || !actualExamStartTimeState) return;
    setIsSubmittingInternally(true); setShowSubmitConfirm(false);
    await onSubmitExamRef.current(answers, [], actualExamStartTimeState);
  };

  const currentQuestionId = currentQuestion?.id;
  const memoizedOnRadioValueChange = useCallback((optionId: string) => {
    if (currentQuestionId) handleInternalAnswerChange(currentQuestionId, optionId);
  }, [currentQuestionId, handleInternalAnswerChange]);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const totalQuestions = questions.length; const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  if (parentIsLoading && !isSubmittingInternally) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md p-6 text-center text-foreground">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 stroke-[1.5px]" />
          <h2 className="text-xl font-medium mb-2">Submitting Exam...</h2><p className="text-sm text-muted-foreground">Please wait.</p>
      </div>);
  }
  if (isSubmittingInternally && !parentIsLoading) {
     return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md p-6 text-center text-foreground">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-6 stroke-[1.5px]" />
          <h2 className="text-xl font-medium mb-2">Processing Submission...</h2><p className="text-sm text-muted-foreground">Please wait.</p>
      </div>);
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground">
      <video ref={videoRef} className="absolute -left-[9999px] -top-[9999px]" autoPlay playsInline muted width="320" height="240" />
      
      {shouldRenderProctoringUI && (
        <div
          ref={proctoringUiRef}
          className="fixed z-[60] bg-card/80 dark:bg-slate-800/80 backdrop-blur-md rounded-lg shadow-xl border border-border dark:border-slate-700/50 flex flex-col select-none"
          style={{ 
            top: `${proctorUiPosition.top}px`, left: `${proctorUiPosition.left}px`, 
            width: `${proctorUiSize.width}px`, height: `${proctorUiSize.height + STATUS_BAR_HEIGHT}px`,
            cursor: isDraggingProctorUi ? 'grabbing' : 'default'
          }}
        >
          <div
            className="proctor-status-bar-drag-handle p-1.5 flex items-center gap-2 border-b border-border/50 dark:border-slate-700/30 cursor-grab"
            style={{ height: `${STATUS_BAR_HEIGHT}px`}}
            onMouseDown={handleProctorUiMouseDown}
          >
            <div className={cn("ping", isWebcamInitialized && !webcamError ? "ping-green" : "ping-red")}></div>
            <span className="text-xs font-medium text-muted-foreground">
              {webcamError ? `Error: ${webcamError.substring(0,15)}...` : (isWebcamInitialized ? "Proctoring Active" : "Proctoring Off")}
            </span>
            <Move className="h-3.5 w-3.5 text-muted-foreground/70 ml-auto cursor-grab" />
          </div>
          <div className="relative flex-grow rounded-b-lg overflow-hidden">
             <canvas ref={canvasRef} width={proctorUiSize.width} height={proctorUiSize.height} className="w-full h-full object-contain" />
            {(!isWebcamInitialized || webcamError) && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-700/80 rounded-b-lg text-center text-xs text-slate-300 p-2">
                  <CameraOffIcon className="h-6 w-6 text-slate-400 mb-1" />
                  {webcamError ? `Error: ${webcamError.substring(0,50)}${webcamError.length > 50 ? '...' : ''}` : "Webcam off / init..."}
              </div>
            )}
          </div>
          <div 
            className="absolute bottom-0 right-0 w-5 h-5 bg-primary/30 hover:bg-primary/60 cursor-se-resize rounded-tl-md flex items-center justify-center"
            onMouseDown={handleResizeMouseDown} title="Resize Proctoring Window"
          > <Maximize2 className="w-3 h-3 text-primary-foreground pointer-events-none"/> </div>
        </div>
      )}

      <header className={cn("sticky top-0 h-20 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-card shadow-sm shrink-0 z-40", shouldRenderProctoringUI && "pt-2")}>
        <div className="flex items-center gap-2"><Image src={logoAsset} alt="ProctorPrep Logo" width={180} height={45} className="h-16 w-auto" /></div>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/60">
            <AvatarImage src={studentAvatarUrl || undefined} alt={studentName || 'Student'} />
            <AvatarFallback className="bg-muted text-muted-foreground">{(studentName || "S").charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{studentName || (isDemoMode ? "Demo Teacher" : "Test Student")}</p>
            <p className="text-xs text-muted-foreground">ID: {studentRollNumber || (isDemoMode ? "T00000" : "S00000")}</p>
          </div>
        </div>
      </header>

      <div className="sticky top-20 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-card shadow-sm shrink-0 z-40">
        <div className="flex items-center gap-2 text-foreground">
          <Clock size={20} className="text-primary stroke-[1.5px]" /><span className="font-medium text-sm">Time remaining:</span>
          <span className="font-semibold text-md tabular-nums text-primary">{formatTime(timeLeftSeconds)}</span>
        </div>
        <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
            <AlertDialogTrigger asChild>
                 <Button variant="destructive" disabled={parentIsLoading || isSubmittingInternally} className="px-6 py-2 text-sm rounded-md font-medium shadow-md hover:shadow-lg transition-all btn-gradient-destructive">
                    <LogOut className="mr-2 h-4 w-4 stroke-[1.5px]"/>Submit Exam
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card border-border bg-card text-card-foreground z-[70]">
                <AlertDialogHeader><AlertDialogTitle className="text-foreground">Confirm Submission</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                    Are you sure you want to submit the exam? This action cannot be undone.
                    {Object.keys(answers).length < totalQuestions && ` You have ${totalQuestions - Object.keys(answers).length} unanswered question(s).`}
                </AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel className="btn-outline-subtle" disabled={isSubmittingInternally || parentIsLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmAndSubmitExam} className="btn-gradient-destructive" disabled={isSubmittingInternally || parentIsLoading}>
                    {(isSubmittingInternally || parentIsLoading) && <Loader2 className="animate-spin mr-2 h-4 w-4 stroke-[1.5px]" />}Yes, Submit Exam
                </AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>

      <main className={cn("flex-1 flex flex-col py-6 px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 overflow-y-auto", shouldRenderProctoringUI ? "mt-2" : "")}>
        <div className="w-full bg-card border border-border rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-lg sm:text-xl font-semibold text-primary">Question {currentQuestionIndex + 1} <span className="text-sm font-normal text-muted-foreground">of {totalQuestions}</span></p>
            <Button variant="ghost" size="icon" onClick={handleToggleMarkForReview} title={markedForReview[currentQuestion?.id || ''] ? "Unmark for Review" : "Mark for Review"} disabled={parentIsLoading || isSubmittingInternally} className="text-muted-foreground hover:text-yellow-500">
                <Bookmark className={cn("h-5 w-5 stroke-[1.5px]", markedForReview[currentQuestion?.id || ''] ? "fill-yellow-400 text-yellow-500" : "")} />
            </Button>
          </div>
          <h2 className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed">{currentQuestion?.text}</h2>
        </div>

        {currentQuestion && (
          <div className="w-full bg-card border border-border rounded-lg shadow-lg p-6 sm:p-8">
            <RadioGroup key={currentQuestion.id} value={answers[currentQuestion.id] || ''} onValueChange={memoizedOnRadioValueChange}
              className={cn("grid gap-4", currentQuestion.options.length <= 2 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}
              disabled={parentIsLoading || isSubmittingInternally}
            >
              {currentQuestion.options.map((option) => (
                <Label key={option.id} htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                  className={cn("flex items-center space-x-3 p-4 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer text-base", "hover:shadow-md",
                    answers[currentQuestion.id] === option.id ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-700 dark:border-blue-500 dark:text-blue-100"
                      : "bg-card border-border text-card-foreground hover:bg-muted/30 dark:hover:bg-muted/10",
                    (parentIsLoading || isSubmittingInternally) && "cursor-not-allowed opacity-70"
                  )}
                >
                  <RadioGroupItem value={option.id} id={`opt-${currentQuestion.id}-${option.id}`} className="h-5 w-5 border-muted-foreground text-primary focus:ring-primary disabled:opacity-50 shrink-0 stroke-[1.5px]" disabled={parentIsLoading || isSubmittingInternally} />
                  <span className="font-medium leading-snug">{option.text}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 h-20 px-4 sm:px-6 flex items-center justify-between border-t border-border bg-card shadow-sm shrink-0 z-40">
        <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0 || !allowBacktracking || parentIsLoading || isSubmittingInternally} className="px-6 py-3 text-md rounded-lg shadow-sm btn-outline-subtle">
          <ChevronLeft className="mr-2 h-5 w-5 stroke-[1.5px]" /> Previous
        </Button>
        <div className="flex-1 mx-4 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent py-2">
          <div className="flex items-center justify-center gap-2 px-2">
            {questions.map((q, index) => (
              <Button key={q.id} ref={(el) => (questionButtonRefs.current[index] = el)} variant={currentQuestionIndex === index ? "default" : "outline"} size="icon"
                className={cn("h-10 w-10 text-sm rounded-md shrink-0 font-medium shadow", currentQuestionIndex === index ? "btn-primary-solid" : "bg-card border-border text-foreground hover:bg-muted",
                  answers[q.id] && currentQuestionIndex !== index ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 dark:bg-green-700/30 dark:border-green-600 dark:text-green-300" : "",
                  markedForReview[q.id] && currentQuestionIndex !== index && !answers[q.id] ? "bg-purple-100 border-purple-500 text-purple-700 hover:bg-purple-200 dark:bg-purple-700/30 dark:border-purple-600 dark:text-purple-300" : "",
                  markedForReview[q.id] && currentQuestionIndex !== index && answers[q.id] ? "bg-purple-100 border-purple-500 text-purple-700 ring-1 ring-green-500 hover:bg-purple-200 dark:bg-purple-700/30 dark:border-purple-600 dark:text-purple-300 dark:ring-green-400" : "",
                  (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed"
                )} onClick={() => handleQuestionNavigation(index)} disabled={(!allowBacktracking && index < currentQuestionIndex) || parentIsLoading || isSubmittingInternally} title={`Go to Question ${index + 1}`}
              >{index + 1}</Button>
            ))}
          </div>
        </div>
        {isLastQuestion ? (
          <Button onClick={() => setShowSubmitConfirm(true)} disabled={parentIsLoading || isSubmittingInternally} className={cn("px-6 py-3 text-md rounded-lg font-medium shadow-sm btn-gradient-destructive")}>
            <LogOut className="mr-2 h-5 w-5 stroke-[1.5px]" /> Submit Exam
          </Button>
        ) : (
          <Button onClick={handleNextQuestion} disabled={currentQuestionIndex === totalQuestions - 1 || parentIsLoading || isSubmittingInternally} className={cn("px-6 py-3 text-md rounded-lg font-medium shadow-sm btn-primary-solid")}>
            Next <ChevronRight className="ml-2 h-5 w-5 stroke-[1.5px]" />
          </Button>
        )}
      </footer>
    </div>
  );
}
