import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageDashboard } from '../../frontend/src/components/UsageDashboard';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const unknownUsage = (count: number) => ({
  promptTokens: { knownCount: 0, missingCount: count, sum: 0 },
  candidateTokens: { knownCount: 0, missingCount: count, sum: 0 },
  thoughtTokens: { knownCount: 0, missingCount: count, sum: 0 },
  cachedTokens: { knownCount: 0, missingCount: count, sum: 0 },
  totalTokens: { knownCount: 0, missingCount: count, sum: 0 },
  cost: { knownCount: 0, missingCount: count, sum: null, currency: null },
});
const usage: api.UsageDashboardView = {
  revision: 4,
  logical: [
    { purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', count: 5 },
    { purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'local_fallback', count: 2 },
  ],
  attempts: [
    { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'success', count: 3,
      latency: { count: 3, sumMs: 420, maxMs: 180 }, usage: unknownUsage(3) },
    { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'timeout', count: 1,
      latency: { count: 1, sumMs: 1000, maxMs: 1000 }, usage: unknownUsage(1) },
    { purpose: 'analysis', model: 'model-a', relation: 'initial', outcome: 'rate_limited', count: 1,
      latency: { count: 1, sumMs: 20, maxMs: 20 }, usage: unknownUsage(1) },
    { purpose: 'analysis', model: 'model-a', relation: 'initial', outcome: 'server_error', count: 2,
      latency: { count: 2, sumMs: 60, maxMs: 40 }, usage: unknownUsage(2) },
  ], retryCount: 1, modelFallbackCount: 1, localFallbackCount: 2,
};
function coachingUsage(): NonNullable<api.UsageDashboardView['coach']> {
  return { runCount: 1, stepCount: 2, providerAttemptCount: 2, toolAttemptCount: 1,
    toolExecutionCount: 1, toolRejectionCount: 0, validationCount: 5, validationRejectedCount: 0,
    retryCount: 0, modelFallbackCount: 0, stopReasons: [{ reason: 'completed', count: 1 }],
    latency: { count: 1, sumMs: 300, maxMs: 300 },
    attempts: [1, 2].map(stepOrdinal => ({ stepOrdinal, model: 'coach-model', relation: 'initial',
      outcome: 'success', count: 1, latency: { count: 1, sumMs: 100, maxMs: 100 },
      usage: unknownUsage(1) })) };
}
describe('local usage dashboard', () => {
  it('shows a coach-only run as one generation, two provider attempts and one local tool', async () => {
    vi.spyOn(api, 'loadUsage').mockResolvedValue({ ...usage, logical: [], attempts: [],
      retryCount: 0, modelFallbackCount: 0, localFallbackCount: 0, coach: coachingUsage() });
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByTestId('total-requests')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('successful-requests')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('provider-attempt-count')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('provider-success-count')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('coach-count')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('coach-steps')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('coach-tools')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('analysis-count')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('bot-count')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('usage-total-tokens')).toHaveTextContent('Nepoznato');
    expect(screen.getByTestId('usage-cost')).toHaveTextContent('Nepoznato');
    expect(screen.getByTestId('coach-duration')).toHaveTextContent('300 / 300 ms');
    expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry: 0');
  });
  it('polls a failed and retried coaching aggregate into mixed totals without double counting', async () => {
    vi.useFakeTimers();
    const coach = coachingUsage();
    coach.runCount = 2; coach.stepCount = 3; coach.providerAttemptCount = 4;
    coach.retryCount = 1; coach.modelFallbackCount = 1;
    coach.stopReasons.push({ reason: 'provider_failed', count: 1 });
    coach.attempts.push({ ...coach.attempts[0]!, relation: 'same_model_retry', outcome: 'timeout',
      count: 2, latency: { count: 2, sumMs: 400, maxMs: 200 } });
    coach.attempts[1]!.usage.totalTokens = { knownCount: 1, missingCount: 0, sum: 42 };
    vi.spyOn(api, 'loadUsage').mockResolvedValueOnce(usage).mockResolvedValue({ ...usage, coach });
    render(<UsageDashboard />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByTestId('total-requests')).toHaveTextContent(/^9$/);
    expect(screen.getByTestId('successful-requests')).toHaveTextContent(/^6$/);
    expect(screen.getByTestId('provider-attempt-count')).toHaveTextContent(/^11$/);
    expect(screen.getByTestId('failed-requests')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('error-count')).toHaveTextContent(/^6$/);
    expect(screen.getByTestId('bot-count')).toHaveTextContent(/^5$/);
    expect(screen.getByTestId('analysis-count')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('coach-count')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('usage-total-tokens')).toHaveTextContent('42 (delimično)');
    expect(screen.getByTestId('retry-count')).toHaveTextContent('Retry: 1 | model fallback: 1');
    expect(screen.getByTestId('coach-recovery')).toHaveTextContent('retry pokušaji: 1 | model fallback pokušaji: 1');
    expect(screen.getByText('provider_failed')).toBeInTheDocument();
  });
  it('does not restore coaching metrics from a late pre-reset response', async () => {
    vi.useFakeTimers();
    const mixed = { ...usage, coach: coachingUsage() };
    let finish!: (value: api.UsageDashboardView) => void;
    const empty = { ...usage, revision: 5, logical: [], attempts: [], coach: {
      ...coachingUsage(), runCount: 0, attempts: [], stopReasons: [] } };
    vi.spyOn(api, 'loadUsage').mockResolvedValueOnce(mixed)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(empty);
    vi.spyOn(api, 'resetUsage').mockResolvedValue(empty);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UsageDashboard />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /resetuj metrike/i })); });
    await act(async () => { finish(mixed); await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText(/nema zabeleženih AI zahteva/i)).toBeVisible();
    expect(screen.queryByTestId('coach-count')).not.toBeInTheDocument();
  });
  it('automatically displays completed bot and analysis calls without hiding existing metrics', async () => {
    vi.useFakeTimers();
    const updated = structuredClone(usage);
    updated.logical[0]!.count++;
    updated.logical[1]!.count++;
    let finish!: (value: api.UsageDashboardView) => void;
    const load = vi.spyOn(api, 'loadUsage').mockResolvedValueOnce(usage)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<UsageDashboard />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('total-requests')).toHaveTextContent('7');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { finish(updated); });
    expect(screen.getByTestId('total-requests')).toHaveTextContent('9');
    expect(screen.getByTestId('successful-requests')).toHaveTextContent('6');
    expect(screen.getByTestId('analysis-count')).toHaveTextContent('3');
  });
  it('reloads on reopening and stops polling when closed or unmounted', async () => {
    vi.useFakeTimers();
    const load = vi.spyOn(api, 'loadUsage').mockResolvedValue(usage);
    const { unmount } = render(<UsageDashboard />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(load).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: /AI upotreba/i });
    await act(async () => { fireEvent.click(toggle); });
    fireEvent.click(toggle);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(toggle); });
    expect(load).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('ignores a late response from before the panel was reopened', async () => {
    let finish!: (value: api.UsageDashboardView) => void;
    const load = vi.spyOn(api, 'loadUsage')
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue(usage);
    render(<UsageDashboard />);
    const toggle = screen.getByRole('button', { name: /AI upotreba/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await act(async () => { fireEvent.click(toggle); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { finish({ ...usage, logical: [] }); });
    expect(screen.getByTestId('total-requests')).toHaveTextContent('7');
  });
  it('does not let a background response undo a reset and resumes refreshing afterwards', async () => {
    vi.useFakeTimers();
    let finish!: (value: api.UsageDashboardView) => void;
    let finishReset!: (value: api.UsageDashboardView) => void;
    const empty = { ...usage, revision: 5, logical: [], attempts: [] };
    const load = vi.spyOn(api, 'loadUsage').mockResolvedValueOnce(usage)
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue(empty);
    vi.spyOn(api, 'resetUsage').mockImplementation(() => new Promise(resolve => { finishReset = resolve; }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UsageDashboard />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(load).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /resetuj metrike/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { finishReset(empty); });
    await act(async () => { finish(usage); });
    expect(screen.getByText(/nema zabeleženih AI zahteva/i)).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('explains a confirmed overload without exposing provider messages', async () => {
    const overloaded = structuredClone(usage);
    overloaded.attempts[3]!.diagnostic = { httpStatus: 503, providerCode: 'UNAVAILABLE', reason: 'high_demand' };
    vi.spyOn(api, 'loadUsage').mockResolvedValue(overloaded);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByText(/HTTP 503.*UNAVAILABLE.*preopterećen/i)).toBeInTheDocument();
  });
  it('shows loading and empty state', async () => {
    vi.spyOn(api, 'loadUsage').mockResolvedValue({ ...usage, revision: 0, logical: [], attempts: [], retryCount: 0, modelFallbackCount: 0, localFallbackCount: 0 });
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(screen.getByLabelText('Učitavanje AI metrika')).toBeVisible();
    expect(await screen.findByText(/nema zabeleženih AI zahteva/i)).toBeVisible();
  });
  it('aggregates requests, successes, fallback, failures, duration and analyses', async () => {
    vi.spyOn(api, 'loadUsage').mockResolvedValue(usage);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByTestId('total-requests')).toHaveTextContent('7');
    expect(screen.getByTestId('successful-requests')).toHaveTextContent('5');
    expect(screen.getByTestId('fallback-count')).toHaveTextContent('2');
    expect(screen.getByTestId('error-count')).toHaveTextContent('4');
    expect(screen.getByTestId('average-latency')).toHaveTextContent('214 ms');
    expect(screen.getByTestId('analysis-count')).toHaveTextContent('2');
    expect(screen.getByText('Logical requests')).toBeVisible();
    expect(screen.getByText('Attempts')).toBeVisible();
    expect(screen.getByTestId('retry-count')).toHaveTextContent('1');
    expect(screen.getByTestId('latency-summary')).toHaveTextContent('7 / 214 / 1000 ms');
    expect(document.body).not.toHaveTextContent(/api.?key|raw prompt|holeCards|stack trace/i);
  });
  it('shows partial token usage and labels missing cost as unknown', async () => {
    const partial = structuredClone(usage);
    partial.attempts[0]!.usage = {
      promptTokens: { knownCount: 1, missingCount: 2, sum: 900 },
      candidateTokens: { knownCount: 1, missingCount: 2, sum: 80 },
      thoughtTokens: { knownCount: 0, missingCount: 3, sum: 0 },
      cachedTokens: { knownCount: 0, missingCount: 3, sum: 0 },
      totalTokens: { knownCount: 1, missingCount: 2, sum: 980 },
      cost: { knownCount: 0, missingCount: 3, sum: null, currency: null },
    };
    vi.spyOn(api, 'loadUsage').mockResolvedValue(partial);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));

    expect(await screen.findByTestId('usage-total-tokens')).toHaveTextContent('980 (delimično)');
    expect(screen.getByTestId('usage-cost')).toHaveTextContent('Nepoznato');
    await screen.getByText('Attempts').click();
    expect(screen.getAllByText(/980/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nepoznato/).length).toBeGreaterThan(0);
  });
  it('distinguishes fully known and completely unknown token usage', async () => {
    const known = structuredClone(usage);
    known.attempts = [{ ...known.attempts[0]!, count: 1, latency: { count: 1, sumMs: 8, maxMs: 8 },
      usage: { ...unknownUsage(0), totalTokens: { knownCount: 1, missingCount: 0, sum: 42 },
        cost: { knownCount: 0, missingCount: 1, sum: null, currency: null } } }];
    vi.spyOn(api, 'loadUsage').mockResolvedValue(known);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByTestId('usage-total-tokens')).toHaveTextContent(/^42$/);
    cleanup();

    vi.mocked(api.loadUsage).mockResolvedValue({ ...usage, attempts: [usage.attempts[1]!] });
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByTestId('usage-total-tokens')).toHaveTextContent('Nepoznato');
  });
  it('confirms reset, prevents duplicates and refreshes snapshot', async () => {
    vi.spyOn(api, 'loadUsage').mockResolvedValue(usage);
    const reset = vi.spyOn(api, 'resetUsage').mockResolvedValue({ ...usage, revision: 5, logical: [], attempts: [] });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    const button = await screen.findByRole('button', { name: /resetuj metrike/i });
    fireEvent.click(button); expect(reset).not.toHaveBeenCalled();
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(reset).toHaveBeenCalledWith(4);
  });
  it('offers retry after loading error', async () => {
    vi.spyOn(api, 'loadUsage').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(usage);
    render(<UsageDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /AI upotreba/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nije moguće/i);
    fireEvent.click(screen.getByRole('button', { name: /pokušaj ponovo/i }));
    expect(await screen.findByTestId('successful-requests')).toHaveTextContent('5');
  });
});
