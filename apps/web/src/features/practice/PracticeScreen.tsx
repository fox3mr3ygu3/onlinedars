'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { learningApi } from '@/lib/api/learning';
import type { PracticeResult } from '@/lib/api/learning-types';
import { cabinetRoutes, qk } from '../cabinet/routes';
import { QueryBoundary, useErrorMessage } from '../cabinet/ui';
import { PracticePlayer } from './PracticePlayer';
import { PracticeResultView } from './PracticeResultView';

export function PracticeScreen({
  courseId,
  lessonId,
  practiceId,
}: {
  courseId: string;
  lessonId: string;
  practiceId: string;
}) {
  const t = useTranslations('practice');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.practice(practiceId),
    queryFn: () => learningApi.practice(practiceId),
  });
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [round, setRound] = useState(0);

  const submit = useMutation({
    mutationFn: (answers: Parameters<typeof learningApi.submitPractice>[1]) =>
      learningApi.submitPractice(practiceId, answers),
    onSuccess: (res) => {
      setResult(res);
      window.scrollTo?.({ top: 0 });
      void queryClient.invalidateQueries({ queryKey: qk.lesson(lessonId) });
      void queryClient.invalidateQueries({ queryKey: qk.course(courseId) });
      void queryClient.invalidateQueries({ queryKey: qk.dashboard });
      void queryClient.invalidateQueries({ queryKey: qk.practice(practiceId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const backHref = cabinetRoutes.lesson(courseId, lessonId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('back')}
      </Link>
      <QueryBoundary query={query}>
        {(practice) => (
          <div className="space-y-6">
            <header>
              <h1 className="text-2xl font-semibold">{practice.title}</h1>
              {practice.description ? (
                <p className="text-muted-foreground mt-1">{practice.description}</p>
              ) : null}
              {practice.attempts.length > 0 ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {t('attempts', { count: practice.attempts.length })}
                </p>
              ) : null}
            </header>
            {result ? (
              <PracticeResultView
                result={result}
                questions={practice.questions}
                passScore={practice.passScore}
                actions={
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResult(null);
                        setRound((r) => r + 1);
                      }}
                    >
                      {t('result.retry')}
                    </Button>
                    <Button asChild>
                      <Link href={backHref}>{t('result.backToLesson')}</Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <PracticePlayer
                key={round}
                questions={practice.questions}
                submitting={submit.isPending}
                onSubmit={(answers) => submit.mutate(answers)}
              />
            )}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
