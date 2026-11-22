import {
  type QuestionInput,
  QuestionType,
  blankIndexesIn,
  questionInputSchema,
} from '@onlinedars/shared';
import type { AdminQuestion } from '@/lib/api/admin/types';

/** Editable form state for any of the 5 question types. */
export interface OptionDraft {
  text: string;
  imageUrl: string;
  isCorrect: boolean;
  matchText: string;
  blankIndex: number | null;
}

export interface QuestionDraft {
  type: QuestionType;
  prompt: string;
  imageUrl: string;
  explanation: string;
  isMultiple: boolean;
  points: number;
  options: OptionDraft[];
}

export interface TrueFalseLabels {
  trueLabel: string;
  falseLabel: string;
}

export const emptyOption = (patch: Partial<OptionDraft> = {}): OptionDraft => ({
  text: '',
  imageUrl: '',
  isCorrect: false,
  matchText: '',
  blankIndex: null,
  ...patch,
});

export function trueFalseOptions(
  labels: TrueFalseLabels,
  correct: boolean | null = true,
): OptionDraft[] {
  return [
    emptyOption({ text: labels.trueLabel, isCorrect: correct === true }),
    emptyOption({ text: labels.falseLabel, isCorrect: correct === false }),
  ];
}

/** Starting options when the admin picks a type. */
export function optionsForType(type: QuestionType, labels: TrueFalseLabels): OptionDraft[] {
  switch (type) {
    case QuestionType.TRUE_FALSE:
      return trueFalseOptions(labels);
    case QuestionType.MATCHING:
      return [emptyOption(), emptyOption()];
    case QuestionType.FILL_BLANK:
      return [emptyOption({ blankIndex: 0, isCorrect: true })];
    default:
      return [emptyOption(), emptyOption()];
  }
}

export function emptyQuestion(type: QuestionType, labels: TrueFalseLabels): QuestionDraft {
  return {
    type,
    prompt: '',
    imageUrl: '',
    explanation: '',
    isMultiple: false,
    points: 1,
    options: optionsForType(type, labels),
  };
}

/** Switching type keeps prompt/explanation/image but resets options to what the type needs. */
export function changeType(
  d: QuestionDraft,
  type: QuestionType,
  labels: TrueFalseLabels,
): QuestionDraft {
  if (d.type === type) return d;
  const keepChoices =
    (d.type === QuestionType.MULTIPLE_CHOICE && type === QuestionType.IMAGE_BASED) ||
    (d.type === QuestionType.IMAGE_BASED && type === QuestionType.MULTIPLE_CHOICE);
  return {
    ...d,
    type,
    isMultiple: keepChoices ? d.isMultiple : false,
    options: keepChoices ? d.options : optionsForType(type, labels),
  };
}

/** Marks option `index` correct; single-answer types clear the others. */
export function toggleCorrect(d: QuestionDraft, index: number): QuestionDraft {
  const single =
    d.type === QuestionType.TRUE_FALSE ||
    ((d.type === QuestionType.MULTIPLE_CHOICE || d.type === QuestionType.IMAGE_BASED) &&
      !d.isMultiple);
  return {
    ...d,
    options: d.options.map((o, i) =>
      single
        ? { ...o, isCorrect: i === index }
        : i === index
          ? { ...o, isCorrect: !o.isCorrect }
          : o,
    ),
  };
}

/** Blank indexes referenced in a FILL_BLANK prompt (`{{0}}`, `{{1}}` …). */
export const blanksOf = (prompt: string) => blankIndexesIn(prompt);

const orNull = (s: string | null | undefined) => {
  const v = (s ?? '').trim();
  return v ? v : null;
};

/** Form → API body. Fields that don't belong to the type are cleared. */
export function toQuestionInput(d: QuestionDraft): QuestionInput {
  const choice = d.type === QuestionType.MULTIPLE_CHOICE || d.type === QuestionType.IMAGE_BASED;
  return {
    type: d.type,
    prompt: d.prompt.trim(),
    imageUrl: orNull(d.imageUrl),
    explanation: orNull(d.explanation),
    isMultiple: choice ? d.isMultiple : false,
    points: d.points,
    options: d.options.map((o) => ({
      text: o.text.trim(),
      imageUrl: choice ? orNull(o.imageUrl) : null,
      isCorrect:
        d.type === QuestionType.FILL_BLANK
          ? true
          : d.type === QuestionType.MATCHING
            ? false
            : o.isCorrect,
      matchText: d.type === QuestionType.MATCHING ? orNull(o.matchText) : null,
      blankIndex: d.type === QuestionType.FILL_BLANK ? o.blankIndex : null,
    })),
  };
}

export function fromQuestion(q: AdminQuestion): QuestionDraft {
  return {
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl ?? '',
    explanation: q.explanation ?? '',
    isMultiple: q.isMultiple,
    points: q.points,
    options: [...q.options]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((o) => ({
        text: o.text,
        imageUrl: o.imageUrl ?? '',
        isCorrect: o.isCorrect,
        matchText: o.matchText ?? '',
        blankIndex: o.blankIndex,
      })),
  };
}

export interface FieldError {
  /** dot path, e.g. "prompt", "options", "options.1.matchText" */
  path: string;
  /** i18n key at the root namespace (e.g. "validation.noBlanks" or "admin.questionEditor.invalid") */
  message: string;
}

export const GENERIC_INVALID = 'admin.questionEditor.invalid';

/** Client-side validation with the shared zod schema (the server validates again). */
export function validateQuestion(
  d: QuestionDraft,
): { ok: true; value: QuestionInput } | { ok: false; errors: FieldError[] } {
  const parsed = questionInputSchema.safeParse(toQuestionInput(d));
  if (parsed.success) return { ok: true, value: parsed.data };
  const seen = new Set<string>();
  const errors: FieldError[] = [];
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join('.');
    const message = issue.message.startsWith('validation.') ? issue.message : GENERIC_INVALID;
    const k = `${path}|${message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    errors.push({ path, message });
  }
  return { ok: false, errors };
}

export function errorsAt(errors: FieldError[], path: string): FieldError[] {
  return errors.filter((e) => e.path === path);
}
