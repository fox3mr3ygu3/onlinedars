'use client';

import { QuestionType } from '@onlinedars/shared';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ChoiceQuestion } from './ChoiceQuestion';
import { FillBlankQuestion } from './FillBlankQuestion';
import { MatchingQuestion } from './MatchingQuestion';
import type { QuestionInputProps } from './types';

interface Props extends QuestionInputProps {
  number: number;
  total?: number;
  footer?: ReactNode;
}

/** One question of any of the 5 types: header, prompt, optional image, answer input. */
export function QuestionView({ number, total, footer, ...props }: Props) {
  const t = useTranslations('practice');
  const { question } = props;
  const headingId = `q-${question.id}-title`;

  return (
    <section aria-labelledby={headingId} className="space-y-4" data-question-type={question.type}>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {total ? <span>{t('questionOf', { current: number, total })}</span> : null}
        <span className="bg-secondary rounded px-2 py-0.5">{t(`types.${question.type}`)}</span>
      </div>
      {question.type === QuestionType.FILL_BLANK ? (
        <h2 id={headingId} className="sr-only">
          {t('questionOf', { current: number, total: total ?? number })}
        </h2>
      ) : (
        <h2 id={headingId} className="whitespace-pre-line text-lg font-semibold">
          {question.prompt}
        </h2>
      )}
      {question.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.imageUrl}
          alt={t('imageAlt')}
          className="max-h-80 w-full rounded-lg border object-contain"
        />
      ) : null}
      {renderInput(props)}
      {footer}
    </section>
  );
}

function renderInput(props: QuestionInputProps) {
  switch (props.question.type) {
    case QuestionType.MATCHING:
      return <MatchingQuestion {...props} />;
    case QuestionType.FILL_BLANK:
      return <FillBlankQuestion {...props} />;
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.TRUE_FALSE:
    case QuestionType.IMAGE_BASED:
    default:
      return <ChoiceQuestion {...props} />;
  }
}
