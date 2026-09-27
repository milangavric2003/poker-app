import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageDashboard } from '../../frontend/src/components/UsageDashboard';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const usage: api.UsageDashboardView = {
  revision: 4,
  logical: [
    { purpose: 'bot', initialModel: 'model-a', finalOutcome: 'model_success', count: 5 },
    { purpose: 'analysis', initialModel: 'model-a', finalOutcome: 'local_fallback', count: 2 },
  ],
  attempts: [
    { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'success', count: 3, latency: { count: 3, sumMs: 420, maxMs: 180 } },
    { purpose: 'bot', model: 'model-a', relation: 'initial', outcome: 'timeout', count: 1, latency: { count: 1, sumMs: 1000, maxMs: 1000 } },
    { purpose: 'analysis', model: 'model-a', relation: 'initial', outcome: 'rate_limited', count: 1, latency: { count: 1, sumMs: 20, maxMs: 20 } },
    { purpose: 'analysis', model: 'model-a', relation: 'initial', outcome: 'server_error', count: 2, latency: { count: 2, sumMs: 60, maxMs: 40 } },
  ], retryCount: 1, modelFallbackCount: 1, localFallbackCount: 2,
};
describe('local usage dashboard', () => {
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
