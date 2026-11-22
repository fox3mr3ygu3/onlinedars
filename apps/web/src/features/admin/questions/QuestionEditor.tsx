'use client';

import { type QuestionInput, QuestionType } from '@onlinedars/shared';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUploadField } from '../common/controls';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import { CheckboxField, Field, NativeSelect, Textarea } from '../common/ui';
import {
  type FieldError,
  type QuestionDraft,
  blanksOf,
  changeType,
  emptyOption,
  emptyQuestion,
  errorsAt,
  toggleCorrect,
  validateQuestion,
} from './questionModel';

/**
 * Editor for all 5 question types. Validates on submit with the shared zod schema
 * (`questionInputSchema` + `validateQuestionShape`); the API validates again.
 */
export function QuestionEditor({
  initial,
  onSubmit,
  onCancel,
  isEdit,
}: {
  initial?: QuestionDraft;
  onSubmit: (input: QuestionInput) => Promise<unknown>;
  onCancel?: () => void;
  isEdit?: boolean;
}) {
  const t = useTranslations('admin.questionEditor');
  const tTypes = useTranslations('admin.questions.types');
  const tRoot = useTranslations();
  const errMsg = useApiErrorMessage();
  const labels = useMemo(() => ({ trueLabel: t('trueLabel'), falseLabel: t('falseLabel') }), [t]);
  const [d, setD] = useState<QuestionDraft>(
    () => initial ?? emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const msg = (e: FieldError) => (tRoot.has(e.message) ? tRoot(e.message) : t('invalid'));
  const errText = (path: string) => {
    const list = errorsAt(errors, path);
    return list.length ? list.map(msg).join(' ') : undefined;
  };
  const setOption = (i: number, patch: Partial<QuestionDraft['options'][number]>) =>
    setD((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const removeOption = (i: number) =>
    setD((x) => ({ ...x, options: x.options.filter((_, j) => j !== i) }));
  const addOption = (patch: Partial<QuestionDraft['options'][number]> = {}) =>
    setD((x) => ({ ...x, options: [...x.options, emptyOption(patch)] }));

  const submit = async () => {
    const r = validateQuestion(d);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors([]);
    setServerError(null);
    setBusy(true);
    try {
      await onSubmit(r.value);
    } catch (e) {
      setServerError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const choice = d.type === QuestionType.MULTIPLE_CHOICE || d.type === QuestionType.IMAGE_BASED;
  const blanks = d.type === QuestionType.FILL_BLANK ? blanksOf(d.prompt) : [];
  const optionsErr = errText('options');

  return (
    <form
      noValidate
      aria-label={isEdit ? t('editTitle') : t('newTitle')}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label={t('type')}>
          {(id) => (
            <NativeSelect
              id={id}
              value={d.type}
              onChange={(e) => {
                setD((x) => changeType(x, e.target.value as QuestionType, labels));
                setErrors([]);
              }}
            >
              {Object.values(QuestionType).map((ty) => (
                <option key={ty} value={ty}>
                  {tTypes(ty)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label={t('points')} error={errText('points')}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={100}
              value={d.points}
              onChange={(e) => setD((x) => ({ ...x, points: Number(e.target.value) || 0 }))}
            />
          )}
        </Field>
      </div>

      <Field
        label={t('prompt')}
        hint={d.type === QuestionType.FILL_BLANK ? t('promptFillBlankHint') : undefined}
        error={errText('prompt')}
      >
        {(id, describedBy) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={!!errText('prompt')}
            rows={3}
            value={d.prompt}
            onChange={(e) => setD((x) => ({ ...x, prompt: e.target.value }))}
          />
        )}
      </Field>

      {(d.type === QuestionType.IMAGE_BASED || d.imageUrl) && (
        <div className="grid gap-1">
          <FileUploadField
            label={t('image')}
            image
            purpose="question-image"
            value={d.imageUrl}
            onChange={(u) => setD((x) => ({ ...x, imageUrl: u ?? '' }))}
          />
          <Field label={t('imageUrl')} error={errText('imageUrl')}>
            {(id) => (
              <Input
                id={id}
                type="url"
                placeholder="https://"
                value={d.imageUrl}
                onChange={(e) => setD((x) => ({ ...x, imageUrl: e.target.value }))}
              />
            )}
          </Field>
        </div>
      )}
      {d.type !== QuestionType.IMAGE_BASED && !d.imageUrl && (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-sm">{t('image')}</summary>
          <div className="mt-2">
            <FileUploadField
              label={t('image')}
              image
              purpose="question-image"
              value={d.imageUrl}
              onChange={(u) => setD((x) => ({ ...x, imageUrl: u ?? '' }))}
            />
          </div>
        </details>
      )}

      {/* ---------- options per type ---------- */}
      {choice && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t('options')}</legend>
          <CheckboxField
            label={t('isMultiple')}
            checked={d.isMultiple}
            onChange={(e) => {
              const isMultiple = e.target.checked;
              setD((x) => ({
                ...x,
                isMultiple,
                // going back to single answer: keep only the first correct option
                options: isMultiple
                  ? x.options
                  : x.options.map((o, i) => ({
                      ...o,
                      isCorrect: o.isCorrect && i === x.options.findIndex((p) => p.isCorrect),
                    })),
              }));
            }}
          />
          {d.options.map((o, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-md border p-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type={d.isMultiple ? 'checkbox' : 'radio'}
                  name="correct"
                  className="accent-primary size-4"
                  checked={o.isCorrect}
                  onChange={() => setD((x) => toggleCorrect(x, i))}
                  aria-label={`${t('correct')}: ${t('option', { n: i + 1 })}`}
                />
                <span className="sm:sr-only">{t('correct')}</span>
              </label>
              <div className="grid gap-1">
                <Input
                  aria-label={t('option', { n: i + 1 })}
                  placeholder={t('option', { n: i + 1 })}
                  value={o.text}
                  aria-invalid={!!errText(`options.${i}.text`)}
                  onChange={(e) => setOption(i, { text: e.target.value })}
                />
                {d.type === QuestionType.IMAGE_BASED && (
                  <Input
                    aria-label={t('optionImage')}
                    placeholder={t('optionImage')}
                    type="url"
                    value={o.imageUrl}
                    onChange={(e) => setOption(i, { imageUrl: e.target.value })}
                  />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${t('removeOption')} ${i + 1}`}
                disabled={d.options.length <= 2}
                onClick={() => removeOption(i)}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={d.options.length >= 12}
              onClick={() => addOption()}
            >
              <Plus aria-hidden />
              {t('addOption')}
            </Button>
          </div>
        </fieldset>
      )}

      {d.type === QuestionType.TRUE_FALSE && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t('correctAnswer')}</legend>
          <div className="flex flex-wrap gap-4">
            {d.options.map((o, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="tf-correct"
                  className="accent-primary size-4"
                  checked={o.isCorrect}
                  onChange={() => setD((x) => toggleCorrect(x, i))}
                />
                {o.text}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {d.type === QuestionType.MATCHING && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t('pairs')}</legend>
          {d.options.map((o, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
            >
              <Input
                aria-label={t('pairLeft', { n: i + 1 })}
                placeholder={t('pairLeft', { n: i + 1 })}
                value={o.text}
                aria-invalid={!!errText(`options.${i}.text`)}
                onChange={(e) => setOption(i, { text: e.target.value })}
              />
              <Input
                aria-label={t('pairRight', { n: i + 1 })}
                placeholder={t('pairRight', { n: i + 1 })}
                value={o.matchText}
                aria-invalid={!!errText(`options.${i}.matchText`)}
                onChange={(e) => setOption(i, { matchText: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${t('removePair')} ${i + 1}`}
                disabled={d.options.length <= 2}
                onClick={() => removeOption(i)}
              >
                <Trash2 aria-hidden />
              </Button>
              {(errText(`options.${i}.matchText`) || errText(`options.${i}.text`)) && (
                <p role="alert" className="text-destructive text-sm sm:col-span-3">
                  {errText(`options.${i}.matchText`) ?? errText(`options.${i}.text`)}
                </p>
              )}
            </div>
          ))}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={d.options.length >= 12}
              onClick={() => addOption()}
            >
              <Plus aria-hidden />
              {t('addPair')}
            </Button>
          </div>
        </fieldset>
      )}

      {d.type === QuestionType.FILL_BLANK && (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">{t('blanks')}</legend>
          {blanks.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('noBlanksYet')}</p>
          )}
          {blanks.map((b) => {
            const token = `{{${b}}}`;
            return (
              <div key={b} className="grid gap-2 rounded-md border p-2">
                <p className="text-sm font-medium">{t('blankLabel', { n: token })}</p>
                {d.options.map((o, i) =>
                  o.blankIndex === b ? (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        aria-label={`${t('blankAnswer')} ${token}`}
                        placeholder={t('blankAnswer')}
                        value={o.text}
                        aria-invalid={!!errText(`options.${i}.text`)}
                        onChange={(e) => setOption(i, { text: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('removeAnswer')}
                        onClick={() => removeOption(i)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null,
                )}
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={d.options.length >= 12}
                    onClick={() => addOption({ blankIndex: b, isCorrect: true })}
                  >
                    <Plus aria-hidden />
                    {t('addAnswerFor', { n: token })}
                  </Button>
                </div>
              </div>
            );
          })}
          {/* answers for blanks that are no longer in the prompt */}
          {d.options.some((o) => o.blankIndex == null || !blanks.includes(o.blankIndex)) && (
            <div className="grid gap-2">
              {d.options.map((o, i) =>
                o.blankIndex == null || !blanks.includes(o.blankIndex) ? (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={o.text} aria-label={t('blankAnswer')} aria-invalid readOnly />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('removeAnswer')}
                      onClick={() => removeOption(i)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </fieldset>
      )}

      {optionsErr && (
        <p role="alert" className="text-destructive text-sm" data-testid="options-error">
          {optionsErr}
        </p>
      )}
      {errors.some((e) => e.path.startsWith('options.') && e.path.endsWith('.blankIndex')) && (
        <p role="alert" className="text-destructive text-sm">
          {tRoot('validation.blankIndex')}
        </p>
      )}

      <Field label={t('explanation')} error={errText('explanation')}>
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={d.explanation}
            onChange={(e) => setD((x) => ({ ...x, explanation: e.target.value }))}
          />
        )}
      </Field>

      {errors.length > 0 && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {t('fixErrors')}
        </p>
      )}
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tRoot('admin.common.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {isEdit ? t('submitUpdate') : t('submitCreate')}
        </Button>
      </div>
    </form>
  );
}
