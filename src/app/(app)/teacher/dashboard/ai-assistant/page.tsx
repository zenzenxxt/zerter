
import { QuestionGenerator } from '@/components/teacher/question-generator';

export default function AiAssistantPage() {
  return (
    <div className="space-y-6">
      {/* The QuestionGenerator component contains its own Card, which will pick up card-3d style */}
      <QuestionGenerator />
    </div>
  );
}

export const metadata = {
  title: 'AI Question Assistant | Teacher Dashboard | ProctorPrep',
};
