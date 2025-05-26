
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Share2, Trash2, Clock, CheckSquare, ListChecks, Copy, Loader2, AlertTriangle, Users2, CalendarClock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question, ExamStatus } from '@/types/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { format, parseISO, isBefore, isAfter, isValid, type Duration } from 'date-fns';


export const getEffectiveExamStatus = (exam: Exam | null | undefined, currentTime?: Date): ExamStatus => {
  if (!exam) { 
    return 'Published'; 
  }

  const now = currentTime || new Date(); 

  if (exam.status === 'Completed') return 'Completed';

  if (exam.status === 'Published' || exam.status === 'Ongoing') {
    if (!exam.start_time || !exam.end_time) {
      console.warn(`Exam ${exam.exam_id} is ${exam.status} but missing start/end times.`);
      return 'Published'; 
    }
    const startTime = parseISO(exam.start_time);
    const endTime = parseISO(exam.end_time);

    if (!isValid(startTime) || !isValid(endTime)) {
      console.warn(`Exam ${exam.exam_id} has invalid start/end times.`);
      return 'Published'; 
    }

    if (isAfter(now, endTime)) return 'Completed'; 
    if (isAfter(now, startTime) && isBefore(now, endTime)) return 'Ongoing'; 
    if (isBefore(now, startTime)) return 'Published'; 
  }
  
  return exam.status as ExamStatus; 
};


