
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Download, User, Hash, Percent, CalendarCheck2, Users, Loader2, AlertTriangle, FileText, Flag, ClockIcon, RefreshCw, BarChartHorizontalBig, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Exam, FlaggedEvent, ExamSubmission } from '@/types/supabase';
import { format, parseISO, differenceInMilliseconds, isValid } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';


interface ExamResultRow {
  student_id: string;
  student_name: string;
  score: number | null; // Percentage
  marks_obtained: number | null;
  total_possible_marks: number | null;
  submission_date_formatted: string;
  time_taken_formatted: string;
  time_taken_ms: number;
  flags_count: number;
  flagged_events_details: FlaggedEvent[] | null;
}

interface ScoreDistributionData {
  name: string; // e.g., "0-10%", "90-100%"
  students: number;
}

interface ExamAnalyticsData {
  averageScorePercent: number | null;
  averageTimeTakenMs: number | null;
  totalParticipants: number;
  scoreDistribution: ScoreDistributionData[];
  flagTypeCounts: Record<string, number>;
}

interface ExamDetailedResult {
  exam_id: string;
  exam_title: string;
  analytics: ExamAnalyticsData;
  scores: ExamResultRow[];
}

function formatDurationCustom(ms: number): string {
    if (ms < 0) return 'N/A';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds >= 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`); 
    return parts.length > 0 ? parts.join(' ') : '0s';
}


export default function ExamSpecificResultsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();
  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [resultData, setResultData] = useState<ExamDetailedResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentFlags, setSelectedStudentFlags] = useState<FlaggedEvent[] | null>(null);
  const [isFlagDialogValid, setIsFlagDialogValid] = useState(false); // Control Dialog open state based on valid data

  const SCORE_RANGES = [
    { name: '0-10%', min: 0, max: 10 }, { name: '11-20%', min: 11, max: 20 },
    { name: '21-30%', min: 21, max: 30 }, { name: '31-40%', min: 31, max: 40 },
    { name: '41-50%', min: 41, max: 50 }, { name: '51-60%', min: 51, max: 60 },
    { name: '61-70%', min: 61, max: 70 }, { name: '71-80%', min: 71, max: 80 },
    { name: '81-90%', min: 81, max: 90 }, { name: '91-100%', min: 91, max: 100 },
  ];

  const BAR_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A4DE6C", "#D0ED57"];


  const fetchExamAndResults = useCallback(async () => {
    if (!examId) {
      setIsLoading(false);
      notFound();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: examData, error: examError } = await supabase
        .from('ExamX')
        .select('exam_id, title, status')
        .eq('exam_id', examId)
        .single();

      if (examError) throw examError;
      if (!examData) throw new Error("Exam not found.");
      setExamDetails(examData as Exam);

      const { data: submissions, error: submissionsError } = await supabase
        .from('ExamSubmissionsX')
        .select('student_user_id, answers, status, score, marks_obtained, total_possible_marks, started_at, submitted_at, flagged_events')
        .eq('exam_id', examId);
      
      if (submissionsError) throw submissionsError;
      const validSubmissions = (submissions || []).filter(sub => sub.status === 'Completed') as ExamSubmission[];
      
      const studentIds = [...new Set(validSubmissions.map(sub => sub.student_user_id).filter(id => id))];
      let studentProfilesMap: Record<string, { name: string }> = {};

      if (studentIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
              .from('proctorX')
              .select('user_id, name')
              .in('user_id', studentIds);

          if (profilesError) {
              console.warn("Failed to fetch student names for results:", profilesError.message);
              toast({ title: "Warning", description: "Could not fetch all student names.", variant: "default" });
          } else if (profiles) {
              profiles.forEach(p => {
                  studentProfilesMap[p.user_id] = { name: p.name || 'Unknown Student' };
              });
          }
      }

      let totalScoreSum = 0;
      let totalTimeTakenMsSum = 0;
      const flagTypeCounts: Record<string, number> = {};
      const scoreDistributionCounts = SCORE_RANGES.map(range => ({ ...range, students: 0 }));


      const scoresData: ExamResultRow[] = validSubmissions
        .map(sub => {
          const submittedAt = parseISO(sub.submitted_at!);
          const startedAt = parseISO(sub.started_at!);
          let timeTakenMs = -1;
          let timeTakenFormatted = 'N/A';

          if (isValid(submittedAt) && isValid(startedAt)) {
              timeTakenMs = differenceInMilliseconds(submittedAt, startedAt);
              timeTakenFormatted = formatDurationCustom(timeTakenMs);
              if (timeTakenMs >= 0) totalTimeTakenMsSum += timeTakenMs;
          }

          if (sub.score !== null) {
              totalScoreSum += sub.score;
              const score = sub.score;
              const rangeIndex = scoreDistributionCounts.findIndex(r => score >= r.min && score <= r.max);
              if (rangeIndex !== -1) scoreDistributionCounts[rangeIndex].students++;
          }
          
          const flags = sub.flagged_events as FlaggedEvent[] | null;
          (flags || []).forEach(flag => {
            flagTypeCounts[flag.type] = (flagTypeCounts[flag.type] || 0) + 1;
          });

          return {
              student_id: sub.student_user_id,
              student_name: studentProfilesMap[sub.student_user_id]?.name || sub.student_user_id,
              score: sub.score,
              marks_obtained: sub.marks_obtained,
              total_possible_marks: sub.total_possible_marks,
              submission_date_formatted: sub.submitted_at ? format(parseISO(sub.submitted_at), "MMM d, yyyy, hh:mm a") : 'N/A',
              time_taken_formatted: timeTakenFormatted,
              time_taken_ms: timeTakenMs,
              flags_count: flags?.length || 0,
              flagged_events_details: flags,
          };
      });
      
      const totalParticipants = validSubmissions.length;
      const averageScorePercent = totalParticipants > 0 ? totalScoreSum / totalParticipants : null;
      const averageTimeTakenMs = totalParticipants > 0 && totalTimeTakenMsSum > 0 ? totalTimeTakenMsSum / totalParticipants : null;

      setResultData({
        exam_id: examData.exam_id,
        exam_title: examData.title,
        analytics: {
            averageScorePercent,
            averageTimeTakenMs,
            totalParticipants,
            scoreDistribution: scoreDistributionCounts,
            flagTypeCounts,
        },
        scores: scoresData.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
      });

    } catch (e: any) {
      console.error("Error fetching exam results:", e);
      setError(e.message || "Failed to load results.");
      setResultData(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, toast]);

  useEffect(() => {
    fetchExamAndResults();
  }, [fetchExamAndResults]);

  const handleViewFlags = (flags: FlaggedEvent[] | null) => {
    setSelectedStudentFlags(flags);
    setIsFlagDialogValid(true); // Open the dialog
  };
  
  const closeFlagDialog = () => {
    setIsFlagDialogValid(false);
    // It's good practice to clear selected data when dialog closes
    setTimeout(() => setSelectedStudentFlags(null), 300); // Delay to allow fade-out
  };


  if (isLoading && !resultData) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-slate-500">Loading results...</p>
      </div>
    );
  }
  
  if (error) {
     return (
       <div className="space-y-6 text-center py-10 card-3d p-6">
         <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
         <h1 className="text-2xl font-semibold text-slate-700">Error Loading Results</h1>
         <p className="text-slate-500">{error}</p>
         <Button variant="outline" onClick={() => router.push('/teacher/dashboard/results')} className="border-slate-300 text-slate-700 hover:bg-slate-100">
           <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Results
         </Button>
       </div>
    );
  }


  if (!resultData || !examDetails) {
    return (
      <div className="space-y-6 text-center py-10 card-3d p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-slate-700">Results Not Found</h1>
        <p className="text-slate-500">Detailed results for this exam could not be loaded.</p>
        <Button variant="outline" onClick={() => router.push('/teacher/dashboard/results')} className="border-slate-300 text-slate-700 hover:bg-slate-100">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Results
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/teacher/dashboard/results')} className="mb-4 border-slate-300 text-slate-700 hover:bg-slate-100">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Results
        </Button>
        <Button onClick={fetchExamAndResults} variant="outline" disabled={isLoading} className="mb-4 border-slate-300 text-slate-700 hover:bg-slate-100">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="card-3d">
        <CardHeader className="p-6">
          <CardTitle className="text-3xl text-slate-700">Results for: {resultData.exam_title}</CardTitle>
          <CardDescription className="text-slate-500">
            Detailed performance of students who have completed this exam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          {/* Analytics Section */}
          <div className="space-y-6 p-4 border border-slate-200 rounded-lg bg-slate-50/50">
            <h3 className="text-xl font-semibold text-slate-700 flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-blue-500" /> Exam Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><Users className="h-4 w-4" /> Total Participants</Label>
                    <p className="text-lg font-semibold text-slate-700">{resultData.analytics.totalParticipants}</p>
                </div>
                <div>
                    <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><Percent className="h-4 w-4" /> Average Score</Label>
                    <p className="text-lg font-semibold text-blue-600">{resultData.analytics.averageScorePercent !== null ? `${resultData.analytics.averageScorePercent.toFixed(2)}%` : 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-medium text-slate-500 flex items-center gap-1"><ClockIcon className="h-4 w-4" /> Avg. Time Taken</Label>
                    <p className="text-lg font-semibold text-slate-700">{resultData.analytics.averageTimeTakenMs !== null ? formatDurationCustom(resultData.analytics.averageTimeTakenMs) : 'N/A'}</p>
                </div>
            </div>
            {resultData.analytics.totalParticipants > 0 && (
                <div className="mt-4">
                    <Label className="text-md font-medium text-slate-600 mb-2 block">Score Distribution</Label>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={resultData.analytics.scoreDistribution} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="students" name="Number of Students" radius={[4, 4, 0, 0]}>
                            {resultData.analytics.scoreDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
             {Object.keys(resultData.analytics.flagTypeCounts).length > 0 && (
                <div className="mt-4">
                    <Label className="text-md font-medium text-slate-600 mb-2 block">Flag Summary</Label>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                        {Object.entries(resultData.analytics.flagTypeCounts).map(([type, count]) =>(
                            <li key={type}><span className="font-semibold">{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span> {count} instance(s)</li>
                        ))}
                    </ul>
                </div>
             )}
             {resultData.analytics.totalParticipants === 0 && (
                <p className="text-sm text-slate-500">No completed submissions yet to generate detailed analytics.</p>
             )}
          </div>


          <h3 className="text-xl font-semibold text-slate-700">Individual Student Scores</h3>
          {resultData.scores.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="text-slate-600"><User className="inline mr-1 h-4 w-4" />Student Name</TableHead>
                    <TableHead className="text-slate-600">Student ID</TableHead>
                    <TableHead className="text-center text-slate-600"><Percent className="inline mr-1 h-4 w-4" />Score</TableHead>
                    <TableHead className="text-center text-slate-600">Marks</TableHead>
                    <TableHead className="text-slate-600"><CalendarCheck2 className="inline mr-1 h-4 w-4" />Submission Time</TableHead>
                    <TableHead className="text-slate-600"><ClockIcon className="inline mr-1 h-4 w-4" />Time Taken</TableHead>
                    <TableHead className="text-center text-slate-600"><Flag className="inline mr-1 h-4 w-4" />Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultData.scores.map((score) => (
                    <TableRow key={score.student_id} className="border-slate-200">
                      <TableCell className="font-medium text-slate-700">{score.student_name}</TableCell>
                      <TableCell className="text-slate-600">{score.student_id}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">
                        {score.score !== null ? `${score.score.toFixed(0)}%` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-center text-slate-600">
                        {score.marks_obtained !== null && score.total_possible_marks !== null ? `${score.marks_obtained}/${score.total_possible_marks}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-slate-600">{score.submission_date_formatted}</TableCell>
                      <TableCell className="text-slate-600">{score.time_taken_formatted}</TableCell>
                      <TableCell className="text-center">
                        {score.flags_count > 0 ? (
                            <Button variant="ghost" size="sm" onClick={() => handleViewFlags(score.flagged_events_details)} className="text-red-600 hover:bg-red-100 p-1 h-auto">
                                {score.flags_count}
                            </Button>
                        ) : (
                            <span className="text-slate-700">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-400 mb-3" />
                <p className="text-md text-slate-500">No student submissions found for this exam yet.</p>
                <p className="text-sm text-slate-400">Student scores will appear here once submissions are recorded.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t border-slate-200 p-6">
          <Button variant="outline" disabled className="border-slate-300 text-slate-700 opacity-50">
            <Download className="mr-2 h-4 w-4" /> Export Results (CSV) - Coming Soon
          </Button>
        </CardFooter>
      </div>
      <Dialog open={isFlagDialogValid} onOpenChange={(open) => { if (!open) closeFlagDialog(); else setIsFlagDialogValid(true); }}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
            <DialogHeader>
                <DialogTitle className="text-slate-700">Flagged Events Details</DialogTitle>
                <DialogDescription className="text-slate-500">Review activity flags for the selected student submission.</DialogDescription>
            </DialogHeader>
            {selectedStudentFlags && selectedStudentFlags.length > 0 ? (
                <ScrollArea className="max-h-[400px] pr-3">
                    <ul className="space-y-2 text-sm">
                        {selectedStudentFlags.map((flag, index) => (
                            <li key={index} className="p-2 border border-slate-200 rounded-md bg-slate-50/50">
                                <p><span className="font-semibold text-slate-600">Type:</span> <span className="text-red-600">{flag.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></p>
                                <p><span className="font-semibold text-slate-600">Timestamp:</span> {format(new Date(flag.timestamp), "MMM d, yyyy, hh:mm:ss a")}</p>
                                {flag.details && <p><span className="font-semibold text-slate-600">Details:</span> {flag.details}</p>}
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            ) : (
                <p className="text-sm text-slate-500 py-4">No flagged events recorded for this submission.</p>
            )}
        </DialogContent>
       </Dialog>
    </div>
  );
}
