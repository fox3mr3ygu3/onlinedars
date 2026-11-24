import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learningApi } from '@/lib/api/learning';
import type { StudentLessonView } from '@/lib/api/learning-types';
import { renderWithProviders } from '@/test/render';
import { LessonView } from './LessonScreen';

vi.mock('@/lib/api/learning', () => ({ learningApi: { markViewed: vi.fn() } }));
const api = vi.mocked(learningApi);

const practice = (n: number) => ({
  id: `p${n}`,
  title: `${n}-amaliyot`,
  description: null,
  position: n,
  isRequired: true,
  passScore: 0,
  questionCount: 6,
  attempts: n === 1 ? 1 : 0,
  bestPercent: n === 1 ? 100 : null,
  passed: n === 1,
});

const lesson: StudentLessonView = {
  id: 'les1',
  title: 'Teglar',
  summary: 'Asosiy teglar',
  durationMinutes: 15,
  courseId: 'c1',
  moduleId: 'm1',
  materials: [
    {
      id: 'mt1',
      type: 'TEXT',
      title: null,
      content: '<p>Salom <script>alert(1)</script><b>dunyo</b></p>',
      fileUrl: null,
      mimeType: null,
      sizeBytes: null,
      videoUrl: null,
      position: 1,
    },
    {
      id: 'mt2',
      type: 'VIDEO',
      title: 'Video',
      content: null,
      fileUrl: null,
      mimeType: null,
      sizeBytes: null,
      videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      position: 2,
    },
    {
      id: 'mt3',
      type: 'FILE',
      title: 'Konspekt.pdf',
      content: null,
      fileUrl: 'https://files.example.test/a.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      videoUrl: null,
      position: 3,
    },
    {
      id: 'mt4',
      type: 'IMAGE',
      title: 'Sxema',
      content: null,
      fileUrl: 'https://files.example.test/a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      videoUrl: null,
      position: 4,
    },
  ],
  practices: [practice(1), practice(2), practice(3), practice(4)],
  progress: {
    lessonId: 'les1',
    materialViewed: false,
    isCompleted: false,
    completedAt: null,
    requiredPractices: 4,
    passedRequiredPractices: 1,
  },
  prevLessonId: null,
  nextLessonId: 'les2',
};

describe('LessonView', () => {
  beforeEach(() => {
    api.markViewed.mockResolvedValue({
      lesson: { ...lesson.progress, materialViewed: true },
      course: {
        completedLessons: 0,
        totalLessons: 2,
        completedRequired: 0,
        totalRequired: 2,
        percent: 0,
      },
    });
  });

  it('renders sanitised rich text, video embed, file and image', () => {
    const { container } = renderWithProviders(<LessonView lesson={lesson} />);
    expect(screen.getByText('dunyo')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByTitle('Video')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(screen.getByRole('link', { name: /Konspekt.pdf/ })).toHaveAttribute(
      'href',
      'https://files.example.test/a.pdf',
    );
    expect(screen.getByRole('img', { name: 'Sxema' })).toBeInTheDocument();
  });

  it('skips the video shown on the player stage', () => {
    renderWithProviders(<LessonView lesson={lesson} stageMaterialId="mt2" />);
    expect(screen.queryByTitle('Video')).not.toBeInTheDocument();
    expect(screen.getByText('dunyo')).toBeInTheDocument();
  });

  it('lists the 4 practices with status and links', () => {
    renderWithProviders(<LessonView lesson={lesson} />);
    for (const n of [1, 2, 3, 4]) expect(screen.getByTestId(`practice-p${n}`)).toBeInTheDocument();
    expect(screen.getByText('Majburiy amaliyotlar: 1/4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Qayta topshirish' })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1/lessons/les1/practice/p1',
    );
    expect(screen.getAllByRole('link', { name: 'Boshlash' })).toHaveLength(3);
  });

  it('marks material as viewed via the API', async () => {
    renderWithProviders(<LessonView lesson={lesson} />);
    await userEvent.click(screen.getByRole('button', { name: "Materialni ko'rdim" }));
    await waitFor(() => expect(api.markViewed).toHaveBeenCalledWith('les1'));
  });

  it('shows the viewed state without a button once viewed', () => {
    renderWithProviders(
      <LessonView lesson={{ ...lesson, progress: { ...lesson.progress, materialViewed: true } }} />,
    );
    expect(screen.getByTestId('material-viewed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Materialni ko'rdim" })).not.toBeInTheDocument();
  });
});
