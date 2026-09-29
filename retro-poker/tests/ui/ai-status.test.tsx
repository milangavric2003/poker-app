import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiStatus, type AiUiStatus } from '../../frontend/src/components/AiStatus';
import { acceptsAiSnapshot, App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';
import { GameViewSchema, HandResultSchema, type GameView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function terminalAnalysis(status: 'completed' | 'unavailable' | 'failed'): GameView {
  const base = GameViewSchema.parse(publicView());
  return GameViewSchema.parse({ ...base, status: 'won', phase: 'complete', actorId: null,
    players: base.players.map(player => ({ ...player, stack: 1000,
      streetContribution: 0, handContribution: 0 })),
    legalActions: [], totalPot: 0, pots: [], result: HandResultSchema.parse({
      ...handResult(), gameStatus: 'won' }),
    ai: { ...base.ai, mode: 'on', availability: status === 'unavailable' ? 'unavailable' : 'configured',
      analysis: { status, interactionId: crypto.randomUUID(), result: status === 'completed' ? {
        summary: 'Zavrsena analiza.', goodDecisions: [], possibleMistakes: [], nextSteps: ['Nastavi.'],
      } : null } } });
}
describe('AI status', () => {
  it.each<[AiUiStatus, RegExp]>([
    [{ kind: 'idle', mode: 'off' }, /isključen/i],
    [{ kind: 'idle', mode: 'on' }, /spreman/i],
    [{ kind: 'requesting', purpose: 'bot', attemptCount: 0 }, /AI razmišlja/i],
    [{ kind: 'success' }, /potez je prihvaćen/i],
    [{ kind: 'fallback' }, /lokalni fallback/i],
    [{ kind: 'timeout' }, /isteklo/i],
    [{ kind: 'rate_limited' }, /previše zahteva/i],
    [{ kind: 'provider_error' }, /provider nije odgovorio/i],
    [{ kind: 'cancelled' }, /otkazan/i],
    [{ kind: 'stale' }, /zastareo/i],
    [{ kind: 'missing_key' }, /nije konfigurisan/i],
    [{ kind: 'semantic_rejection' }, /nije prošao semantičku proveru/i],
  ])('renders textual accessible state', (status, expected) => {
    render(<AiStatus status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(expected);
  });
  it('labels loading and hides sensitive data', () => {
    render(<AiStatus status={{ kind: 'requesting', purpose: 'bot', attemptCount: 1 }} />);
    expect(screen.getByLabelText('AI obrađuje potez')).toBeVisible();
    expect(document.body).not.toHaveTextContent(/api.?key|raw prompt|holeCards|gemini-primary/i);
  });
  it.each([
    ['retrying', /ponavlja/i],
    ['model_fallback', /rezervni model/i],
  ] as const)('announces %s stage accessibly', (stage, expected) => {
    render(<AiStatus status={{ kind: 'requesting', purpose: 'bot', attemptCount: 1, stage }} />);
    expect(screen.getByRole('status')).toHaveTextContent(expected);
  });
  it('rejects an older or unrelated polling response', () => {
    const current = GameViewSchema.parse({ ...publicView(), version: 3, ai: {
      ...publicView().ai, mode: 'on', availability: 'configured',
      active: { interactionId: '33333333-3333-4333-8333-333333333333', purpose: 'bot',
        status: 'waiting', attemptCount: 0, model: 'private-model-label' },
    } });
    expect(acceptsAiSnapshot(current, { ...current, version: 2 })).toBe(false);
    expect(acceptsAiSnapshot(current, { ...current, ai: { ...current.ai, active: {
      ...current.ai.active!, interactionId: '44444444-4444-4444-8444-444444444444',
    } } })).toBe(false);
  });

  it('rejects a late generating snapshot after that analysis is terminal', () => {
    const interactionId = '33333333-3333-4333-8333-333333333333';
    const base = GameViewSchema.parse(publicView());
    const completed = GameViewSchema.parse({ ...base, status: 'won', phase: 'complete', actorId: null,
      players: base.players.map(player => ({ ...player, stack: 1000, streetContribution: 0, handContribution: 0 })),
      legalActions: [], totalPot: 0, pots: [], result: {
        handId: base.handId, reason: 'uncontested', gameStatus: 'won', pots: [], refunds: [],
        revealedCards: [], netChanges: [{ playerId: 'p0', amount: 5 }, { playerId: 'p1', amount: -5 }],
      }, ai: { ...base.ai, availability: 'configured', active: null,
        analysis: { status: 'completed', interactionId, result: {
          summary: 'Zavrseno.', goodDecisions: [], possibleMistakes: [], nextSteps: ['Nastavi.'],
        } } } });
    const lateGenerating = { ...completed, ai: { ...completed.ai,
      active: { interactionId, purpose: 'analysis' as const, status: 'waiting' as const,
        attemptCount: 0, model: 'model-a' },
      analysis: { status: 'generating' as const, interactionId, result: null },
    } };

    expect(acceptsAiSnapshot(completed, lateGenerating)).toBe(false);
  });

  it.each([
    ['completed', /analiza je zavrsena/i],
    ['unavailable', /analiza nije dostupna/i],
    ['failed', /analiza nije uspela/i],
  ] as const)('maps public analysis %s to an accessible terminal status', async (state, label) => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(terminalAnalysis(state));
    render(<App />);
    expect(await screen.findByRole('status')).toHaveTextContent(label);
  });

  it('disables all human action controls while a bot interaction is active', async () => {
    const base = GameViewSchema.parse(publicView());
    const active = GameViewSchema.parse({ ...base, ai: { ...base.ai, mode: 'on', availability: 'configured',
      active: { interactionId: crypto.randomUUID(), purpose: 'bot', status: 'waiting',
        attemptCount: 0, model: 'gemini-3.8-flash' } } });
    vi.spyOn(api, 'loadGame').mockResolvedValue(active);
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Fold' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call 5' })).toBeDisabled();
  });

  it('polls with GET only and stops after a terminal snapshot', async () => {
    const base = GameViewSchema.parse(publicView());
    const interactionId = crypto.randomUUID();
    const active = GameViewSchema.parse({ ...base, ai: { ...base.ai, mode: 'on', availability: 'configured',
      active: { interactionId, purpose: 'bot', status: 'waiting', attemptCount: 0,
        model: 'gemini-3.8-flash' } } });
    const terminal = GameViewSchema.parse({ ...base, version: 1, ai: { ...base.ai, mode: 'on',
      availability: 'configured', active: null, lastBotOutcome: { handId: base.handId, actorId: 'p1',
        decisionOrdinal: 1, outcome: 'model', attemptCount: 1, finalModel: 'gemini-3.8-flash' } } });
    const load = vi.spyOn(api, 'loadGame').mockResolvedValueOnce(active).mockResolvedValue(terminal);
    const mutations = [vi.spyOn(api, 'createGame'), vi.spyOn(api, 'sendAction'),
      vi.spyOn(api, 'nextHand'), vi.spyOn(api, 'requestAnalysis')];
    render(<App />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2), { timeout: 1800 });
    await new Promise(resolve => setTimeout(resolve, 850));
    expect(load).toHaveBeenCalledTimes(2);
    for (const mutation of mutations) expect(mutation).not.toHaveBeenCalled();
  });

  it('clears polling on unmount', async () => {
    const base = GameViewSchema.parse(publicView());
    const active = GameViewSchema.parse({ ...base, ai: { ...base.ai, mode: 'on', availability: 'configured',
      active: { interactionId: crypto.randomUUID(), purpose: 'bot', status: 'waiting',
        attemptCount: 0, model: 'gemini-3.8-flash' } } });
    const load = vi.spyOn(api, 'loadGame').mockResolvedValue(active);
    const rendered = render(<App />);
    await screen.findByText(/AI razmi/i);
    rendered.unmount();
    await new Promise(resolve => setTimeout(resolve, 850));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