export default function ExamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [effectiveStatus, setEffectiveStatus] = useState<ExamStatus>('Published');
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchExamDetails = useCallback(async () => {
    if (!examId) {
      setIsLoading(false);
      notFound();
      return;
    }
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*, teacher_id') 
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      setExam(data);
      if (data) {
        setEffectiveStatus(getEffectiveExamStatus(data));
      } else {
        notFound();
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to fetch exam details: ${error.message}`, variant: "destructive" });
      setExam(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, toast]);

  useEffect(() => {
    fetchExamDetails();
  }, [fetchExamDetails]);

  useEffect(() => {
    if (exam) {
      const interval = setInterval(() => {
        const newEffectiveStatus = getEffectiveExamStatus(exam);
        if (newEffectiveStatus !== effectiveStatus) {
          setEffectiveStatus(newEffectiveStatus);
        }
      }, 30000); 

      const handleFocus = () => {
         const newEffectiveStatus = getEffectiveExamStatus(exam);
         if (newEffectiveStatus !== effectiveStatus) {
            setEffectiveStatus(newEffectiveStatus);
         }
      };
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [exam, effectiveStatus]); 


  const copyExamCode = () => {
    if (exam?.exam_code) {
      navigator.clipboard.writeText(exam.exam_code).then(() => {
        toast({ description: `Exam code "${exam.exam_code}" copied to clipboard!` });
      }).catch(err => {
        toast({ description: "Failed to copy code.", variant: "destructive" });
      });
    }
  };

  const handleDeleteExam = async () => {
    if (!exam) return;
    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('ExamX')
        .delete()
        .eq('exam_id', exam.exam_id);
      if (deleteError) throw deleteError;
      toast({ title: "Exam Deleted", description: `Exam "${exam.title}" has been deleted successfully.` });
      router.push('/teacher/dashboard/exams');
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete exam: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getStatusBadgeVariant = (status: ExamStatus) => {
    switch (status) {
      case 'Published': return 'default'; 
      case 'Ongoing': return 'destructive'; 
      case 'Completed': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusBadgeClass = (status: ExamStatus) => {
     switch (status) {
      case 'Published': return 'bg-blue-500 hover:bg-blue-600 text-white'; 
      case 'Ongoing': return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      case 'Completed': return 'bg-green-500 hover:bg-green-600 text-white';
      default: return '';
    }
  }

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'Not set';
    try {
      const date = parseISO(isoString);
      if (!isValid(date)) return 'Invalid Date';
      return format(date, "MMM d, yyyy, hh:mm a");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-slate-500">Loading exam details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6 text-center py-10 card-3d p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-slate-700">Exam Not Found</h1>
        <p className="text-slate-500">The exam details could not be loaded. It might have been deleted or the ID is incorrect.</p>
        <Button variant="outline" onClick={() => router.push('/teacher/dashboard/exams')} className="border-slate-300 text-slate-700 hover:bg-slate-100">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
        </Button>
      </div>
    );
  }

  const questionsList = exam.questions || [];
  const isShareable = effectiveStatus !== 'Completed';


  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/teacher/dashboard/exams')} className="mb-4 border-slate-300 text-slate-700 hover:bg-slate-100">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
      </Button>

      <div className="card-3d">
        <CardHeader className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl text-slate-700">{exam.title}</CardTitle>
              <CardDescription className="mt-1 text-slate-500">{exam.description || "No description provided."}</CardDescription>
            </div>
            <Badge
              variant={getStatusBadgeVariant(effectiveStatus)}
              className={`text-sm px-3 py-1 ${getStatusBadgeClass(effectiveStatus)}`}
            >
              Status: {effectiveStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <div>
              <Label className="text-sm font-medium text-slate-500">Exam Code</Label>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-blue-600">{exam.exam_code}</p>
                <Button variant="ghost" size="icon" onClick={copyExamCode} className="h-7 w-7 text-slate-500 hover:text-blue-600">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><Clock className="h-4 w-4" /> Duration</Label>
              <p className="text-lg font-semibold text-slate-700">{exam.duration} minutes</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><CheckSquare className="h-4 w-4" /> Backtracking</Label>
              <p className="text-lg font-semibold text-slate-700">{exam.allow_backtracking ? 'Allowed' : 'Not Allowed'}</p>
            </div>
             <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Start Time</Label>
              <p className="text-lg font-semibold text-slate-700">{formatDateTime(exam.start_time)}</p>
            </div>
             <div>
              <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><CalendarClock className="h-4 w-4" /> End Time</Label>
              <p className="text-lg font-semibold text-slate-700">{formatDateTime(exam.end_time)}</p>
            </div>
             <div>
                <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Database Status</Label>
                <p className="text-lg font-semibold text-slate-700">{exam.status}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2 text-slate-700"><ListChecks className="h-5 w-5 text-blue-500" /> Questions ({questionsList.length})</h3>
            {questionsList.length > 0 ? (
              <ul className="space-y-4 max-h-96 overflow-y-auto pr-2 rounded-md scrollbar-thin scrollbar-thumb-slate-300">
                {questionsList.map((q: Question, index: number) => (
                  <li key={q.id || index} className="p-4 border border-slate-200 rounded-md bg-white shadow-sm">
                    <p className="font-medium text-md mb-1 text-slate-700">Q{index + 1}: {q.text} <span className="text-xs text-blue-500">({q.marks || 1} Marks)</span></p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-4">
                      {q.options.map((opt, i) => (
                        <li key={opt.id || i} className={opt.id === q.correctOptionId ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                          {opt.text} {opt.id === q.correctOptionId && "(Correct)"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 p-4 text-center border border-slate-200 rounded-md bg-slate-50/50">No questions have been added to this exam yet.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-200 p-6 flex-wrap">
          <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams/${exam.exam_id}/edit`)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            <Edit className="mr-2 h-4 w-4" /> Edit Exam
          </Button>
          <Button variant="outline" asChild disabled={effectiveStatus === 'Completed'} className="border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            <Link href={`/teacher/dashboard/results/${exam.exam_id}`} >
                <Users2 className="mr-2 h-4 w-4" /> View Results
            </Link>
          </Button>
          <Button variant="outline" onClick={copyExamCode} disabled={!isShareable} className="border-slate-300 text-slate-700 hover:bg-slate-100">
            <Share2 className="mr-2 h-4 w-4" /> Share Exam Code
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting || effectiveStatus === 'Ongoing'} className="logout-button-gradient-light">
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" /> Delete Exam
          </Button>
        </CardFooter>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white border-slate-200 shadow-xl rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-800">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. This will permanently delete the exam
              "{exam?.title}" and all its associated data. Ongoing exams cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="logout-button-gradient-light" disabled={isDeleting || effectiveStatus === 'Ongoing'}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    