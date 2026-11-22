import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learningApi } from '@/lib/api/learning';
import { practiceResult, practiceView } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { PracticeScreen } from './PracticeScreen';

vi.mock('@/lib/api/learning', () => ({
  learningApi: { practice: vi.fn(), submitPractice: vi.fn() },
}));

const api = vi.mocked(learningApi);

describe('practice flow', () => {
  beforeEach(() => {
    api.practice.mockResolvedValue(practiceView);
    api.submitPractice.mockResolvedValue(practiceResult);
  });

  it('answers 6 questions step by step, submits, shows graded result with explanations', async () => {
    renderWithProviders(<PracticeScreen courseId="c1" lessonId="les1" practiceId="p1" />);
    expect(await screen.findByRole('heading', { name: '1-amaliyot' })).toBeInTheDocument();

    // 6 step buttons
    const steps = screen.getAllByRole('button', { name: /-savolga o'tish/ });
    expect(steps).toHaveLength(6);

    await userEvent.click(screen.getByLabelText('Belgilash tili'));
    await userEvent.click(screen.getByRole('button', { name: /Keyingi/ }));
    await userEvent.click(screen.getByLabelText('Chrome'));
    await userEvent.click(screen.getByRole('button', { name: /Keyingi/ }));
    await userEvent.click(screen.getByLabelText("To'g'ri"));

    // jump to last question via the step nav
    await userEvent.click(steps[5]!);
    await userEvent.click(screen.getByLabelText('HTML5'));

    // 2 unanswered (matching + fill blank) → confirm dialog
    await userEvent.click(screen.getByRole('button', { name: 'Javoblarni topshirish' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/2 ta savolga javob berilmagan/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ha, topshirish' }));

    await waitFor(() => expect(api.submitPractice).toHaveBeenCalledTimes(1));
    const [id, answers] = api.submitPractice.mock.calls[0]!;
    expect(id).toBe('p1');
    expect(answers).toHaveLength(6);
    expect(answers[0]).toEqual({ questionId: 'q1', selectedOptionIds: ['o1'] });
    expect(answers[3]).toEqual({ questionId: 'q4' });
    // no correctness data is ever sent by the client
    expect(JSON.stringify(answers)).not.toMatch(/isCorrect/);

    expect(await screen.findByTestId('practice-percent')).toHaveTextContent('83%');
    expect(screen.getByText("5/6 to'g'ri javob")).toBeInTheDocument();
    expect(screen.getByText('Amaliyot bajarildi')).toBeInTheDocument();
    expect(screen.getByTestId('result-q2')).toHaveAttribute('data-correct', 'false');
    expect(screen.getByText('Excel brauzer emas.')).toBeInTheDocument();

    // retry resets the player
    await userEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(screen.getByLabelText('Belgilash tili')).not.toBeChecked();
  });

  it('submits without confirmation when everything is answered', async () => {
    api.practice.mockResolvedValue({
      ...practiceView,
      questions: practiceView.questions.slice(0, 1),
    });
    renderWithProviders(<PracticeScreen courseId="c1" lessonId="les1" practiceId="p1" />);
    await userEvent.click(await screen.findByLabelText('Belgilash tili'));
    await userEvent.click(screen.getByRole('button', { name: 'Javoblarni topshirish' }));
    await waitFor(() => expect(api.submitPractice).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
