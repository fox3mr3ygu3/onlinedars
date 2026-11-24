// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CourseCard as CourseCardData } from '@/lib/api/public';
import { toPaginated } from '@/lib/api/public';
import { buildQuery, errorMessageKey, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/render';
import { VerifyResult } from '../certificate/verify-result';
import { catalogHref, pageCount, parseCatalogParams, toApiParams } from './catalog-params';
import { CourseCard } from './course-card';
import { CatalogPagination } from './pagination';

const course: CourseCardData = {
  id: 'c1',
  slug: 'js-asoslari',
  title: 'JavaScript asoslari',
  shortDescription: "Noldan boshlab JS o'rganing",
  coverImageUrl: null,
  level: 'BEGINNER',
  isFree: false,
  price: 49_900_000,
  lessonCount: 12,
  direction: { id: 'd1', slug: 'dasturlash', name: 'Dasturlash' },
};

describe('CourseCard', () => {
  it('shows name, short description, lesson count, price and links to the course', () => {
    renderWithIntl(<CourseCard course={course} />);
    expect(screen.getByRole('link', { name: 'JavaScript asoslari' })).toHaveAttribute(
      'href',
      '/courses/js-asoslari',
    );
    expect(screen.getByText("Noldan boshlab JS o'rganing")).toBeInTheDocument();
    expect(screen.getByTestId('lesson-count')).toHaveTextContent('12 ta dars');
    expect(screen.getByText("499 000 so'm")).toBeInTheDocument();
    expect(screen.getByText('Dasturlash')).toBeInTheDocument();
  });

  it('hides the price when enrolment is admin-only', () => {
    renderWithIntl(<CourseCard course={course} showPrice={false} />);
    expect(screen.queryByText("499 000 so'm")).not.toBeInTheDocument();
    expect(screen.getByTestId('lesson-count')).toHaveTextContent('12 ta dars');
  });

  it('shows "Bepul" for free courses', () => {
    renderWithIntl(<CourseCard course={{ ...course, isFree: true, price: 0 }} />);
    expect(screen.getByText('Bepul')).toBeInTheDocument();
  });
});

describe('catalog URL state', () => {
  it('parses and sanitises search params', () => {
    expect(
      parseCatalogParams({ search: ' js ', price: 'free', page: '3', directionId: 'd1' }),
    ).toEqual({
      search: 'js',
      directionId: 'd1',
      price: 'free',
      page: 3,
    });
    expect(parseCatalogParams({ price: 'cheap', page: '-2' })).toEqual({
      search: '',
      directionId: '',
      price: '',
      page: 1,
    });
  });

  it('maps to API params (price → isFree)', () => {
    const s = parseCatalogParams({ price: 'paid', page: '2' });
    expect(toApiParams(s, 12)).toEqual({
      search: undefined,
      directionId: undefined,
      isFree: false,
      page: 2,
      pageSize: 12,
    });
  });

  it('builds hrefs without empty values or page 1', () => {
    expect(catalogHref({ search: '', page: 1 })).toBe('/courses');
    expect(catalogHref({ search: 'react', price: 'free', page: 2 })).toBe(
      '/courses?search=react&price=free&page=2',
    );
    expect(pageCount(25, 12)).toBe(3);
    expect(pageCount(0, 12)).toBe(1);
  });

  it('pagination keeps filters', () => {
    renderWithIntl(
      <CatalogPagination
        state={{ search: 'js', directionId: '', price: '', page: 2 }}
        total={30}
        pageSize={12}
      />,
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Oldingi/ })).toHaveAttribute(
      'href',
      '/courses?search=js',
    );
    expect(screen.getByRole('link', { name: /Keyingi/ })).toHaveAttribute(
      'href',
      '/courses?search=js&page=3',
    );
  });
});

describe('api helpers', () => {
  it('buildQuery skips empty values', () => {
    expect(buildQuery({ a: 1, b: undefined, c: '', d: false })).toBe('?a=1&d=false');
    expect(buildQuery({})).toBe('');
  });

  it('toPaginated accepts bare arrays', () => {
    expect(toPaginated([1, 2])).toEqual({ items: [1, 2], total: 2, page: 1, pageSize: 2 });
  });

  it('errorMessageKey maps API codes and falls back', () => {
    expect(errorMessageKey(new ApiError(404, 'ORDER_NOT_FOUND', 'x'))).toBe(
      'errors.ORDER_NOT_FOUND',
    );
    expect(errorMessageKey(new Error('x'))).toBe('errors.INTERNAL_ERROR');
  });
});

describe('VerifyResult', () => {
  const cert = {
    certificateId: 'OD-2026-000123',
    fullName: 'Ali Valiyev',
    courseTitle: 'JavaScript asoslari',
    issuedAt: '2026-11-20T10:00:00.000Z',
    isValid: true,
  };

  it('shows holder, course, date and id for a valid certificate', () => {
    renderWithIntl(<VerifyResult result={{ kind: 'ok', certificate: cert }} />);
    const box = screen.getByTestId('verify-valid');
    expect(box).toHaveTextContent('Sertifikat haqiqiy');
    expect(box).toHaveTextContent('Ali Valiyev');
    expect(box).toHaveTextContent('JavaScript asoslari');
    expect(box).toHaveTextContent('OD-2026-000123');
    expect(box).toHaveTextContent('2026');
  });

  it('marks a revoked certificate as invalid', () => {
    renderWithIntl(
      <VerifyResult result={{ kind: 'ok', certificate: { ...cert, isValid: false } }} />,
    );
    expect(screen.getByTestId('verify-invalid')).toHaveTextContent('Sertifikat bekor qilingan');
  });

  it('shows not found', () => {
    renderWithIntl(<VerifyResult result={{ kind: 'notFound' }} />);
    expect(screen.getByTestId('verify-not-found')).toHaveTextContent('Sertifikat topilmadi');
  });
});
