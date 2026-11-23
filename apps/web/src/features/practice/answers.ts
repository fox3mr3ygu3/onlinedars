import { type PublicQuestion, type QuestionAnswer, QuestionType } from '@onlinedars/shared';

/** Draft answers keyed by question id. */
export type AnswerMap = Record<string, QuestionAnswer>;

export function emptyAnswer(questionId: string): QuestionAnswer {
  return { questionId };
}

/** Number of blanks in a FILL_BLANK prompt (server-provided count wins). */
export function blankCountOf(q: PublicQuestion): number {
  if (typeof q.blankCount === 'number') return q.blankCount;
  const found = new Set([...q.prompt.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]));
  return found.size;
}

/** True when the student gave a complete answer to the question. */
export function isAnswered(q: PublicQuestion, a: QuestionAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.TRUE_FALSE:
    case QuestionType.IMAGE_BASED:
      return (a.selectedOptionIds?.length ?? 0) > 0;
    case QuestionType.MATCHING:
      return (
        q.options.length > 0 &&
        q.options.every((o) => a.matches?.some((m) => m.optionId === o.id && m.matchText))
      );
    case QuestionType.FILL_BLANK: {
      const n = blankCountOf(q);
      if (n === 0) return false;
      for (let i = 0; i < n; i++) if (!a.blanks?.[i]?.trim()) return false;
      return true;
    }
    default:
      return false;
  }
}

export function countUnanswered(questions: PublicQuestion[], answers: AnswerMap): number {
  return questions.filter((q) => !isAnswered(q, answers[q.id])).length;
}

/** Toggle/select an option. Single-choice replaces the selection. */
export function selectOption(
  a: QuestionAnswer,
  optionId: string,
  multiple: boolean,
): QuestionAnswer {
  const current = a.selectedOptionIds ?? [];
  if (!multiple) return { ...a, selectedOptionIds: [optionId] };
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];
  return { ...a, selectedOptionIds: next };
}

/** Pairs a left option with a right-hand text. A target may be used only once. */
export function setMatch(a: QuestionAnswer, optionId: string, matchText: string): QuestionAnswer {
  const rest = (a.matches ?? []).filter(
    (m) => m.optionId !== optionId && m.matchText !== matchText,
  );
  return { ...a, matches: [...rest, { optionId, matchText }] };
}

export function removeMatch(a: QuestionAnswer, optionId: string): QuestionAnswer {
  return { ...a, matches: (a.matches ?? []).filter((m) => m.optionId !== optionId) };
}

export function setBlank(a: QuestionAnswer, index: number, value: string, count: number) {
  const blanks = Array.from({ length: Math.max(count, index + 1) }, (_, i) => a.blanks?.[i] ?? '');
  blanks[index] = value;
  return { ...a, blanks };
}

/** Payload for submit: one entry per question, in question order; trims blank answers. */
export function toSubmission(questions: PublicQuestion[], answers: AnswerMap): QuestionAnswer[] {
  return questions.map((q) => {
    const a = answers[q.id] ?? emptyAnswer(q.id);
    const out: QuestionAnswer = { questionId: q.id };
    if (a.selectedOptionIds?.length) out.selectedOptionIds = a.selectedOptionIds;
    if (a.matches?.length) out.matches = a.matches;
    if (a.blanks?.length) out.blanks = a.blanks.map((b) => b.trim());
    return out;
  });
}

export function answersFromList(list: QuestionAnswer[] | undefined): AnswerMap {
  const map: AnswerMap = {};
  for (const a of list ?? []) map[a.questionId] = a;
  return map;
}

/** Splits a FILL_BLANK prompt into text parts and blank indexes. */
export type PromptPart = { kind: 'text'; text: string } | { kind: 'blank'; index: number };

export function splitBlankPrompt(prompt: string): PromptPart[] {
  const parts: PromptPart[] = [];
  let last = 0;
  for (const m of prompt.matchAll(/\{\{(\d+)\}\}/g)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: prompt.slice(last, at) });
    parts.push({ kind: 'blank', index: Number(m[1]) });
    last = at + m[0].length;
  }
  if (last < prompt.length) parts.push({ kind: 'text', text: prompt.slice(last) });
  return parts;
}
