// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { normalizeCompleteness } from '@/lib/api/admin/content';
import type { AdminPractice, AdminQuestion, Completeness } from '@/lib/api/admin/types';
import { QuestionsPanel } from '../questions/QuestionsPanel';
import { renderAdmin } from '../test-utils';
import {
  canAddPractice,
  canAddQuestion,
  canPublish,
  counterState,
  lessonQuestionTotals,
} from './completeness';
import { PracticesBoard, PublishControl } from './PracticesBoard';

const practice = (i: number): AdminPractice => ({
  id: `p${i}`,
  lessonId: 'l1',
  title: `Amaliyot ${i}`,
  description: null,
  position: i,
  isRequired: true,
  passScore: 0,
});

const completeness = (perPractice: number[]): Completeness =>
  normalizeCompleteness({
    practices: perPractice.length,
    required: 4,
    questionsPerPractice: perPractice.map((questions, i) => ({
      practiceId: `p${i + 1}`,
      questions,
    })),
    ready: perPractice.length === 4 && perPractice.every((q) => q === 6),
  });

const question = (i: number): AdminQuestion => ({
  id: `q${i}`,
  type: 'TRUE_FALSE',
  prompt: `Savol ${i}`,
  imageUrl: null,
  explanation: null,
  isMultiple: false,
  points: 1,
  position: i,
  options: [],
});

describe('4×6 rules (pure)', () => {
  it('allows adding practices only below 4 and questions only below 6', () => {
    expect(canAddPractice(3)).toBe(true);
    expect(canAddPractice(4)).toBe(false);
    expect(canAddQuestion(5)).toBe(true);
    expect(canAddQuestion(6)).toBe(false);
  });

  it('counter state and lesson totals', () => {
    expect(counterState(3, 4)).toBe('incomplete');
    expect(counterState(4, 4)).toBe('complete');
    expect(counterState(7, 6)).toBe('over');
    expect(lessonQuestionTotals(completeness([6, 6, 5]))).toEqual({ have: 17, need: 24 });
  });

  it('publish depends on the server flag', () => {
    expect(canPublish(undefined)).toBe(false);
    expect(canPublish(completeness([6, 6, 6, 5]))).toBe(false);
    expect(canPublish(completeness([6, 6, 6, 6]))).toBe(true);
  });

  it('normalises both completeness shapes', () => {
    const shared = normalizeCompleteness({
      practices: 2,
      practicesRequired: 4,
      questionsPerPractice: [
        { practiceId: 'a', questions: 6, required: 6 },
        { practiceId: 'b', questions: 1, required: 6 },
      ],
      isComplete: false,
    });
    expect(shared).toMatchObject({ practices: 2, required: 4, questionsRequired: 6, ready: false });
    const numbers = normalizeCompleteness({
      practices: 4,
      required: 4,
      questionsPerPractice: [6, 6, 6, 6],
    });
    expect(numbers.ready).toBe(true);
    expect(numbers.questionsPerPractice[2]).toEqual({ practiceId: '2', questions: 6 });
  });
});

describe('PracticesBoard', () => {
  it('shows "Amaliyotlar 3/4" and per-practice question counters, add enabled', () => {
    renderAdmin(
      <PracticesBoard
        practices={[practice(1), practice(2), practice(3)]}
        completeness={completeness([6, 5, 0])}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('practices-counter')).toHaveTextContent('Amaliyotlar 3/4');
    expect(screen.getByTestId('practices-counter')).toHaveAttribute('data-state', 'incomplete');
    expect(screen.getByTestId('questions-counter-p1')).toHaveTextContent('Savollar 6/6');
    expect(screen.getByTestId('questions-counter-p1')).toHaveAttribute('data-state', 'complete');
    expect(screen.getByTestId('questions-counter-p2')).toHaveTextContent('Savollar 5/6');
    expect(screen.getByRole('button', { name: /Amaliyot qo'shish/ })).toBeEnabled();
  });

  it('disables "add practice" at 4/4', async () => {
    const onAdd = vi.fn();
    renderAdmin(
      <PracticesBoard
        practices={[1, 2, 3, 4].map(practice)}
        completeness={completeness([6, 6, 6, 6])}
        onAdd={onAdd}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('practices-counter')).toHaveTextContent('Amaliyotlar 4/4');
    const add = screen.getByRole('button', { name: /Amaliyot qo'shish/ });
    expect(add).toBeDisabled();
    await userEvent.click(add).catch(() => undefined);
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('PublishControl', () => {
  it('publish is disabled until 4×6 is complete', () => {
    renderAdmin(
      <PublishControl
        completeness={completeness([6, 6, 6, 5])}
        isPublished={false}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Darsni nashr qilish' })).toBeDisabled();
    expect(screen.getByTestId('lesson-total')).toHaveTextContent('23/24');
    expect(screen.getByText(/4 ta amaliyot va har birida 6 ta savol/)).toBeInTheDocument();
  });

  it('publish is enabled when complete and calls onPublish', async () => {
    const onPublish = vi.fn();
    renderAdmin(
      <PublishControl
        completeness={completeness([6, 6, 6, 6])}
        isPublished={false}
        onPublish={onPublish}
        onUnpublish={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Darsni nashr qilish' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it('publish is disabled while completeness is unknown', () => {
    renderAdmin(
      <PublishControl
        completeness={undefined}
        isPublished={false}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Darsni nashr qilish' })).toBeDisabled();
  });
});

describe('QuestionsPanel with the 6-question limit', () => {
  const noop = vi.fn(async () => undefined);
  it('shows "Savollar 5/6" with add enabled', () => {
    renderAdmin(
      <QuestionsPanel
        title="Savollar"
        questions={[1, 2, 3, 4, 5].map(question)}
        limit={6}
        onCreate={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByTestId('questions-counter')).toHaveTextContent('Savollar 5/6');
    expect(screen.getByRole('button', { name: /Savol qo'shish/ })).toBeEnabled();
  });

  it('disables add at 6/6', () => {
    renderAdmin(
      <QuestionsPanel
        title="Savollar"
        questions={[1, 2, 3, 4, 5, 6].map(question)}
        limit={6}
        onCreate={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByTestId('questions-counter')).toHaveTextContent('Savollar 6/6');
    expect(screen.getByRole('button', { name: /Savol qo'shish/ })).toBeDisabled();
    expect(within(document.body).getAllByText(/chegaraga yetildi/).length).toBeGreaterThan(0);
  });

  it('exam pools have no limit', () => {
    renderAdmin(
      <QuestionsPanel
        title="Pool"
        questions={[1, 2, 3, 4, 5, 6, 7].map(question)}
        onCreate={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByTestId('questions-counter')).toBeNull();
    expect(screen.getByRole('button', { name: /Savol qo'shish/ })).toBeEnabled();
  });
});
