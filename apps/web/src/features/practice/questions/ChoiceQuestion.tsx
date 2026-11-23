'use client';

import { QuestionType } from '@onlinedars/shared';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { selectOption } from '../answers';
import type { QuestionInputProps } from './types';

/**
 * MULTIPLE_CHOICE (single → radios, multi → checkboxes), TRUE_FALSE and IMAGE_BASED options.
 * Native inputs keep it keyboard- and screen-reader-friendly.
 */
export function ChoiceQuestion({
  question,
  value,
  onChange,
  disabled,
  review,
}: QuestionInputProps) {
  const t = useTranslations('practice');
  const name = useId();
  const multiple = question.isMultiple && question.type !== QuestionType.TRUE_FALSE;
  const selected = value.selectedOptionIds ?? [];
  const correct = review?.selectedOptionIds;
  const isTrueFalse = question.type === QuestionType.TRUE_FALSE;

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-muted-foreground mb-2 text-sm">
        {multiple ? t('chooseMany') : t('chooseOne')}
      </legend>
      <div className={cn('grid gap-2', isTrueFalse && 'grid-cols-2')}>
        {question.options.map((o) => {
          const checked = selected.includes(o.id);
          const isRight = correct?.includes(o.id);
          const reviewState = correct
            ? isRight
              ? 'correct'
              : checked
                ? 'wrong'
                : undefined
            : undefined;
          return (
            <label
              key={o.id}
              data-review={reviewState}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                'has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]',
                checked && 'border-primary bg-primary/5',
                reviewState === 'correct' && 'border-green-600 bg-green-50',
                reviewState === 'wrong' && 'border-red-600 bg-red-50',
                disabled && 'cursor-default',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={o.id}
                checked={checked}
                onChange={() => onChange(selectOption(value, o.id, multiple))}
                className="accent-primary size-4 shrink-0"
              />
              <span className="flex flex-1 flex-col gap-2">
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.imageUrl} alt={o.text} className="max-h-40 rounded object-contain" />
                ) : null}
                <span>{o.text}</span>
              </span>
              {reviewState === 'correct' ? (
                <Check className="size-5 text-green-700" aria-label={t('result.correct')} />
              ) : reviewState === 'wrong' ? (
                <X className="size-5 text-red-700" aria-label={t('result.incorrect')} />
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
