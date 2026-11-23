'use client';

import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { blankCountOf, setBlank, splitBlankPrompt } from '../answers';
import type { QuestionInputProps } from './types';

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** FILL_BLANK: the prompt with `{{n}}` placeholders rendered as inline text inputs. */
export function FillBlankQuestion({
  question,
  value,
  onChange,
  disabled,
  review,
}: QuestionInputProps) {
  const t = useTranslations('practice');
  const count = blankCountOf(question);
  const parts = splitBlankPrompt(question.prompt);

  return (
    <p className="text-base leading-10">
      {parts.map((p, i) => {
        if (p.kind === 'text') return <Fragment key={i}>{p.text}</Fragment>;
        const current = value.blanks?.[p.index] ?? '';
        const accepted = review?.blanks?.[p.index];
        const reviewState = accepted
          ? accepted.some((a) => normalize(a) === normalize(current))
            ? 'correct'
            : 'wrong'
          : undefined;
        return (
          <span key={i} className="mx-1 inline-flex flex-col align-middle">
            <input
              type="text"
              value={current}
              disabled={disabled}
              data-review={reviewState}
              aria-label={t('blankLabel', { number: p.index + 1 })}
              placeholder={t('blankPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => onChange(setBlank(value, p.index, e.target.value, count))}
              className={cn(
                'border-input h-9 w-36 rounded-md border-b-2 bg-transparent px-2 text-base outline-none',
                'focus-visible:border-primary focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                reviewState === 'correct' && 'border-green-600 bg-green-50',
                reviewState === 'wrong' && 'border-red-600 bg-red-50',
              )}
            />
            {reviewState === 'wrong' && accepted ? (
              <span className="text-xs leading-5 text-green-800">{accepted.join(' / ')}</span>
            ) : null}
          </span>
        );
      })}
    </p>
  );
}
