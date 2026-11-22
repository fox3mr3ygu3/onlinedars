import type { PublicQuestion, QuestionAnswer } from '@onlinedars/shared';
import type { CorrectAnswer } from '@/lib/api/learning-types';

export interface QuestionInputProps {
  question: PublicQuestion;
  value: QuestionAnswer;
  onChange: (next: QuestionAnswer) => void;
  disabled?: boolean;
  /** After submission: the correct answer revealed by the server (highlights the inputs). */
  review?: CorrectAnswer;
}
