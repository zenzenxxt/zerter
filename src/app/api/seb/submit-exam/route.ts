// src/app/api/seb/submit-exam/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database, ExamSubmissionInsert, Exam, Question, FlaggedEvent } from '@/types/supabase';

// Helper to get a safe error message
function getSafeErrorMessage(e: any, fallbackMessage = "An unknown error occurred."): string {
    if (e && typeof e === 'object') {
        if (e.name === 'AbortError') {
            return "The request timed out. Please check your connection and try again.";
        }
        if (typeof e.message === 'string' && e.message.trim() !== '') {
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
    return fallbackMessage;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const initLogPrefix = '[API SubmitExam Init]';
let missingVarsMessage = "CRITICAL: Required Supabase environment variable(s) are missing: ";
let criticalError = false;

if (!supabaseUrl) { missingVarsMessage += "NEXT_PUBLIC_SUPABASE_URL "; criticalError = true; }
if (!supabaseServiceKey) { missingVarsMessage += "SUPABASE_SERVICE_ROLE_KEY "; criticalError = true; }

if (criticalError) {
  missingVarsMessage += "Please check server environment configuration.";
  console.error(`${initLogPrefix} ${missingVarsMessage}`);
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : null;

interface StudentSubmissionPayload extends Omit<ExamSubmissionInsert, 'submission_id' | 'score' | 'marks_obtained' | 'total_possible_marks' | 'submitted_at'> {
  answers: Record<string, string> | null;
  flagged_events: FlaggedEvent[] | null; // Ensure this matches what client sends
  started_at: string; // Actual start time from client
}


export async function POST(request: NextRequest) {
  const operationId = `[API SubmitExam POST ${Date.now().toString().slice(-5)}]`;
  if (!supabaseAdmin) {
    let detailedErrorForLog = "Supabase admin client not initialized for submission. ";
    if (!supabaseUrl) detailedErrorForLog += "NEXT_PUBLIC_SUPABASE_URL is missing. ";
    if (!supabaseServiceKey) detailedErrorForLog += "SUPABASE_SERVICE_ROLE_KEY is missing. ";
    detailedErrorForLog += "Check server environment variables.";
    console.error(`${operationId} ${detailedErrorForLog}`);
    return NextResponse.json({ error: 'Server configuration error for submission.' }, { status: 500 });
  }

  try {
    const studentSubmission = (await request.json()) as StudentSubmissionPayload;

    if (!studentSubmission.exam_id || !studentSubmission.student_user_id || !studentSubmission.started_at) {
      const errMsg = "Missing exam_id, student_user_id, or started_at in submission.";
      console.warn(`${operationId} ${errMsg} Data:`, studentSubmission);
      return NextResponse.json({ error: 'Missing exam ID, student ID, or actual start time.' }, { status: 400 });
    }

    const { data: examData, error: examFetchError } = await supabaseAdmin
      .from('ExamX')
      .select('questions')
      .eq('exam_id', studentSubmission.exam_id)
      .single();

    if (examFetchError || !examData || !examData.questions) {
      const errorMsg = getSafeErrorMessage(examFetchError, `Exam details (ID: ${studentSubmission.exam_id}) not found or has no questions.`);
      console.error(`${operationId} Error fetching exam details for scoring: ${errorMsg}`, examFetchError);
      return NextResponse.json({ error: 'Failed to retrieve exam details for scoring: ' + errorMsg }, { status: 500 });
    }

    const examQuestions: Question[] = examData.questions;
    const studentAnswers = studentSubmission.answers || {};
    let marksObtained = 0;
    let totalPossibleMarks = 0;

    examQuestions.forEach(question => {
      const questionMarks = question.marks || 1;
      totalPossibleMarks += questionMarks;
      if (studentAnswers[question.id] === question.correctOptionId) {
        marksObtained += questionMarks;
      }
    });

    const percentageScore = totalPossibleMarks > 0 ? parseFloat(((marksObtained / totalPossibleMarks) * 100).toFixed(2)) : 0;

    const dataToUpsert: ExamSubmissionInsert = {
      exam_id: studentSubmission.exam_id,
      student_user_id: studentSubmission.student_user_id,
      answers: studentSubmission.answers,
      status: studentSubmission.status || 'Completed',
      score: percentageScore,
      marks_obtained: marksObtained,
      total_possible_marks: totalPossibleMarks,
      submitted_at: new Date().toISOString(), // Server sets submission time
      flagged_events: studentSubmission.flagged_events || null,
      started_at: studentSubmission.started_at, // Use actual start time from payload
    };

    console.log(`${operationId} Attempting to upsert submission for student: ${studentSubmission.student_user_id}, exam: ${studentSubmission.exam_id}. Score: ${percentageScore}%, Marks: ${marksObtained}/${totalPossibleMarks}, Started At: ${studentSubmission.started_at}`);

    const { data, error } = await supabaseAdmin
      .from('ExamSubmissionsX')
      .upsert(dataToUpsert, {
        onConflict: 'exam_id, student_user_id',
      })
      .select()
      .single();

    if (error) {
      const upsertErrorMsg = getSafeErrorMessage(error, 'Supabase upsert failed.');
      console.error(`${operationId} Supabase error during submission upsert:`, upsertErrorMsg, error);
      return NextResponse.json({ error: 'Failed to save exam submission: ' + upsertErrorMsg }, { status: 500 });
    }

    console.log(`${operationId} Submission successful for student: ${studentSubmission.student_user_id}, exam: ${studentSubmission.exam_id}, Result:`, data);
    return NextResponse.json({ message: 'Exam submitted successfully.', submission_id: data?.submission_id, score: data?.score, marks_obtained: data?.marks_obtained, total_possible_marks: data?.total_possible_marks }, { status: 200 });

  } catch (e: any) {
    const errorMessage = getSafeErrorMessage(e, 'An unexpected error occurred during submission.');
    console.error(`${operationId} Exception:`, errorMessage, e);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
