import type { PublicQuestion, QuestionAnswer } from '@onlinedars/shared';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { fillBlank, imageBased, matching, mcMulti, mcSingle, trueFalse } from '@/test/fixtures';
import { QuestionView } from './QuestionView';

function Harness({
  question,
  onAnswer,
}: {
  question: PublicQuestion;
  onAnswer?: (a: QuestionAnswer) => void;
}) {
  const [value, setValue] = useState<QuestionAnswer>({ questionId: question.id });
  return (
    <QuestionView
      number={1}
      total={6}
      question={question}
      value={value}
      onChange={(a) => {
        setValue(a);
        onAnswer?.(a);
      }}
    />
  );
}

describe('MULTIPLE_CHOICE single', () => {
  it('renders radios and keeps one selection', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={mcSingle} onAnswer={onAnswer} />);
    expect(screen.getByRole('heading', { name: 'HTML nima?' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    await userEvent.click(screen.getByLabelText('Belgilash tili'));
    await userEvent.click(screen.getByLabelText('Dasturlash tili'));
    expect(onAnswer).toHaveBeenLastCalledWith({ questionId: 'q1', selectedOptionIds: ['o2'] });
    expect(screen.getByLabelText('Dasturlash tili')).toBeChecked();
    expect(screen.getByLabelText('Belgilash tili')).not.toBeChecked();
  });
});

describe('MULTIPLE_CHOICE multi', () => {
  it('renders checkboxes and allows several', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={mcMulti} onAnswer={onAnswer} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByText("Barcha to'g'ri javoblarni tanlang")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Chrome'));
    await userEvent.click(screen.getByLabelText('Firefox'));
    expect(onAnswer).toHaveBeenLastCalledWith({
      questionId: 'q2',
      selectedOptionIds: ['m1', 'm2'],
    });
  });
});

describe('TRUE_FALSE', () => {
  it('shows two radio options', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={trueFalse} onAnswer={onAnswer} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    await userEvent.click(screen.getByLabelText("Noto'g'ri"));
    expect(onAnswer).toHaveBeenLastCalledWith({ questionId: 'q3', selectedOptionIds: ['t2'] });
  });
});

describe('IMAGE_BASED', () => {
  it('shows the question image and options', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={imageBased} onAnswer={onAnswer} />);
    expect(screen.getByRole('img', { name: 'Savol rasmi' })).toHaveAttribute(
      'src',
      imageBased.imageUrl,
    );
    await userEvent.click(screen.getByLabelText('CSS3'));
    expect(onAnswer).toHaveBeenLastCalledWith({ questionId: 'q6', selectedOptionIds: ['i2'] });
  });
});

describe('MATCHING', () => {
  it('pairs by clicking a left item then a target (keyboard accessible)', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={matching} onAnswer={onAnswer} />);
    const left = screen.getByRole('button', { name: /<a> — juftlash/ });
    await userEvent.click(left);
    expect(left).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Havola javobini tanlash' }));
    expect(onAnswer).toHaveBeenLastCalledWith({
      questionId: 'q4',
      matches: [{ optionId: 'l1', matchText: 'Havola' }],
    });
    expect(screen.getByTestId('match-value-l1')).toHaveTextContent('Havola');

    // keyboard: focus + Enter
    screen.getByRole('button', { name: /<img> — juftlash/ }).focus();
    await userEvent.keyboard('{Enter}');
    screen.getByRole('button', { name: 'Rasm javobini tanlash' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('match-value-l2')).toHaveTextContent('Rasm');

    // remove a pair
    await userEvent.click(screen.getByRole('button', { name: 'Juftlikni olib tashlash: <a>' }));
    expect(screen.queryByTestId('match-value-l1')).not.toBeInTheDocument();
  });

  it('pairs by drag and drop', () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={matching} onAnswer={onAnswer} />);
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => (store[k] = v),
      getData: (k: string) => store[k] ?? '',
      effectAllowed: 'move',
    };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Rasm javobini tanlash' }), {
      dataTransfer,
    });
    const target = screen.getByTestId('match-left-l2');
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onAnswer).toHaveBeenLastCalledWith({
      questionId: 'q4',
      matches: [{ optionId: 'l2', matchText: 'Rasm' }],
    });
  });

  it('review mode shows the correct pair for a wrong match', () => {
    renderWithProviders(
      <QuestionView
        number={1}
        question={matching}
        value={{ questionId: 'q4', matches: [{ optionId: 'l1', matchText: 'Rasm' }] }}
        onChange={() => undefined}
        disabled
        review={{
          matches: [
            { optionId: 'l1', matchText: 'Havola' },
            { optionId: 'l2', matchText: 'Rasm' },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('match-left-l1')).toHaveAttribute('data-review', 'wrong');
    expect(screen.getAllByText(/To'g'ri javob/)[0]).toHaveTextContent('Havola');
  });
});

describe('FILL_BLANK', () => {
  it('renders an input per blank inline with the prompt', async () => {
    const onAnswer = vi.fn();
    renderWithProviders(<Harness question={fillBlank} onAnswer={onAnswer} />);
    const first = screen.getByRole('textbox', { name: "1-bo'sh joy" });
    const second = screen.getByRole('textbox', { name: "2-bo'sh joy" });
    expect(screen.getByText(/Sarlavha tegi/)).toBeInTheDocument();
    await userEvent.type(first, 'h1');
    await userEvent.type(second, 'p');
    expect(onAnswer).toHaveBeenLastCalledWith({ questionId: 'q5', blanks: ['h1', 'p'] });
  });

  it('review mode marks blanks and shows accepted answers (case-insensitive)', () => {
    renderWithProviders(
      <QuestionView
        number={1}
        question={fillBlank}
        value={{ questionId: 'q5', blanks: ['H1', 'div'] }}
        onChange={() => undefined}
        disabled
        review={{ blanks: [['h1'], ['p']] }}
      />,
    );
    const [a, b] = screen.getAllByRole('textbox');
    expect(a).toHaveAttribute('data-review', 'correct');
    expect(b).toHaveAttribute('data-review', 'wrong');
    expect(screen.getByText('p')).toBeInTheDocument();
  });
});
