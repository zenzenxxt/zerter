
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  marks?: number;
}

export interface ProctorXTableType {
  user_id: string;
  email: string;
  pass: string;
  name: string;
  role: 'student' | 'teacher';
  avatar_url: string | null;
  created_at?: string;
}

export type ExamStatus = 'Published' | 'Ongoing' | 'Completed';
export type ExamSubmissionStatus = 'In Progress' | 'Completed';

export type FlaggedEventType =
  | 'visibility_hidden'
  | 'visibility_visible'
  | 'fullscreen_entered'
  | 'fullscreen_exited'
  | 'blur'
  | 'focus'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'shortcut_attempt'
  | 'dev_tools_detected'
  | 'webdriver_detected'
  | 'disallowed_key_pressed'
  | 'NO_FACE_DETECTED'
  | 'MULTIPLE_FACES_DETECTED'
  | 'USER_LOOKING_AWAY'
  | 'WEBCAM_UNAVAILABLE'
  | 'WEBCAM_PERMISSION_DENIED';
  // SUSPICIOUS_OBJECT_DETECTED removed

export interface FlaggedEvent {
  type: FlaggedEventType;
  timestamp: Date;
  studentId: string;
  examId: string;
  details?: string;
}

export interface Database {
  public: {
    Tables: {
      proctorX: {
        Row: ProctorXTableType;
        Insert: Omit<ProctorXTableType, 'created_at'>;
        Update: Partial<Omit<ProctorXTableType, 'created_at' | 'user_id' | 'email' | 'role'>>;
      };
      ExamX: {
        Row: {
          exam_id: string; // uuid
          teacher_id: string;
          title: string;
          description: string | null;
          duration: number;
          allow_backtracking: boolean;
          enable_webcam_proctoring: boolean; // Changed from boolean | null
          questions: Question[] | null;
          exam_code: string;
          status: ExamStatus;
          start_time: string | null;
          end_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          exam_id?: string; // uuid
          teacher_id: string;
          title: string;
          description?: string | null;
          duration: number;
          allow_backtracking?: boolean;
          enable_webcam_proctoring: boolean; // No longer optional
          questions?: Question[] | null;
          exam_code: string;
          status?: ExamStatus;
          start_time: string | null;
          end_time: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          duration: number;
          allow_backtracking: boolean;
          enable_webcam_proctoring: boolean;
          questions: Question[] | null;
          status: ExamStatus;
          start_time: string | null;
          end_time: string | null;
          updated_at: string;
        }>;
      };
      ExamSubmissionsX: {
        Row: {
          submission_id: string;
          exam_id: string; // uuid
          student_user_id: string;
          answers: Json | null;
          status: ExamSubmissionStatus;
          score: number | null;
          marks_obtained: number | null;
          total_possible_marks: number | null;
          started_at: string;
          submitted_at: string | null;
          flagged_events: FlaggedEvent[] | null;
        };
        Insert: {
          submission_id?: string;
          exam_id: string; // uuid
          student_user_id: string;
          answers?: Json | null;
          status: ExamSubmissionStatus;
          score?: number | null;
          marks_obtained?: number | null;
          total_possible_marks?: number | null;
          started_at: string;
          submitted_at?: string | null;
          flagged_events?: FlaggedEvent[] | null;
        };
        Update: Partial<{
          answers: Json | null;
          status: ExamSubmissionStatus;
          score: number | null;
          marks_obtained: number | null;
          total_possible_marks: number | null;
          submitted_at: string | null;
          flagged_events: FlaggedEvent[] | null;
        }>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type CustomUser = {
  user_id: string;
  email: string;
  name: string | null;
  role: 'student' | 'teacher' | null;
  avatar_url: string | null;
};

export type ProctorXTable = Database['public']['Tables']['proctorX'];
export type Exam = Database['public']['Tables']['ExamX']['Row'];
export type ExamInsert = Database['public']['Tables']['ExamX']['Insert'];
export type ExamUpdate = Database['public']['Tables']['ExamX']['Update'];
export type ExamSubmission = Database['public']['Tables']['ExamSubmissionsX']['Row'];
export type ExamSubmissionInsert = Database['public']['Tables']['ExamSubmissionsX']['Insert'];
export type ExamSubmissionUpdate = Database['public']['Tables']['ExamSubmissionsX']['Update'];
