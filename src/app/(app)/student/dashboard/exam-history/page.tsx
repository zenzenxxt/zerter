
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ExamHistoryItem {
  submission_id: string; 
  exam_id: string;
  exam_title: string; 
  submission_date: string;
  score: number | null;
  status: 'Completed' | 'In Progress' | 'Not Started';
}

export default function ExamHistoryPage() {
  const [examHistory, setExamHistory] = useState<ExamHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    // Placeholder - actual fetching from 'ExamSubmissionsX' is upcoming
    await new Promise(resolve => setTimeout(resolve, 500)); 
    setExamHistory([]); 
    setIsLoading(false);
  }, [user, toast, supabase]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exam history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title is now part of the new layout's header */}
      {/* <h1 className="text-3xl font-bold">Exam History</h1> */}
      <div className="card-3d"> {/* Applied card-3d style */}
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-slate-700">Your Past Exams</CardTitle>
          <CardDescription className="text-sm text-slate-500">Review your performance in previous exams. (This feature is upcoming)</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {examHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-600">Exam Title</TableHead>
                  <TableHead className="text-slate-600">Date Submitted</TableHead>
                  <TableHead className="text-slate-600">Score</TableHead>
                  <TableHead className="text-slate-600">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examHistory.map((exam) => (
                  <TableRow key={exam.submission_id} className="border-slate-200">
                    <TableCell className="font-medium text-slate-700">{exam.exam_title}</TableCell>
                    <TableCell className="text-slate-600">{exam.submission_date}</TableCell>
                    <TableCell className="text-slate-600">{exam.score !== null ? `${exam.score}%` : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        exam.status === 'Completed' ? 'default' :
                          exam.status === 'In Progress' ? 'secondary' :
                            'outline'
                      }
                        className={
                          exam.status === 'Completed' ? 'bg-green-500/80 text-white' :
                            exam.status === 'In Progress' ? 'bg-yellow-500/80 text-white' : 
                            'border-slate-300 text-slate-500'
                        }
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-16 w-16 text-slate-400 mb-4" />
              <p className="text-lg text-slate-500">You haven&apos;t completed any exams yet.</p>
              <p className="text-sm text-slate-400">Your completed exams will appear here once exam submission is implemented.</p>
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}

    