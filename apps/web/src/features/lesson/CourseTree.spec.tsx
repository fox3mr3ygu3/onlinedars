import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StudentCourseTree } from '@/lib/api/learning-types';
import { renderWithProviders } from '@/test/render';
import { CourseTree } from './CourseTree';

const lesson = (id: string, over: Partial<StudentCourseTree['modules'][0]['lessons'][0]> = {}) => ({
  id,
  title: `Dars ${id}`,
  position: 1,
  durationMinutes: 10,
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
    totalLessons: 3,
    completedRequired: 1,
    totalRequired: 3,
    percent: 33,
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
        lesson('l1', { isCompleted: true, materialViewed: true, practicesPassed: 4 }),
        lesson('l2', { materialViewed: true, practicesPassed: 1 }),
      ],
    },
    {
      id: 'm2',
      title: 'Teglar',
      description: null,
      position: 2,
      isLocked: true,
      completedLessons: 0,
      totalLessons: 1,
      lessons: [lesson('l3', { isLocked: true })],
    },
  ],
  exam: { exists: true, isLocked: true, passed: false },
  certificate: null,
  nextLessonId: 'l2',
};

describe('CourseTree lock rendering', () => {
  it('links unlocked lessons and renders locked ones without a link', () => {
    renderWithProviders(<CourseTree tree={tree} />);
    const l1 = screen.getByTestId('lesson-l1');
    expect(l1).toHaveAttribute('data-status', 'completed');
    expect(within(l1).getByRole('link')).toHaveAttribute('href', '/cabinet/courses/c1/lessons/l1');

    expect(screen.getByTestId('lesson-l2')).toHaveAttribute('data-status', 'inProgress');

    const l3 = screen.getByTestId('lesson-l3');
    expect(l3).toHaveAttribute('data-locked', 'true');
    expect(within(l3).queryByRole('link')).not.toBeInTheDocument();
    expect(within(l3).getByText(/Avvalgi darslarni tugatgandan/)).toBeInTheDocument();

    expect(screen.getByTestId('module-m2')).toHaveAttribute('data-locked', 'true');
    expect(within(screen.getByTestId('module-m2')).getByLabelText('Yopiq')).toBeInTheDocument();
  });

  it('shows progress, continue link and a locked exam without a link', () => {
    renderWithProviders(<CourseTree tree={tree} />);
    expect(screen.getByRole('progressbar', { name: "Kurs o'zlashtirilishi" })).toHaveAttribute(
      'aria-valuenow',
      '33',
    );
    expect(screen.getByRole('link', { name: 'Davom etish' })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1/lessons/l2',
    );
    const exam = screen.getByTestId('exam-card');
    expect(exam).toHaveAttribute('data-locked', 'true');
    expect(within(exam).queryByRole('link')).not.toBeInTheDocument();
    expect(within(exam).getByRole('button', { name: 'Yopiq' })).toBeDisabled();
  });

  it('links the exam when it is unlocked', () => {
    renderWithProviders(
      <CourseTree tree={{ ...tree, exam: { exists: true, isLocked: false, passed: false } }} />,
    );
    expect(within(screen.getByTestId('exam-card')).getByRole('link')).toHaveAttribute(
      'href',
      '/cabinet/courses/c1/exam',
    );
  });

  it('a lesson inside a locked module is locked even if the lesson flag is false', () => {
    const t2 = structuredClone(tree);
    t2.modules[1]!.lessons[0]!.isLocked = false;
    renderWithProviders(<CourseTree tree={t2} />);
    expect(screen.getByTestId('lesson-l3')).toHaveAttribute('data-locked', 'true');
  });
});
