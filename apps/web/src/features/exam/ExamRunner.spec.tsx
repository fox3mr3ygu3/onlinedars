import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamAttemptView } from '@/lib/api/learning-types';
import { fillBlank, mcSingle, trueFalse } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { examStorageKey, loadExamAnswers, saveExamAnswers } from './exam-storage';
import { ExamRunner } from './ExamRunner';
import { formatClock } from './useCountdown';

const NOW = Date.parse('2026-11-22T10:00:00.000Z');

function attempt(overrides: Partial<ExamAttemptView> = {}): ExamAttemptView {
  return {
    id: 'att1',
    examId: 'e1',
    courseId: 'c1',
    title: 'Yakuniy imtihon',
    startedAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 90_000).toISOString(),
    serverTime: new Date(NOW).toISOString(),
    timeLimitMinutes: 2,
    questions: [mcSingle, trueFalse, fillBlank],
    savedAnswers: [],
    ...overrides,
  };
}

describe('formatClock', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(500)).toBe('00:01');
  });
});

describe('ExamRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts down from the server deadline and auto-submits once at zero', () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('exam-timer')).toHaveTextContent('01:30');

    fireEvent.click(screen.getByLabelText('Belgilash tili'));
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId('exam-timer')).toHaveTextContent('01:00');
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByTestId('exam-timer')).toHaveTextContent('00:00');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [answers, auto] = onSubmit.mock.calls[0]!;
    expect(auto).toBe(true);
    expect(answers).toEqual([
      { questionId: 'q1', selectedOptionIds: ['o1'] },
      { questionId: 'q3' },
      { questionId: 'q5' },
    ]);

    act(() => vi.advanceTimersByTime(10_000));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('uses server time, not the device clock (clock skew)', () => {
    // Device clock is 10 minutes ahead of the server; 90 s should still remain.
    vi.setSystemTime(NOW + 600_000);
    const onSubmit = vi.fn();
    renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    expect(screen.getByTestId('exam-timer')).toHaveTextContent('01:30');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits immediately when the deadline already passed', () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ExamRunner
        attempt={attempt({ expiresAt: new Date(NOW - 1000).toISOString() })}
        onSubmit={onSubmit}
      />,
    );
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Array), true);
  });

  it('autosaves answers to localStorage and restores them after a reload', () => {
    const onSubmit = vi.fn();
    const first = renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText("Noto'g'ri"));
    fireEvent.change(screen.getByRole('textbox', { name: "1-bo'sh joy" }), {
      target: { value: 'h1' },
    });
    expect(loadExamAnswers('att1')).toMatchObject({
      q3: { questionId: 'q3', selectedOptionIds: ['t2'] },
      q5: { questionId: 'q5', blanks: ['h1', ''] },
    });
    first.unmount();

    renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Noto'g'ri")).toBeChecked();
    expect(screen.getByRole('textbox', { name: "1-bo'sh joy" })).toHaveValue('h1');
    expect(screen.getByTestId('exam-answered')).toHaveTextContent('1/3');
  });

  it('falls back to server-saved answers when nothing is stored locally', () => {
    renderWithProviders(
      <ExamRunner
        attempt={attempt({ savedAnswers: [{ questionId: 'q1', selectedOptionIds: ['o3'] }] })}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Ma`lumotlar bazasi')).toBeChecked();
  });

  it('keeps working when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(saveExamAnswers('x', {})).toBe(false);
    expect(loadExamAnswers('x')).toBeNull();
    const onSubmit = vi.fn();
    renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Belgilash tili'));
    expect(screen.getByLabelText('Belgilash tili')).toBeChecked();
  });

  it('ignores corrupted stored data', () => {
    window.localStorage.setItem(examStorageKey('att1'), '{not json');
    expect(loadExamAnswers('att1')).toBeNull();
    window.localStorage.setItem(examStorageKey('att1'), JSON.stringify({ v: 2, answers: [] }));
    expect(loadExamAnswers('att1')).toBeNull();
  });

  it('manual submit asks for confirmation and reports unanswered count', () => {
    const onSubmit = vi.fn();
    renderWithProviders(<ExamRunner attempt={attempt()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Imtihonni topshirish' })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/3 ta savolga javob berilmagan/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ha, topshirish' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Array), false);
    // the timer reaching zero later must not submit a second time
    act(() => vi.advanceTimersByTime(120_000));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
