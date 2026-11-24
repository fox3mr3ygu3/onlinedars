import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { learningApi } from '@/lib/api/learning';
import type { LessonNode, StudentCourseTree, StudentLessonView } from '@/lib/api/learning-types';
import { renderWithProviders } from '@/test/render';
import { CourseContent, CoursePlayer } from './CoursePlayer';

vi.mock('@/lib/api/learning', () => ({
  learningApi: { lesson: vi.fn(), course: vi.fn(), markViewed: vi.fn() },
}));
const api = vi.mocked(learningApi);

const lesson = (id: string, over: Partial<LessonNode> = {}): LessonNode => ({
  id,
  title: `Dars ${id}`,
  position: 1,
  durationMinutes: 50,
  isRequired: true,
  isLocked: false,
  materialViewed: false,
  isCompleted: false,
  completedAt: null,
  practicesTotal: 4,
  practicesPassed: 0,
  ...over,
});

const tree: StudentCourseTree = {
  id: 'c1',
  slug: 'html',
  title: 'HTML asoslari',
  coverImageUrl: null,
  sequentialUnlock: true,
  progress: {
    completedLessons: 1,
    totalLessons: 4,
    completedRequired: 1,
    totalRequired: 4,
    percent: 25,
  },
  modules: [
    {
      id: 'm1',
      title: 'Kirish',
      description: null,
      position: 1,
      isLocked: false,
      completedLessons: 1,
      totalLessons: 2,
      lessons: [
        lesson('l1', { isCompleted: true, practicesPassed: 4 }),
        lesson('l2', { practicesPassed: 1, durationMinutes: 42 }),
      ],
    },
    {
      id: 'm2',
      title: 'Teglar',
      description: null,
      position: 2,
      isLocked: false,
      completedLessons: 0,
      totalLessons: 1,
      lessons: [lesson('l3', { durationMinutes: 5 })],
    },
    {
      id: 'm3',
      title: 'Yakun',
      description: null,
      position: 3,
      isLocked: true,
      completedLessons: 0,
      totalLessons: 1,
      lessons: [lesson('l4', { isLocked: true, durationMinutes: null })],
    },
  ],
  exam: { exists: true, isLocked: true, passed: false },
  certificate: null,
  nextLessonId: 'l2',
};

describe('CourseContent sidebar', () => {
  it('shows each section with done/total and total duration', () => {
    renderWithProviders(<CourseContent tree={tree} currentLessonId="l2" />);
    const m1 = screen.getByRole('button', { name: /1-bo'lim: Kirish/ });
    expect(m1).toHaveTextContent('1/2 | 1 soat 32 daq');
    expect(screen.getByRole('button', { name: /2-bo'lim: Teglar/ })).toHaveTextContent(
      '0/1 | 5 daq',
    );
    expect(screen.getByText('25% · 1/4 dars tugatildi')).toBeInTheDocument();
  });

  it('opens the current lesson section and marks the current lesson', () => {
    renderWithProviders(<CourseContent tree={tree} currentLessonId="l2" />);
    expect(screen.getByRole('button', { name: /1-bo'lim/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /2-bo'lim/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveAttribute('href', '/cabinet/courses/c1/lessons/l2');
    expect(current).toHaveTextContent('2. Dars l2');
    expect(screen.getByTestId('player-lesson-l1')).toHaveAttribute('data-status', 'completed');
    expect(screen.queryByTestId('player-lesson-l3')).not.toBeInTheDocument();
  });

  it('expands and collapses a section; locked lessons have no link', async () => {
    renderWithProviders(<CourseContent tree={tree} currentLessonId="l2" />);
    await userEvent.click(screen.getByRole('button', { name: /3-bo'lim: Yakun/ }));
    const l4 = screen.getByTestId('player-lesson-l4');
    expect(l4).toHaveAttribute('data-status', 'locked');
    expect(within(l4).queryByRole('link')).not.toBeInTheDocument();
    expect(l4).toHaveTextContent('4. Dars l4');

    await userEvent.click(screen.getByRole('button', { name: /1-bo'lim/ }));
    expect(screen.queryByTestId('player-lesson-l1')).not.toBeInTheDocument();
  });

  it('shows the exam row, locked until the lessons are done', () => {
    renderWithProviders(<CourseContent tree={tree} currentLessonId="l2" />);
    const exam = screen.getByTestId('player-exam');
    expect(exam).toHaveAttribute('data-locked', 'true');
    expect(within(exam).queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('CoursePlayer', () => {
  const lessonView: StudentLessonView = {
    id: 'l2',
    title: 'Paragraf',
    summary: null,
    durationMinutes: 42,
    courseId: 'c1',
    moduleId: 'm1',
    materials: [
      {
        id: 'v1',
        type: 'VIDEO',
        title: 'Kirish videosi',
        content: null,
        fileUrl: null,
        mimeType: null,
        sizeBytes: null,
        videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
        position: 1,
      },
    ],
    practices: [],
    progress: {
      lessonId: 'l2',
      materialViewed: true,
      isCompleted: false,
      completedAt: null,
      requiredPractices: 4,
      passedRequiredPractices: 1,
    },
    prevLessonId: 'l1',
    nextLessonId: 'l3',
  };

  it('puts the first video on the stage once and shows the course content sidebar', async () => {
    api.lesson.mockResolvedValue(lessonView);
    api.course.mockResolvedValue(tree);
    renderWithProviders(<CoursePlayer courseId="c1" lessonId="l2" />);

    expect(await screen.findByRole('heading', { name: 'Paragraf' })).toBeInTheDocument();
    expect(within(screen.getByTestId('player-stage')).getByTitle('Kirish videosi')).toBeVisible();
    expect(screen.getAllByTitle('Kirish videosi')).toHaveLength(1);

    const sidebar = screen.getByRole('complementary', { name: 'Kurs mazmuni' });
    expect(await within(sidebar).findByRole('link', { current: 'page' })).toHaveTextContent(
      '2. Dars l2',
    );
    expect(screen.getByText('HTML asoslari')).toBeInTheDocument();
  });
});
