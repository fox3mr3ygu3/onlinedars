'use client';

import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useState } from 'react';
import { cn } from '@/lib/utils';
import { removeMatch, setMatch } from '../answers';
import type { QuestionInputProps } from './types';

const DRAG_TYPE = 'text/plain';

/**
 * MATCHING: pair each left item (option) with a right-hand text (`matchTargets`).
 * Two ways that both work:
 *  - click/keyboard: press a left item, then press a target (aria-pressed shows the active item);
 *  - drag a target onto a left item (HTML5 drag-and-drop, desktop).
 * Each target can be used once; pairing it again moves it.
 */
export function MatchingQuestion({
  question,
  value,
  onChange,
  disabled,
  review,
}: QuestionInputProps) {
  const t = useTranslations('practice');
  const [active, setActive] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const targets = question.matchTargets ?? [];
  const matches = value.matches ?? [];
  const matchOf = (optionId: string) => matches.find((m) => m.optionId === optionId)?.matchText;
  const usedTargets = new Set(matches.map((m) => m.matchText));

  function pair(optionId: string, text: string) {
    if (disabled) return;
    onChange(setMatch(value, optionId, text));
    setActive(null);
  }

  function onDrop(e: DragEvent, optionId: string) {
    e.preventDefault();
    setDragOver(null);
    const text = e.dataTransfer.getData(DRAG_TYPE);
    if (text) pair(optionId, text);
  }

  return (
    <div className="space-y-4">
      {!disabled ? <p className="text-muted-foreground text-sm">{t('matchHint')}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-2">
          {question.options.map((o) => {
            const matched = matchOf(o.id);
            const correctText = review?.matches?.find((m) => m.optionId === o.id)?.matchText;
            const reviewState = review
              ? matched && matched === correctText
                ? 'correct'
                : 'wrong'
              : undefined;
            return (
              <li
                key={o.id}
                data-testid={`match-left-${o.id}`}
                data-review={reviewState}
                onDragOver={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  setDragOver(o.id);
                }}
                onDragLeave={() => setDragOver((d) => (d === o.id ? null : d))}
                onDrop={(e) => onDrop(e, o.id)}
                className={cn(
                  'rounded-lg border p-2 transition-colors',
                  active === o.id && 'border-primary bg-primary/5',
                  dragOver === o.id && 'border-primary border-dashed',
                  reviewState === 'correct' && 'border-green-600 bg-green-50',
                  reviewState === 'wrong' && 'border-red-600 bg-red-50',
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={active === o.id}
                  aria-label={t('matchSelectLeft', { text: o.text })}
                  onClick={() => setActive((a) => (a === o.id ? null : o.id))}
                  className="focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left font-medium outline-none focus-visible:ring-[3px]"
                >
                  {o.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.imageUrl} alt="" className="size-10 rounded object-cover" />
                  ) : null}
                  <span>{o.text}</span>
                </button>
                <div className="flex items-center gap-2 px-2 pb-1 text-sm">
                  <span aria-hidden="true">→</span>
                  {matched ? (
                    <span className="bg-secondary inline-flex items-center gap-1 rounded px-2 py-1">
                      <span data-testid={`match-value-${o.id}`}>{matched}</span>
                      {!disabled ? (
                        <button
                          type="button"
                          onClick={() => onChange(removeMatch(value, o.id))}
                          aria-label={t('matchRemove', { text: o.text })}
                          className="hover:text-destructive rounded p-0.5"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('matchChoose')}</span>
                  )}
                  {reviewState === 'correct' ? (
                    <Check className="size-4 text-green-700" aria-label={t('result.correct')} />
                  ) : null}
                </div>
                {reviewState === 'wrong' && correctText ? (
                  <p className="px-2 text-sm text-green-800">
                    {t('result.correctAnswer')}: {correctText}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!disabled ? (
          <div>
            <p className="mb-2 text-sm font-medium">{t('matchTargets')}</p>
            <ul className="flex flex-wrap gap-2 md:flex-col">
              {targets.map((text) => {
                const used = usedTargets.has(text);
                return (
                  <li key={text}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, text);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => (active ? pair(active, text) : undefined)}
                      aria-disabled={!active}
                      aria-label={t('matchPick', { text })}
                      className={cn(
                        'min-h-11 w-full cursor-grab rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                        active && 'hover:border-primary',
                        used && 'text-muted-foreground border-dashed',
                      )}
                    >
                      {text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
