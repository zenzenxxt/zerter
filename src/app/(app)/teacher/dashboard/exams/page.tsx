
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Share2, Eye, Copy, BookOpenCheck, Loader2, Users2, CalendarClock, ClockIcon, CheckCircleIcon, PlayCircleIcon, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Exam, ExamStatus } from '@/types/supabase';
import { format, parseISO, isBefore, isAfter, isValid } from 'date-fns';
import { getEffectiveExamStatus } from './[examId]/details/page';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface CategorizedExams {
  ongoing: Exam[];
  upcoming: Exam[];
  completed: Exam[];
}

export default function ManageExamsPage() {
  const supabase = createSupabaseBrowserClient();
  const { user } = useAuth();
  const [categorizedExams, setCategorizedExams] = useState<CategorizedExams>({ ongoing: [], upcoming: [], completed: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const fetchAndCategorizeExams = useCallback(async () => {
    if (!user || !user.user_id) {
      setIsLoading(false);
      setCategorizedExams({ ongoing: [], upcoming: [], completed: [] });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ExamX')
        .select('*')
        .eq('teacher_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const examsData = data || [];
      const newCategorizedExams: CategorizedExams = { ongoing: [], upcoming: [], completed: [] };

      examsData.forEach(exam => {
        const effectiveStatus = getEffectiveExamStatus(exam);

        if (effectiveStatus === 'Ongoing') newCategorizedExams.ongoing.push(exam);
        else if (effectiveStatus === 'Published') newCategorizedExams.upcoming.push(exam);
        else if (effectiveStatus === 'Completed') newCategorizedExams.completed.push(exam);
      });

      setCategorizedExams(newCategorizedExams);

    } catch (error: any) {
      toast({ title: "Error", description: `Failed to fetch exams: ${error.message}`, variant: "destructive" });
      setCategorizedExams({ ongoing: [], upcoming: [], completed: [] });
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase, toast]);

  useEffect(() => {
    if (user) {
      fetchAndCategorizeExams();
    } else {
      setIsLoading(false);
      setCategorizedExams({ ongoing: [], upcoming: [], completed: [] });
    }
  }, [user, fetchAndCategorizeExams]);


  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ExamX')
        .delete()
        .eq('exam_id', examToDelete.exam_id);

      if (error) throw error;
      toast({ title: "Exam Deleted", description: `Exam "${examToDelete.title}" has been deleted.` });
      fetchAndCategorizeExams();
      setExamToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete exam: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const openDeleteDialog = (exam: Exam) => {
    setExamToDelete(exam);
    setShowDeleteDialog(true);
  };

  const copyExamCode = (code: string) => {
    if (!code) {
      toast({ description: "No exam code to copy.", variant: "default" });
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      toast({ description: `Exam code "${code}" copied to clipboard!` });
    }).catch(err => {
      toast({ description: "Failed to copy code.", variant: "destructive" });
    });
  };

  const getStatusBadgeVariant = (status: ExamStatus): "default" | "secondary" | "destructive" | "outline" => {
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

  const formatTableDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      const date = parseISO(isoString);
      if(!isValid(date)) return 'Invalid Date';
      return format(date, "MMM d, yyyy HH:mm");
    } catch {
      return "Invalid Date";
    }
  };

  const renderExamTable = (exams: Exam[], categoryTitle: string) => {
    if (exams.length === 0) {
      return (
        <div className="py-4 text-center text-slate-500">
          No {categoryTitle.toLowerCase().replace(' exams', '')} exams.
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200">
              <TableHead className="text-slate-600">Title</TableHead>
              <TableHead className="text-slate-600">Effective Status</TableHead>
              <TableHead className="text-slate-600"><CalendarClock className="inline mr-1 h-4 w-4"/>Start Time</TableHead>
              <TableHead className="text-slate-600"><CalendarClock className="inline mr-1 h-4 w-4"/>End Time</TableHead>
              <TableHead className="text-slate-600">Questions</TableHead>
              <TableHead className="text-slate-600">Duration</TableHead>
              <TableHead className="text-slate-600">Exam Code</TableHead>
              <TableHead className="text-right text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.map((exam) => {
              const effectiveStatus = getEffectiveExamStatus(exam);
              return (
              <TableRow key={exam.exam_id} className="border-slate-200">
                <TableCell className="font-medium text-slate-700">{exam.title}</TableCell>
                <TableCell>
                   <Badge
                    variant={getStatusBadgeVariant(effectiveStatus)}
                    className={getStatusBadgeClass(effectiveStatus)}
                  >
                    {effectiveStatus}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600">{formatTableDateTime(exam.start_time)}</TableCell>
                <TableCell className="text-slate-600">{formatTableDateTime(exam.end_time)}</TableCell>
                <TableCell className="text-slate-600">{exam.questions?.length || 0}</TableCell>
                <TableCell className="text-slate-600">{exam.duration} min</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => copyExamCode(exam.exam_code!)} className="p-1 h-auto text-blue-600 hover:bg-blue-500/10 disabled:text-slate-400" disabled={!exam.exam_code}>
                    {exam.exam_code || 'N/A'} <Copy className="ml-2 h-3 w-3" />
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-slate-100">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-xl">
                      <DropdownMenuLabel className="text-slate-500">Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild className="text-slate-600 hover:bg-slate-100 hover:text-blue-600 focus:bg-slate-100 focus:text-blue-600">
                        <Link href={`/teacher/dashboard/exams/${exam.exam_id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="text-slate-600 hover:bg-slate-100 hover:text-blue-600 focus:bg-slate-100 focus:text-blue-600">
                        <Link href={`/teacher/dashboard/exams/${exam.exam_id}/details`}><Eye className="mr-2 h-4 w-4" /> View Details</Link>
                      </DropdownMenuItem>
                      {effectiveStatus === 'Ongoing' && (
                         <DropdownMenuItem asChild className="text-slate-600 hover:bg-slate-100 hover:text-blue-600 focus:bg-slate-100 focus:text-blue-600">
                           <Link href={`/teacher/dashboard/exams/${exam.exam_id}/monitor`}><PlayCircleIcon className="mr-2 h-4 w-4" /> Monitor Exam</Link>
                         </DropdownMenuItem>
                      )}
                       <DropdownMenuItem asChild className="text-slate-600 hover:bg-slate-100 hover:text-blue-600 focus:bg-slate-100 focus:text-blue-600">
                        <Link href={`/teacher/dashboard/results/${exam.exam_id}`}><Users2 className="mr-2 h-4 w-4" /> View Results</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyExamCode(exam.exam_code!)} disabled={effectiveStatus === 'Completed' || !exam.exam_code} className="text-slate-600 hover:bg-slate-100 hover:text-blue-600 focus:bg-slate-100 focus:text-blue-600 disabled:opacity-50">
                        <Share2 className="mr-2 h-4 w-4" /> Share Code
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-200"/>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(exam)}
                        className="text-red-600 hover:bg-red-50 focus:text-red-700 focus:bg-red-100"
                        disabled={effectiveStatus === 'Ongoing'}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>
    );
  };

  const examCategories = [
    { title: "Ongoing Exams", data: categorizedExams.ongoing, icon: <PlayCircleIcon className="h-5 w-5 text-yellow-500" />, defaultOpen: true },
    { title: "Upcoming Exams", data: categorizedExams.upcoming, icon: <ClockIcon className="h-5 w-5 text-blue-500" />, defaultOpen: true },
    { title: "Completed Exams", data: categorizedExams.completed, icon: <CheckCircleIcon className="h-5 w-5 text-green-500" /> },
  ];


  if (isLoading && Object.values(categorizedExams).every(arr => arr.length === 0)) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-slate-500">Loading exams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Manage Exams</h1>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-md hover:shadow-lg">
          <Link href="/teacher/dashboard/exams/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
          </Link>
        </Button>
      </div>

      <div className="card-3d">
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-slate-700">Your Exams Dashboard</CardTitle>
          <CardDescription className="text-sm text-slate-500">View, edit, and manage all your created exams, categorized by their current status.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {!isLoading && Object.values(categorizedExams).every(arr => arr.length === 0) ? (
            <Alert className="border-blue-500/20 bg-blue-50 text-blue-700">
                <Info className="h-5 w-5 text-blue-500" />
                <AlertTitle className="font-semibold text-blue-600">No Exams Yet</AlertTitle>
                <AlertDescription>
                You haven&apos;t created any exams. Click &quot;Create New Exam&quot; to get started.
                </AlertDescription>
            </Alert>
          ) : (
            <Accordion type="multiple" defaultValue={examCategories.filter(c=>c.defaultOpen).map(c => c.title)} className="w-full">
              {examCategories.map(category => (
                <AccordionItem value={category.title} key={category.title} className="border-slate-200">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline text-slate-700 hover:bg-slate-100 px-4 py-3 rounded-t-md data-[state=open]:bg-slate-100">
                    <div className="flex items-center gap-2">
                        {category.icon} {category.title} ({category.data.length})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t-0 border-slate-200 p-0"> {/* Removed padding from content to let table handle it */}
                    {renderExamTable(category.data, category.title)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white border-slate-200 shadow-xl rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-800">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. This will permanently delete the exam
              &quot;{examToDelete?.title}&quot; and all its associated data (questions, submissions). Ongoing exams cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExamToDelete(null)} className="border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExam}
              className="logout-button-gradient-light"
              disabled={isDeleting || getEffectiveExamStatus(examToDelete) === 'Ongoing'}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
