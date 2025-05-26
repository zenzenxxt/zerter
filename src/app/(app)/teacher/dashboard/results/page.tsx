
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Eye, Users, Percent, Loader2, Info, RefreshCw } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Exam } from '@/types/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ExamResultSummary {
  exam_id: string;
  title: string;
  participants: number;
  averageScore: number | null;
  status: Exam['status'];
  exam_code: string;
}

export default function StudentResultsPage() {
  const [results, setResults] = useState<ExamResultSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchResultsSummary = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: exams, error: examsError } = await supabase
        .from('ExamX')
        .select('exam_id, title, status, exam_code')
        .eq('teacher_id', user.user_id)
        .order('created_at', { ascending: false });

      if (examsError) throw examsError;
      if (!exams) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      const examSummaries = await Promise.all(
        exams.map(async (exam) => {
          const { data: submissions, error: submissionsError } = await supabase
            .from('ExamSubmissionsX')
            .select('score, status')
            .eq('exam_id', exam.exam_id)
            .eq('status', 'Completed');

          if (submissionsError) {
            console.error(`Error fetching submissions for exam ${exam.exam_id}:`, submissionsError.message);
            return {
              exam_id: exam.exam_id,
              title: exam.title,
              participants: 0,
              averageScore: null,
              status: exam.status,
              exam_code: exam.exam_code,
            };
          }

          const completedSubmissions = submissions || [];
          const participants = completedSubmissions.length;
          let averageScore: number | null = null;
          if (participants > 0) {
            const validScores = completedSubmissions.filter(sub => sub.score !== null).map(sub => sub.score as number);
            if (validScores.length > 0) {
                 const totalScore = validScores.reduce((acc, score) => acc + score, 0);
                 averageScore = totalScore / validScores.length;
            }
          }
          return {
            exam_id: exam.exam_id,
            title: exam.title,
            participants,
            averageScore,
            status: exam.status,
            exam_code: exam.exam_code,
          };
        })
      );
      setResults(examSummaries);

    } catch (e: any) {
      toast({title: "Error", description: `Failed to load exam summaries: ${e.message}`, variant: "destructive"})
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user, toast]);

  useEffect(() => {
    fetchResultsSummary();
  }, [fetchResultsSummary]);

  if (isLoading && results.length === 0) { // Show loader only if no results are displayed yet
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-slate-500">Loading exam results summary...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Student Results Overview</h1>
        <Button onClick={fetchResultsSummary} variant="outline" disabled={isLoading} className="border-slate-300 text-slate-700 hover:bg-slate-100">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>
      
      <div className="card-3d">
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold text-slate-700">
            <BarChart3 className="h-6 w-6 text-blue-500" />
            Exam Performance Summary
          </CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Overview of exam performance. Click &quot;View Details&quot; for individual student results.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {results.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-600">Exam Title</TableHead>
                    <TableHead className="text-slate-600">Status</TableHead>
                    <TableHead className="text-center text-slate-600"><Users className="inline-block mr-1 h-4 w-4" /> Participants</TableHead>
                    <TableHead className="text-center text-slate-600"><Percent className="inline-block mr-1 h-4 w-4" /> Average Score</TableHead>
                    <TableHead className="text-right text-slate-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.exam_id} className="border-slate-200">
                      <TableCell className="font-medium text-slate-700">{result.title}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={result.status === 'Published' ? 'default' : result.status === 'Completed' ? 'outline' : 'secondary'}
                          className={
                              result.status === 'Published' ? 'bg-blue-500 text-white hover:bg-blue-600' : 
                              result.status === 'Completed' ? 'bg-green-500 text-white hover:bg-green-600' : 
                              result.status === 'Ongoing' ? 'bg-yellow-500 text-black hover:bg-yellow-600' : ''
                          }
                        >
                          {result.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-slate-600">{result.participants}</TableCell>
                      <TableCell className="text-center text-slate-600">
                        {result.averageScore !== null ? `${result.averageScore.toFixed(2)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild className="border-slate-300 text-slate-700 hover:bg-slate-100">
                          <Link href={`/teacher/dashboard/results/${result.exam_id}`}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert className="border-blue-500/20 bg-blue-50 text-blue-700">
                <Info className="h-5 w-5 text-blue-500" />
                <AlertTitle className="font-semibold text-blue-600">No Results Available</AlertTitle>
                <AlertDescription>
                No exams found or no results available yet. Results for completed exams will appear here.
                </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </div>
    </div>
  );
}
