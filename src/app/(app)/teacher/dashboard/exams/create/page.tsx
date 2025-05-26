
'use client';

import { ExamForm, ExamFormData } from '@/components/teacher/exam-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ExamInsert } from '@/types/supabase'; // Use ExamInsert type
import { useMemo } from 'react'; // Import useMemo

const generateExamCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Define defaultFormData outside the component or memoize it
const defaultFormDataObject: ExamFormData = {
  title: '',
  description: '',
  duration: 60,
  allowBacktracking: true,
  enable_webcam_proctoring: false, // Explicitly false
  questions: [],
  startTime: null,
  endTime: null,
  status: 'Published', // All exams created via form are initially 'Published'
  defaultMarksPerQuestion: 1,
};

export default function CreateExamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  // Memoize defaultFormData to ensure stable reference
  const defaultFormData = useMemo(() => defaultFormDataObject, []);

  const handleCreateExam = async (data: ExamFormData): Promise<{ success: boolean; error?: string; examId?: string }> => {
    if (!user || user.role !== 'teacher') {
      return { success: false, error: "You must be logged in as a teacher to create exams." };
    }
    if (!data.startTime || !data.endTime) {
      return { success: false, error: "Start and end times are required for published exams."};
    }
    if (data.startTime >= data.endTime) {
      return { success: false, error: "End time must be after start time." };
    }
    if (data.questions.length === 0) {
      return { success: false, error: "Please add at least one question to the exam." };
    }

    const newExamData: ExamInsert = {
      teacher_id: user.user_id,
      title: data.title,
      description: data.description || null,
      duration: data.duration,
      allow_backtracking: data.allowBacktracking,
      enable_webcam_proctoring: data.enable_webcam_proctoring, // This will be true or false
      questions: data.questions,
      exam_code: generateExamCode(), // Initial generation
      status: 'Published',
      start_time: data.startTime.toISOString(),
      end_time: data.endTime.toISOString(),
    };

    try {
      let insertedExamId: string | undefined = undefined;
      let lastError: any = null; // To store the actual error object

      for (let i = 0; i < 3; i++) { 
        const { data: attemptData, error: dbError } = await supabase
          .from('ExamX')
          .insert(newExamData)
          .select('exam_id')
          .single();
        
        if (dbError) {
          lastError = dbError;
          if (dbError.code === '23505' && dbError.message.includes('ExamX_exam_code_key')) {
            console.warn('Exam code collision, generating new code and retrying...');
            newExamData.exam_code = generateExamCode(); 
            continue; 
          }
          break; 
        }
        insertedExamId = attemptData?.exam_id;
        lastError = null; 
        break; 
      }

      if (lastError) {
        console.error('Error creating exam after retries (if any):', lastError);
        const errorMessage = 
          typeof lastError.message === 'string' ? lastError.message :
          typeof lastError === 'string' ? lastError :
          JSON.stringify(lastError);
        return { success: false, error: `Database error: ${errorMessage}`};
      }

      if (!insertedExamId) {
         // This case implies no dbError but also no exam_id, which is unusual.
         // Could be a constraint violation that didn't throw a typical Supabase error.
        return { success: false, error: "Failed to create exam. No exam ID returned, and no specific database error. Check constraints (e.g., NOT NULL)." };
      }
      
      return { success: true, examId: insertedExamId };

    } catch (e: any) {
      console.error('Unexpected error during exam creation process:', e);
      const errorMessage = typeof e.message === 'string' ? e.message : JSON.stringify(e);
      return { success: false, error: `An unexpected error occurred: ${errorMessage}` };
    }
  };

  return (
    <div className="space-y-6">
      <ExamForm initialData={defaultFormData} onSave={handleCreateExam} />
    </div>
  );
}
