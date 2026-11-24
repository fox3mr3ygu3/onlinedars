import { Role } from '@onlinedars/shared';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseDetail } from '@/lib/api/public';
import { renderWithProviders } from '@/test/render';
import { CoursePurchaseCard } from './course-purchase-card';

const session = vi.hoisted(() => ({
  user: null as null | { role: string },
  isLoading: false,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useSession: () => session,
}));

const course = {
  id: 'c1',
  slug: 'html',
  title: 'HTML',
  shortDescription: null,
  coverImageUrl: null,
  level: 'BEGINNER',
  isFree: false,
  price: 44_900_000,
  currency: 'UZS',
  direction: null,
  teachers: [],
  moduleCount: 2,
  lessonCount: 4,
  durationMinutes: 80,
  publishedAt: null,
  description: '',
  goals: [],
  modules: [],
} as unknown as CourseDetail;

describe('CoursePurchaseCard', () => {
  beforeEach(() => {
    session.user = null;
    session.isLoading = false;
  });

  it('self-service: shows the price and the buy link to checkout', () => {
    renderWithProviders(<CoursePurchaseCard course={course} />);
    expect(screen.getByText("449 000 so'm")).toBeInTheDocument();
    expect(screen.getByTestId('course-cta')).toHaveAttribute('href', '/checkout/c1?course=html');
  });

  it('admin-only, guest: no price, no checkout, register and login links', () => {
    renderWithProviders(<CoursePurchaseCard course={course} adminOnly />);
    expect(screen.getByTestId('admin-access-notice')).toHaveTextContent(
      'Kursga kirish administrator orqali',
    );
    expect(screen.queryByText("449 000 so'm")).not.toBeInTheDocument();
    expect(screen.queryByTestId('course-cta')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Ro'yxatdan o'tish" })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: 'Kirish' })).toHaveAttribute(
      'href',
      '/login?next=%2Fcourses%2Fhtml',
    );
  });

  it('admin-only, student: points to my courses', () => {
    session.user = { role: Role.STUDENT };
    renderWithProviders(<CoursePurchaseCard course={course} adminOnly />);
    expect(screen.getByRole('link', { name: "Kurslarimga o'tish" })).toHaveAttribute(
      'href',
      '/cabinet/courses',
    );
  });

  it('admin-only, admin: links to the students section where access is granted', () => {
    session.user = { role: Role.ADMIN };
    renderWithProviders(<CoursePurchaseCard course={course} adminOnly />);
    expect(screen.getByRole('link', { name: "Talabalar bo'limi" })).toHaveAttribute(
      'href',
      '/admin/students',
    );
    expect(screen.queryByRole('link', { name: "Ro'yxatdan o'tish" })).not.toBeInTheDocument();
  });
});
