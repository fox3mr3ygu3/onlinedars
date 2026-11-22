/** Pure helpers for admin reports (ranges, day buckets, rates). Unit-tested. */
import type { ActivityReportDay, CourseReportRow } from '@onlinedars/shared';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
export const REPORT_TIMEZONE = 'Asia/Tashkent';

/** yyyy-mm-dd of `d` in Tashkent time. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive [from, to] day range; defaults to the last 30 days; clamped to 366 days. */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): { from: string; to: string } {
  const end = to ?? dayKey(now);
  let start = from ?? addDays(end, -(DEFAULT_RANGE_DAYS - 1));
  if (start > end) start = end;
  const span = daysBetween(start, end);
  if (span > MAX_RANGE_DAYS) start = addDays(end, -(MAX_RANGE_DAYS - 1));
  return { from: start, to: end };
}

export function daysBetween(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

/** UTC instants bounding the Tashkent (UTC+5, no DST) day range, for SQL filters. */
export function rangeBounds(range: { from: string; to: string }): { start: Date; end: Date } {
  return {
    start: new Date(`${range.from}T00:00:00+05:00`),
    end: new Date(`${addDays(range.to, 1)}T00:00:00+05:00`),
  };
}

export type ActivitySeries = Omit<ActivityReportDay, 'date'>;
export type ActivityMetric = keyof ActivitySeries;

/** One row per day in the range, zero-filled; `counts` = metric → (day → count). */
export function fillDays(
  range: { from: string; to: string },
  counts: Partial<Record<ActivityMetric, Map<string, number>>>,
): ActivityReportDay[] {
  const out: ActivityReportDay[] = [];
  const n = daysBetween(range.from, range.to);
  for (let i = 0; i < n; i++) {
    const date = addDays(range.from, i);
    const get = (m: ActivityMetric) => counts[m]?.get(date) ?? 0;
    out.push({
      date,
      lessonsCompleted: get('lessonsCompleted'),
      practiceAttempts: get('practiceAttempts'),
      examAttempts: get('examAttempts'),
      enrollments: get('enrollments'),
      newStudents: get('newStudents'),
    });
  }
  return out;
}

export function rate(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part * 100) / whole);
}

export interface CourseAggregates {
  courseId: string;
  title: string;
  status: string;
  enrollments: number;
  activeEnrollments: number;
  requiredLessons: number;
  lessonCompletions: number;
  examPassed: number;
  certificates: number;
}

export function toCourseReportRow(a: CourseAggregates): CourseReportRow {
  const possible = a.activeEnrollments * a.requiredLessons;
  return {
    ...a,
    avgProgress: Math.min(100, rate(a.lessonCompletions, possible)),
    completionRate: Math.min(100, rate(a.certificates, a.activeEnrollments)),
  };
}
