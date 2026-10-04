import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoachPanel, type CoachPanelProps } from '../../frontend/src/components/CoachPanel';
import { CoachRunViewSchema, GameViewSchema, HandResultSchema, type CoachRunView } from '../../shared/contracts';
import { handResult, publicView } from '../helpers/public-fixtures';

afterEach(() => cleanup());
const base = GameViewSchema.parse(publicView());
const game = { ...base, status: 'won' as const, phase: 'complete' as const, actorId: null,
  legalActions: [], result: HandResultSchema.parse({ ...handResult(), gameStatus: 'won' }),
  ai: { ...base.ai, availability: 'configured' as const } };
function run(overrides: Partial<CoachRunView> = {}) {
  return CoachRunViewSchema.parse({ gameId: game.gameId, handId: game.handId, expectedVersion: game.version,
    runId: '00000000-0000-4000-8000-000000000021', factsRevision: 1, goal: { focus: 'street' },
    status: 'running', startedAt: '2026-10-04T12:00:00Z', deadlineAt: '2026-10-04T12:00:45Z',
    stepCount: 0, toolCallCount: 0, providerAttemptCount: 0, stopReason: null,
    failureCategory: null, result: null, sampleLimited: false, ...overrides });
}
function completed() {
  return run({ status: 'completed', stopReason: 'completed', stepCount: 2, toolCallCount: 1,
    providerAttemptCount: 2, sampleLimited: true, result: { completed: true, confidence: 'low',
      summary: 'Pregled odluka.', recommendation: 'Vežbaj veličinu uloga.',
      evidence: [{ decisionRef: 'd1', factCode: 'action', finding: 'Igrač je call-ovao.' }] } });
}
function panel(props: Partial<CoachPanelProps> = {}) {
  const request = vi.fn();
  render(<CoachPanel game={game} run={null} pending={false} failure={false} onRequest={request} {...props} />);
  return request;
}
describe('T021 bounded coaching component', () => {
  it('offers bounded accessible goals and submits selected focus', () => {
    const request = panel();
    const goal = screen.getByRole('combobox', { name: 'Coaching cilj' });
    expect(within(goal).getAllByRole('option')).toHaveLength(3);
    fireEvent.change(goal, { target: { value: 'showdown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pokreni coaching' }));
    expect(request).toHaveBeenCalledWith({ focus: 'showdown' });
  });
  it.each(['playing', 'unavailable'] as const)('disables unavailable coaching: %s', state => {
    panel({ game: state === 'playing' ? base : { ...game, ai: { ...game.ai, availability: 'unavailable' } } });
    expect(screen.getByRole('button', { name: 'Pokreni coaching' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/završenu|dostupan/i);
  });
  it('announces running, selected goal and disables submit', () => {
    panel({ run: run() });
    expect(screen.getByRole('status')).toHaveTextContent('Coaching je u toku');
    expect(screen.getByText('Izabrani cilj: Odluke po fazama')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pokreni coaching' })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
  it('disables start while awaiting POST', () => {
    panel({ pending: true });
    expect(screen.getByRole('button', { name: 'Pokreni coaching' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/pokreće/i);
  });
  it('shows only validated completed summary, recommendation and bounded evidence', () => {
    const snapshot = structuredClone(game);
    panel({ run: completed() });
    expect(screen.getByRole('status')).toHaveTextContent('Coaching je završen');
    expect(screen.getByText('Pregled odluka.')).toBeVisible();
    expect(screen.getByText('Vežbaj veličinu uloga.')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('d1');
    expect(screen.getByRole('listitem')).toHaveTextContent('Igrač je call-ovao.');
    expect(screen.getByText(/ograničen uzorak/i)).toBeVisible();
    expect(game).toEqual(snapshot);
  });
  it.each(['insufficient_evidence', 'unknown_tool', 'deadline'] as const)('announces stopped %s and explicit retry', reason => {
    const request = panel({ run: run({ status: 'stopped', stopReason: reason }) });
    expect(screen.getByRole('alert')).toHaveTextContent(reason === 'insufficient_evidence' ? /dovoljno dokaza/i : /zaustavljen/i);
    expect(screen.getByRole('status')).toHaveTextContent(reason === 'insufficient_evidence' ? /dovoljno dokaza/i : /zaustavljen/i);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pokušaj coaching ponovo' }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Pregled odluka.')).not.toBeInTheDocument();
  });
  it('announces failed and exposes separate coaching retry', () => {
    panel({ run: run({ status: 'failed', stopReason: 'provider_failed', failureCategory: 'provider_timeout' }) });
    expect(screen.getByRole('alert')).toHaveTextContent(/nije uspeo/i);
    expect(screen.getByRole('button', { name: 'Pokušaj coaching ponovo' })).toBeEnabled();
  });
  it.each([
    { ...completed(), prompt: 'PRIVATE_PROVIDER' },
    { ...completed(), result: { ...completed().result, evidence: [] } },
    { ...completed(), gameId: '00000000-0000-4000-8000-000000000099' },
    { ...completed(), expectedVersion: game.version + 1 },
    { ...completed(), status: 'surprise' },
  ])('rejects invalid or foreign response without success or raw details', invalid => {
    panel({ run: invalid });
    expect(screen.getByRole('alert')).toHaveTextContent(/nije validiran/i);
    expect(screen.queryByText('Pregled odluka.')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('PRIVATE_PROVIDER');
  });
  it('network failure has safe alert and manual retry', () => {
    panel({ failure: true });
    expect(screen.getByRole('alert')).toHaveTextContent(/nije uspeo/i);
    expect(screen.getByRole('button', { name: 'Pokušaj coaching ponovo' })).toBeEnabled();
  });
});
