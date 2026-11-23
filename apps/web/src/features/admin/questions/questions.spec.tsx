// @vitest-environment jsdom
import { QuestionType } from '@onlinedars/shared';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderAdmin } from '../test-utils';
import { QuestionEditor } from './QuestionEditor';
import {
  type QuestionDraft,
  changeType,
  emptyOption,
  emptyQuestion,
  toQuestionInput,
  toggleCorrect,
  validateQuestion,
} from './questionModel';

const labels = { trueLabel: "To'g'ri", falseLabel: "Noto'g'ri" };
const messagesOf = (d: QuestionDraft) => {
  const r = validateQuestion(d);
  return r.ok ? [] : r.errors.map((e) => e.message);
};

describe('question validation per type', () => {
  it('MULTIPLE_CHOICE: needs a correct option; single answer allows only one', () => {
    const d = emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels);
    d.prompt = '2 + 2 = ?';
    d.options = [emptyOption({ text: '3' }), emptyOption({ text: '4' })];
    expect(messagesOf(d)).toContain('validation.noCorrectOption');

    const one = toggleCorrect(d, 1);
    expect(validateQuestion(one).ok).toBe(true);

    const two = { ...one, options: one.options.map((o) => ({ ...o, isCorrect: true })) };
    expect(messagesOf(two)).toContain('validation.singleCorrectOnly');
    expect(validateQuestion({ ...two, isMultiple: true }).ok).toBe(true);
  });

  it('MULTIPLE_CHOICE: at least 2 options and non-empty texts', () => {
    const d = emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels);
    d.prompt = 'Savol';
    d.options = [emptyOption({ text: 'A', isCorrect: true })];
    expect(messagesOf(d)).toContain('validation.minOptions');
    d.options = [emptyOption({ text: 'A', isCorrect: true }), emptyOption({ text: '' })];
    const r = validateQuestion(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'options.1.text')).toBe(true);
  });

  it('single-answer toggle keeps exactly one correct option', () => {
    let d = emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels);
    d.options = [
      emptyOption({ text: 'a' }),
      emptyOption({ text: 'b' }),
      emptyOption({ text: 'c' }),
    ];
    d = toggleCorrect(toggleCorrect(d, 0), 2);
    expect(d.options.map((o) => o.isCorrect)).toEqual([false, false, true]);
    d = toggleCorrect(toggleCorrect({ ...d, isMultiple: true }, 0), 1);
    expect(d.options.map((o) => o.isCorrect)).toEqual([true, true, true]);
  });

  it('TRUE_FALSE: two fixed options with exactly one correct', () => {
    const d = emptyQuestion(QuestionType.TRUE_FALSE, labels);
    d.prompt = 'Yer dumaloq';
    expect(d.options.map((o) => o.text)).toEqual(["To'g'ri", "Noto'g'ri"]);
    expect(validateQuestion(d).ok).toBe(true);
    const none = { ...d, options: d.options.map((o) => ({ ...o, isCorrect: false })) };
    expect(messagesOf(none)).toContain('validation.trueFalseOptions');
  });

  it('MATCHING: every pair needs a right-hand side; isCorrect is not sent', () => {
    const d = emptyQuestion(QuestionType.MATCHING, labels);
    d.prompt = 'Moslang';
    d.options = [
      emptyOption({ text: 'UZ', matchText: 'Toshkent' }),
      emptyOption({ text: 'KZ', matchText: '' }),
    ];
    const r = validateQuestion(d);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContainEqual({
        path: 'options.1.matchText',
        message: 'validation.required',
      });
    d.options[1]!.matchText = 'Astana';
    const ok = validateQuestion(d);
    expect(ok.ok).toBe(true);
    expect(
      toQuestionInput(d).options.every((o) => o.isCorrect === false && o.blankIndex === null),
    ).toBe(true);
  });

  it('FILL_BLANK: prompt needs {{n}} placeholders, each with an accepted answer', () => {
    const d = emptyQuestion(QuestionType.FILL_BLANK, labels);
    d.prompt = 'Poytaxt — bo‘sh';
    d.options = [emptyOption({ text: 'Toshkent', blankIndex: 0 })];
    expect(messagesOf(d)).toContain('validation.noBlanks');

    d.prompt = '{{0}} — {{1}} poytaxti';
    expect(messagesOf(d)).toContain('validation.blankWithoutAnswer');

    d.options.push(emptyOption({ text: "O'zbekiston", blankIndex: 1 }));
    expect(validateQuestion(d).ok).toBe(true);
    expect(toQuestionInput(d).options.every((o) => o.isCorrect && o.matchText === null)).toBe(true);

    d.options.push(emptyOption({ text: 'x', blankIndex: 5 }));
    expect(messagesOf(d)).toContain('validation.blankIndex');
  });

  it('IMAGE_BASED: image is required', () => {
    const d = changeType(
      { ...emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels), prompt: 'Rasmda nima?' },
      QuestionType.IMAGE_BASED,
      labels,
    );
    d.options = [emptyOption({ text: 'Mushuk', isCorrect: true }), emptyOption({ text: 'It' })];
    expect(messagesOf(d)).toContain('validation.imageRequired');
    expect(validateQuestion({ ...d, imageUrl: 'https://files.example.com/cat.png' }).ok).toBe(true);
  });

  it('changing type resets options except between MC and IMAGE_BASED', () => {
    const mc = {
      ...emptyQuestion(QuestionType.MULTIPLE_CHOICE, labels),
      options: [emptyOption({ text: 'a' })],
    };
    expect(changeType(mc, QuestionType.IMAGE_BASED, labels).options).toBe(mc.options);
    expect(changeType(mc, QuestionType.TRUE_FALSE, labels).options).toHaveLength(2);
    expect(changeType(mc, QuestionType.FILL_BLANK, labels).options[0]?.blankIndex).toBe(0);
  });
});

