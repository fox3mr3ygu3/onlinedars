'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, ListTree } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createCourse, deleteCourse, getCourse, updateCourse } from '@/lib/api/admin/content';
import { ConfirmButton } from '../common/controls';
import { ErrorState, LoadingState, PageHeader } from '../common/ui';
import { CourseForm } from './CourseForm';
import { CourseStatusControl } from './CourseStatus';

function BackToCourses() {
  const t = useTranslations('admin');
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/admin/courses">
        <ArrowLeft aria-hidden />
        {t('nav.courses')}
      </Link>
    </Button>
  );
}

export function CourseCreate() {
  const t = useTranslations('admin.courses');
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader title={t('createTitle')} back={<BackToCourses />} />
      <CourseForm
        onSubmit={async (input) => {
          const c = await createCourse(input);
          await qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
          toast.success(t('created'));
          router.push(`/admin/courses/${c.id}/modules`);
        }}
      />
    </>
  );
}

export function useCourse(id: string) {
  return useQuery({ queryKey: ['admin', 'course', id], queryFn: () => getCourse(id) });
}

/** Tabs linking the three course sections. */
export function CourseTabs({ courseId, active }: { courseId: string; active: 'general' | 'program' | 'exam' }) {
  const t = useTranslations('admin.courses.tabs');
  const tabs = [
    { key: 'general', href: `/admin/courses/${courseId}`, icon: null },
    { key: 'program', href: `/admin/courses/${courseId}/modules`, icon: ListTree },
    { key: 'exam', href: `/admin/courses/${courseId}/exam`, icon: ClipboardCheck },
  ] as const;
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b" aria-label={t('general')}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={
            active === tab.key
              ? 'border-primary text-primary -mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap'
              : 'text-muted-foreground hover:text-foreground px-3 py-2 text-sm whitespace-nowrap'
          }
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

export function CourseEditor({ courseId }: { courseId: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const qc = useQueryClient();
  const q = useCourse(courseId);
  const del = useMutation({
    mutationFn: () => deleteCourse(courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      toast.success(t('common.deleted'));
      router.push('/admin/courses');
    },
  });

  if (q.isPending) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const course = q.data;

  return (
    <>
      <PageHeader
        title={course.title}
        back={<BackToCourses />}
        actions={
          <ConfirmButton onConfirm={() => del.mutateAsync()}>{t('courses.deleteCourse')}</ConfirmButton>
        }
      />
      <CourseTabs courseId={courseId} active="general" />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <CourseForm
          key={course.updatedAt}
          course={course}
          onSubmit={async (input) => {
            const updated = await updateCourse(courseId, input);
            qc.setQueryData(['admin', 'course', courseId], updated);
            qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
            toast.success(t('common.saved'));
          }}
        />
        <div className="lg:sticky lg:top-6">
          <CourseStatusControl course={course} />
        </div>
      </div>
    </>
  );
}
