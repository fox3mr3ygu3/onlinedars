import type { PublicQuestion } from '@onlinedars/shared';
import type { PracticeResult, StudentPracticeView } from '@/lib/api/learning-types';

export const mcSingle: PublicQuestion = {
  id: 'q1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'HTML nima?',
  imageUrl: null,
  isMultiple: false,
  points: 1,
  options: [
    { id: 'o1', text: 'Belgilash tili', imageUrl: null },
    { id: 'o2', text: 'Dasturlash tili', imageUrl: null },
    { id: 'o3', text: 'Ma`lumotlar bazasi', imageUrl: null },
  ],
};

export const mcMulti: PublicQuestion = {
  id: 'q2',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Qaysilari brauzer?',
  imageUrl: null,
  isMultiple: true,
  points: 1,
  options: [
    { id: 'm1', text: 'Chrome', imageUrl: null },
    { id: 'm2', text: 'Firefox', imageUrl: null },
    { id: 'm3', text: 'Excel', imageUrl: null },
  ],
};

export const trueFalse: PublicQuestion = {
  id: 'q3',
  type: 'TRUE_FALSE',
  prompt: 'CSS — bu uslublar tili.',
  imageUrl: null,
  isMultiple: false,
  points: 1,
  options: [
    { id: 't1', text: "To'g'ri", imageUrl: null },
    { id: 't2', text: "Noto'g'ri", imageUrl: null },
  ],
};

export const matching: PublicQuestion = {
  id: 'q4',
  type: 'MATCHING',
  prompt: 'Teglarni moslang',
  imageUrl: null,
  isMultiple: false,
  points: 1,
  options: [
    { id: 'l1', text: '<a>', imageUrl: null },
    { id: 'l2', text: '<img>', imageUrl: null },
  ],
  matchTargets: ['Rasm', 'Havola'],
};

export const fillBlank: PublicQuestion = {
  id: 'q5',
  type: 'FILL_BLANK',
  prompt: 'Sarlavha tegi {{0}}, paragraf tegi {{1}}.',
  imageUrl: null,
  isMultiple: false,
  points: 1,
  options: [],
  blankCount: 2,
};

export const imageBased: PublicQuestion = {
  id: 'q6',
  type: 'IMAGE_BASED',
  prompt: 'Rasmda qaysi logotip?',
  imageUrl: 'https://files.example.test/logo.png',
  isMultiple: false,
  points: 1,
  options: [
    { id: 'i1', text: 'HTML5', imageUrl: null },
    { id: 'i2', text: 'CSS3', imageUrl: null },
  ],
};

export const sixQuestions = [mcSingle, mcMulti, trueFalse, matching, fillBlank, imageBased];

export const practiceView: StudentPracticeView = {
  id: 'p1',
  lessonId: 'les1',
  courseId: 'c1',
  title: '1-amaliyot',
  description: null,
  passScore: 50,
  isRequired: true,
  questions: sixQuestions,
  attempts: [],
};

export const practiceResult: PracticeResult = {
  attempt: {
    id: 'a1',
    score: 5,
    maxScore: 6,
    percent: 83.3,
    correctCount: 5,
    totalCount: 6,
    passed: true,
    submittedAt: '2026-11-22T10:00:00.000Z',
  },
  questions: sixQuestions.map((q, i) => ({
    questionId: q.id,
    type: q.type,
    isCorrect: i !== 1,
    pointsAwarded: i !== 1 ? 1 : 0,
    points: 1,
    answer: { questionId: q.id },
    correctAnswer:
      q.type === 'MATCHING'
        ? {
            matches: [
              { optionId: 'l1', matchText: 'Havola' },
              { optionId: 'l2', matchText: 'Rasm' },
            ],
          }
        : q.type === 'FILL_BLANK'
          ? { blanks: [['h1'], ['p']] }
          : { selectedOptionIds: [q.options[0]!.id] },
    explanation: i === 1 ? 'Excel brauzer emas.' : null,
  })),
  lesson: {
    lessonId: 'les1',
    materialViewed: true,
    isCompleted: false,
    completedAt: null,
    requiredPractices: 4,
    passedRequiredPractices: 1,
  },
  course: {
    completedLessons: 0,
    totalLessons: 3,
    completedRequired: 0,
    totalRequired: 3,
    percent: 0,
  },
};