describe('<QuestionEditor />', () => {
  it('shows translated errors and does not submit an invalid MULTIPLE_CHOICE', async () => {
    const onSubmit = vi.fn();
    renderAdmin(<QuestionEditor onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Savol matni'), '2 + 2 = ?');
    await userEvent.type(screen.getByLabelText('Variant 1'), '3');
    await userEvent.type(screen.getByLabelText('Variant 2'), '4');
    await userEvent.click(screen.getByRole('button', { name: "Savolni qo'shish" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('options-error')).toHaveTextContent(
      "Kamida bitta to'g'ri javobni belgilang",
    );

    await userEvent.click(screen.getByLabelText("To'g'ri javob: Variant 2"));
    await userEvent.click(screen.getByRole('button', { name: "Savolni qo'shish" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      type: 'MULTIPLE_CHOICE',
      prompt: '2 + 2 = ?',
      options: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    });
  });

  it('FILL_BLANK: blanks appear from the prompt and answers are sent with blankIndex', async () => {
    const onSubmit = vi.fn();
    renderAdmin(<QuestionEditor onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByLabelText('Savol turi'), 'FILL_BLANK');
    // userEvent treats "{" as a key descriptor, so set the prompt directly
    fireEvent.change(screen.getByLabelText('Savol matni'), {
      target: { value: 'Poytaxt — {{0}}' },
    });
    expect(screen.getByText("Bo'sh joy {{0}}")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Javob {{0}}'), 'Toshkent');
    await userEvent.click(screen.getByRole('button', { name: "Savolni qo'shish" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]![0].options).toEqual([
      { text: 'Toshkent', imageUrl: null, isCorrect: true, matchText: null, blankIndex: 0 },
    ]);
  });

  it('IMAGE_BASED without an image shows "Rasm majburiy"', async () => {
    const onSubmit = vi.fn();
    renderAdmin(<QuestionEditor onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByLabelText('Savol turi'), 'IMAGE_BASED');
    await userEvent.type(screen.getByLabelText('Savol matni'), 'Bu nima?');
    await userEvent.click(screen.getByRole('button', { name: "Savolni qo'shish" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Rasm majburiy')).toBeInTheDocument();
  });

  it('shows the API error message when the server rejects (e.g. 6-question limit)', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ code: 'PRACTICE_QUESTION_LIMIT' });
    renderAdmin(<QuestionEditor onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByLabelText('Savol turi'), 'TRUE_FALSE');
    await userEvent.type(screen.getByLabelText('Savol matni'), 'Yer dumaloq');
    await userEvent.click(screen.getByRole('button', { name: "Savolni qo'shish" }));
    expect(
      await screen.findByText("Amaliyotda faqat 6 ta savol bo'lishi mumkin"),
    ).toBeInTheDocument();
  });
});
