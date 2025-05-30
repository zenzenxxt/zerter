
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Clock, Bookmark, ChevronLeft, ChevronRight, LogOut, Move, CameraOff as CameraOffIcon, Maximize2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useActivityMonitor } from '@/hooks/use-activity-monitor';
import { addInputRestrictionListeners, disableContextMenu, attemptBlockShortcuts, disableCopyPaste } from '@/lib/seb-utils';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, FlaggedEvent, FlaggedEventType } from '@/types/supabase';
import { cn } from "@/lib/utils";
import logoAsset from '../../../logo.png';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const FLAG_COOLDOWN_MS = 5000; // 5 seconds
const NO_FACE_TIMEOUT_MS = 3000; // 3 seconds
const HEAD_YAW_THRESHOLD = 0.28; // Approx +/- 25-30 degrees

const INITIAL_PROCTOR_UI_WIDTH = 240;
const INITIAL_PROCTOR_UI_HEIGHT = 180;
const MIN_PROCTOR_UI_WIDTH = 160;
const MIN_PROCTOR_UI_HEIGHT = 120;
const MAX_PROCTOR_UI_WIDTH = 480;
const MAX_PROCTOR_UI_HEIGHT = 360;
const STATUS_BAR_HEIGHT = 32;
const MEDIA_PIPE_SETUP_TIMEOUT_MS = 30000;


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
  const { toast } = useToast();

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
  const [faceLandmarkerError, setFaceLandmarkerError] = useState<string | null>(null);
  // ObjectDetector specific state removed

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  // objectDetectorRef removed
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

  const shouldRenderProctoringUI = useMemo(
    () => (examDetails.enable_webcam_proctoring ?? false) && !isDemoMode,
    [examDetails.enable_webcam_proctoring, isDemoMode]
  );

  useEffect(() => {
    if (examStarted && !actualExamStartTimeState && questions.length > 0 && !parentIsLoading) {
      const startTime = new Date().toISOString();
      setActualExamStartTimeState(startTime);
      console.log("[ETI] Actual exam start time set:", startTime);
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
    if (isDemoMode) return;
    onBrowserFlagRef.current(eventData);
    toast({
      title: "Activity Alert (System)",
      description: `${eventData.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} detected. ${eventData.details || ''}`,
      variant: "destructive",
      duration: 3000,
    });
  }, [isDemoMode, toast]);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examDetails.exam_id,
    enabled: !isDemoMode && examStarted && shouldRenderProctoringUI,
    onFlagEvent: (event) => handleBrowserFlagEventInternal({ type: event.type, details: event.details }),
  });

  useEffect(() => {
    if (isDemoMode || !examStarted || !shouldRenderProctoringUI) return;
    const operationId = `[ETI SecurityListeners ${Date.now().toString().slice(-5)}]`;
    console.log(`${operationId} Adding SEB security event listeners (proctoring enabled).`);
    
    const onContextMenu = (e: MouseEvent) => disableContextMenu(e, handleBrowserFlagEventInternal);
    const onKeyDown = (e: KeyboardEvent) => attemptBlockShortcuts(e, handleBrowserFlagEventInternal);
    const onCopy = (e: ClipboardEvent) => disableCopyPaste(e, handleBrowserFlagEventInternal);
    const onPaste = (e: ClipboardEvent) => disableCopyPaste(e, handleBrowserFlagEventInternal);

    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    const cleanupInputRestriction = addInputRestrictionListeners(handleBrowserFlagEventInternal);

    return () => {
      console.log(`${operationId} Removing SEB security event listeners (proctoring enabled).`);
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
    if (!examStarted || timeLeftSeconds <= 0) {
      if (examStarted && !isSubmittingInternally && timeLeftSeconds <= 0) {
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
      return;
    }
    lastFlagTimesRef.current[type] = now;
    console.log(`[ETI emitMediaPipeFlag] Emitting flag: ${type}, Details: ${details || 'N/A'}`);
    onMediaPipeFlagRef.current({ type, details });
  }, [shouldRenderProctoringUI, onMediaPipeFlagRef]);

  const predictWebcam = useCallback(async () => {
    const frameId = `[ETI predictWebcam ${Date.now().toString().slice(-4)}]`;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = faceLandmarkerRef.current;
  
    if (!video || !canvas || !shouldRenderProctoringUI || !isWebcamInitialized) {
      if (faceLandmarkerRef.current) { // Still try to loop if models were initialized but other conditions changed
        requestRef.current = requestAnimationFrame(predictWebcam);
      }
      return;
    }
  
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) {
      console.error(`${frameId} Canvas context not available.`);
      if (faceLandmarkerRef.current) requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }
  
    canvas.width = proctorUiSize.width;
    canvas.height = proctorUiSize.height;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused && !video.ended) {
      try {
        canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (drawError: any) {
        console.error(`${frameId} Error drawing video to canvas: ${drawError.message}`);
      }
    } else {
      canvasCtx.fillStyle = 'rgba(30, 41, 59, 0.8)'; 
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.fillStyle = 'rgba(203, 213, 225, 0.9)'; 
      canvasCtx.textAlign = 'center';
      canvasCtx.font = '10px Arial';
      canvasCtx.fillText('Video feed loading...', canvas.width / 2, canvas.height / 2);
      console.warn(`${frameId} Video not ready or not playing. State: ${video.readyState}, W: ${video.videoWidth}, H: ${video.videoHeight}, Paused: ${video.paused}`);
    }
  
    const currentTime = performance.now();
    if (landmarker) {
      try {
        const results = landmarker.detectForVideo(video, currentTime);
        if (results && results.faceLandmarks) {
          if (results.faceLandmarks.length === 0) {
            if (lastNoFaceTimeRef.current === null) lastNoFaceTimeRef.current = Date.now();
            else if (Date.now() - lastNoFaceTimeRef.current > NO_FACE_TIMEOUT_MS) emitMediaPipeFlag('NO_FACE_DETECTED', 'No face detected for over 3 seconds.');
          } else {
            lastNoFaceTimeRef.current = null;
            if (results.faceLandmarks.length > 1) emitMediaPipeFlag('MULTIPLE_FACES_DETECTED', `Multiple faces (${results.faceLandmarks.length}) detected.`);
            else if (results.faceBlendshapes?.[0]?.categories) {
              const headYawCategory = results.faceBlendshapes[0].categories.find(c => c.categoryName === 'headYaw');
              if (headYawCategory && Math.abs(headYawCategory.score) > HEAD_YAW_THRESHOLD) {
                emitMediaPipeFlag('USER_LOOKING_AWAY', `Head turned significantly (Yaw: ${headYawCategory.score.toFixed(2)}).`);
              }
            }
          }
        }
      } catch (detectError: any) {
        console.error(`${frameId} Error during FaceLandmarker detectForVideo: ${detectError.message}`);
      }
    }
    // Object detection logic removed
  
    if (faceLandmarkerRef.current) { 
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [emitMediaPipeFlag, proctorUiSize.width, proctorUiSize.height, shouldRenderProctoringUI, isWebcamInitialized]);
  

  useEffect(() => {
    const videoElement = videoRef.current;
    const operationId = `[ETI WebcamSetupEffect ${Date.now().toString().slice(-5)}]`;
    let currentLocalStream: MediaStream | null = null;

    const cleanupProctoringInternal = () => {
      const cleanupId = `${operationId} Cleanup`;
      console.log(`${cleanupId} Initiating cleanup...`);
      if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = undefined; console.log(`${cleanupId} Cancelled animation frame.`); }

      const landmarkerInstanceToClose = faceLandmarkerRef.current;
      faceLandmarkerRef.current = null; 
      if (landmarkerInstanceToClose && typeof landmarkerInstanceToClose.close === 'function') {
        console.log(`${cleanupId} Closing FaceLandmarker instance...`);
        const closePromise = landmarkerInstanceToClose.close();
        if (closePromise && typeof closePromise.then === 'function') {
          closePromise.catch((e:any) => {
            if (e?.message?.includes("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.")) {
              console.warn(`${cleanupId} MediaPipe Info during FaceLandmarker close (async):`, e.message);
            } else {
              console.error(`${cleanupId} Error closing FaceLandmarker (async):`, e);
            }
          });
        } else {
          console.warn(`${cleanupId} FaceLandmarker close() did not return a promise or was undefined.`);
        }
      } else { console.log(`${cleanupId} No FaceLandmarker instance to close or close is not a function.`); }

      // ObjectDetector cleanup removed

      if (currentLocalStream) { currentLocalStream.getTracks().forEach(track => track.stop()); console.log(`${cleanupId} Stopped currentLocalStream tracks.`); currentLocalStream = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(track => track.stop()); console.log(`${cleanupId} Stopped localStreamRef.current tracks.`); localStreamRef.current = null; }

      if (videoElement && videoElement.srcObject) {
        const vidStream = videoElement.srcObject as MediaStream;
        if (vidStream && typeof vidStream.getTracks === 'function') vidStream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null; console.log(`${cleanupId} Stopped videoElement srcObject tracks and cleared srcObject.`);
      } else if (videoElement) { console.log(`${cleanupId} No srcObject on videoElement to stop.`); }

      setIsWebcamInitialized(false); setWebcamError(null);
      setFaceLandmarkerError(null);
      // setObjectDetectorError(null); setIsObjectDetectorInitialized(false); // Removed
      console.log(`${cleanupId} Cleanup finished.`);
    };

    const setupWebcamAndProctoring = async () => {
      const setupId = `${operationId} SetupWAP`;
      console.log(`${setupId} Initiating. examStarted: ${examStarted}, shouldRender: ${shouldRenderProctoringUI}`);
      
      cleanupProctoringInternal(); 

      if (!examStarted || !shouldRenderProctoringUI || !videoElement) {
        if (!videoElement) console.error(`${setupId} Video element ref not found.`);
        else console.log(`${setupId} Conditions not met for setup. examStarted: ${examStarted}, shouldRender: ${shouldRenderProctoringUI}`);
        return;
      }
      console.log(`${setupId} Conditions met. Proceeding with setup.`);

      setIsWebcamInitialized(false); setWebcamError(null);
      setFaceLandmarkerError(null);
      // setObjectDetectorError(null); setIsObjectDetectorInitialized(false); // Removed

      try {
        console.log(`${setupId} Requesting user media...`);
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
        currentLocalStream = stream;
        localStreamRef.current = stream;
        console.log(`${setupId} User media stream obtained. Assigning to video element.`);
        videoElement.srcObject = stream;

        videoElement.onloadedmetadata = async () => {
          console.log(`${setupId} Video metadata loaded. Attempting to play video.`);
          try {
            await videoElement.play();
            console.log(`${setupId} videoElement.play() promise resolved.`);
          } catch (playError: any) {
            const playErrorMsg = playError.message || "Failed to start video playback.";
            console.error(`${setupId} video.play() promise rejected:`, playErrorMsg, playError);
            setWebcamError(playErrorMsg);
            onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: `Video play error: ${playErrorMsg}` });
            setIsWebcamInitialized(false);
          }
        };

        videoElement.onplaying = async () => {
          console.log(`${setupId} Video is now actively playing. Attempting to initialize MediaPipe tasks...`);
          setIsWebcamInitialized(false); setWebcamError(null);
          setFaceLandmarkerError(null);
          // setObjectDetectorError(null); setIsObjectDetectorInitialized(false); // Removed

          const mediaPipeSetupPromise = (async (): Promise<boolean> => {
            let landmarkerInitSuccess = false;
            console.log(`${setupId} Initializing FilesetResolver for Vision Tasks...`);
            const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
            console.log(`${setupId} FilesetResolver initialized.`);

            try {
              console.log(`${setupId} Creating FaceLandmarker...`);
              const landmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "CPU" },
                outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 2,
              });
              faceLandmarkerRef.current = landmarker; landmarkerInitSuccess = true;
              console.log(`${setupId} FaceLandmarker created successfully.`);
              setFaceLandmarkerError(null);
            } catch (flError: any) {
              let flSpecificErrorMsg = flError.message || "Failed to initialize FaceLandmarker.";
              console.error(`${setupId} Error during FaceLandmarker initialization:`, flSpecificErrorMsg, flError);
              setFaceLandmarkerError(flSpecificErrorMsg);
              landmarkerInitSuccess = false;
            }
            // ObjectDetector initialization removed
            return landmarkerInitSuccess;
          })();
          
          const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error(`MediaPipe setup timed out after ${MEDIA_PIPE_SETUP_TIMEOUT_MS / 1000}s.`)), MEDIA_PIPE_SETUP_TIMEOUT_MS)
          );

          try {
            const setupSuccess = await Promise.race([mediaPipeSetupPromise, timeoutPromise]);
            if (setupSuccess) {
              setIsWebcamInitialized(true); setWebcamError(null);
              console.log(`${setupId} FaceLandmarker initialized successfully. Starting prediction loop.`);
              if (requestRef.current) cancelAnimationFrame(requestRef.current);
              requestRef.current = requestAnimationFrame(predictWebcam);
            } else {
              const finalError = faceLandmarkerError || "MediaPipe setup completed but indicated an unexpected failure state.";
              console.error(`${setupId} ${finalError}`);
              setWebcamError(finalError); setIsWebcamInitialized(false);
              onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: finalError.substring(0, 150) });
            }
          } catch (e: any) {
            let specificErrorMsg = e.message || "Failed to initialize MediaPipe task system or timed out.";
            console.error(`${setupId} Error during MediaPipe task system initialization or timeout:`, specificErrorMsg, e);
            setWebcamError(specificErrorMsg); setIsWebcamInitialized(false);
            onMediaPipeFlagRef.current({ type: 'WEBCAM_UNAVAILABLE', details: `MediaPipe system error: ${specificErrorMsg.substring(0, 100)}` });
          }
        };
      } catch (getUserMediaError: any) {
        let flagType: FlaggedEventType = 'WEBCAM_UNAVAILABLE'; let actualErrorMessage = getUserMediaError.message || "Webcam unavailable/denied.";
        if (getUserMediaError.name === "NotFoundError" || getUserMediaError.name === "DevicesNotFoundError") { actualErrorMessage = "No webcam found."; flagType = 'WEBCAM_UNAVAILABLE'; }
        else if (getUserMediaError.name === "NotAllowedError" || getUserMediaError.name === "PermissionDeniedError") { actualErrorMessage = "Webcam permission denied."; flagType = 'WEBCAM_PERMISSION_DENIED'; }
        console.error(`${setupId} Error getting user media (${getUserMediaError.name}):`, actualErrorMessage, getUserMediaError);
        setWebcamError(actualErrorMessage); onMediaPipeFlagRef.current({ type: flagType, details: actualErrorMessage });
        setIsWebcamInitialized(false);
      }
    };

    setupWebcamAndProctoring();
    return cleanupProctoringInternal;
  }, [examStarted, shouldRenderProctoringUI, onMediaPipeFlagRef, predictWebcam]); // predictWebcam added as it's called in setup

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
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
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

  let proctoringStatusText = "Proctoring Off";
  let proctoringStatusDotColor = "ping ping-red";
  let proctoringUiMessage = "Webcam off / init...";

  if (shouldRenderProctoringUI) {
    if (isWebcamInitialized) {
      proctoringStatusText = "Proctoring Active";
      proctoringStatusDotColor = "ping ping-green";
      proctoringUiMessage = ""; // No message if active and feed is shown
    } else if (webcamError || faceLandmarkerError) {
      const errorDetail = webcamError || faceLandmarkerError || "Unknown error";
      proctoringStatusText = `Error: ${errorDetail.substring(0, 20)}${errorDetail.length > 20 ? '...' : ''}`;
      proctoringStatusDotColor = "ping ping-red";
      proctoringUiMessage = faceLandmarkerError ? `Face Detection Error: ${faceLandmarkerError.substring(0,50)}...` : `Webcam Error: ${webcamError ? webcamError.substring(0,50) + '...' : 'Initialization failed'}`;
    } else {
      proctoringStatusText = "Proctoring initializing...";
      proctoringStatusDotColor = "bg-yellow-500 animate-pulse"; // Use a simple pulse if not fully 'ping'
      proctoringUiMessage = "Proctoring initializing...";
    }
  }


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
      <video ref={videoRef} className="absolute -left-[9999px] -top-[9999px]" autoPlay playsInline muted />

      {shouldRenderProctoringUI && (
        <div
          ref={proctoringUiRef}
          className="fixed z-[60] bg-card/80 dark:bg-slate-800/80 backdrop-blur-md rounded-lg shadow-xl border border-border dark:border-slate-700/50 flex flex-col select-none"
          style={{
            top: `${proctorUiPosition.top}px`, left: `${proctorUiPosition.left}px`,
            width: `${proctorUiSize.width}px`, height: `${proctorUiSize.height + STATUS_BAR_HEIGHT}px`,
            cursor: isDraggingProctorUi || isResizingProctorUi ? 'grabbing' : 'default'
          }}
        >
          <div
            className="proctor-status-bar-drag-handle p-1.5 flex items-center gap-2 border-b border-border/50 dark:border-slate-700/30 cursor-grab"
            style={{ height: `${STATUS_BAR_HEIGHT}px` }}
            onMouseDown={handleProctorUiMouseDown}
          >
            <div className={cn(proctoringStatusDotColor, "w-2.5 h-2.5 rounded-full")}></div>
            <span className="text-xs font-medium text-muted-foreground truncate" title={proctoringStatusText}>
              {proctoringStatusText}
            </span>
            <Move className="h-3.5 w-3.5 text-muted-foreground/70 ml-auto cursor-grab" />
          </div>
          <div className="relative flex-grow rounded-b-lg overflow-hidden bg-black"> {/* Added bg-black here for contrast */}
             <canvas
                ref={canvasRef}
                className={cn("w-full h-full")} 
                width={proctorUiSize.width} 
                height={proctorUiSize.height}
             />
            {proctoringUiMessage && (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-700/50 rounded-b-lg text-center text-xs text-slate-300 p-2 pointer-events-none">
                <CameraOffIcon className="h-6 w-6 text-slate-400 mb-1" />
                {proctoringUiMessage}
              </div>
            )}
          </div>
          <div
            className="absolute bottom-0 right-0 w-5 h-5 bg-primary/30 hover:bg-primary/60 cursor-se-resize rounded-tl-md flex items-center justify-center"
            onMouseDown={handleResizeMouseDown} title="Resize Proctoring Window"
          > <Maximize2 className="w-3 h-3 text-primary-foreground pointer-events-none" /> </div>
        </div>
      )}

      <header className={cn("sticky top-0 h-20 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-card shadow-sm shrink-0 z-40", (shouldRenderProctoringUI && proctorUiPosition.top < (64 + STATUS_BAR_HEIGHT) && proctorUiPosition.left < 200) && "pt-2")}>
        <div className="flex items-center gap-2"><Image src={logoAsset} alt="ZenTest Logo" width={180} height={45} className="h-16 w-auto" /></div>
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
              <LogOut className="mr-2 h-4 w-4 stroke-[1.5px]" />Submit Exam
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

      <main className={cn("flex-1 flex flex-col py-6 px-4 sm:px-8 md:px-12 lg:px-16 xl:px-24 overflow-y-auto", (shouldRenderProctoringUI && proctorUiPosition.top < (128 + STATUS_BAR_HEIGHT)) && "pt-2")}>
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
