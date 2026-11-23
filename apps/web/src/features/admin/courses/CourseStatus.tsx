'use client';

import { CourseStatus } from '@onlinedars/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setCourseStatus } from '@/lib/api/admin/content';
import type { AdminCourse } from '@/lib/api/admin/types';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import { Badge, type BadgeTone, Section } from '../common/ui';

const TONES: Record<CourseStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  HIDDEN: 'warning',
  ARCHIVED: 'danger',
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const t = useTranslations('admin.courses.status');
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}

/** Status transitions offered from each status (the API validates them again). */
export function nextStatuses(current: CourseStatus): CourseStatus[] {
  switch (current) {
    case CourseStatus.DRAFT:
      return [CourseStatus.PUBLISHED, CourseStatus.ARCHIVED];
    case CourseStatus.PUBLISHED:
      return [CourseStatus.HIDDEN, CourseStatus.ARCHIVED, CourseStatus.DRAFT];
    case CourseStatus.HIDDEN:
      return [CourseStatus.PUBLISHED, CourseStatus.ARCHIVED, CourseStatus.DRAFT];
    case CourseStatus.ARCHIVED:
      return [CourseStatus.DRAFT];
  }
}

export function CourseStatusControl({ course }: { course: AdminCourse }) {
  const t = useTranslations('admin.courses');
  const errMsg = useApiErrorMessage();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (s: CourseStatus) => setCourseStatus(course.id, s),
    onSuccess: (updated) => {
      qc.setQueryData(['admin', 'course', course.id], updated);
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      toast.success(t('statusActions.changed'));
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Section
      title={t('statusActions.title')}
      actions={<CourseStatusBadge status={course.status} />}
    >
      <div className="flex flex-wrap gap-2">
        {nextStatuses(course.status).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={
              s === CourseStatus.PUBLISHED
                ? 'default'
                : s === CourseStatus.ARCHIVED
                  ? 'destructive'
                  : 'outline'
            }
            disabled={m.isPending}
            onClick={() => m.mutate(s)}
          >
            {t(`statusActions.${s}`)}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">{t('statusActions.hint')}</p>
    </Section>
  );
}
