import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AiStatus, type AiUiStatus } from '../../frontend/src/components/AiStatus';
import { acceptsAiSnapshot } from '../../frontend/src/App';
import { GameViewSchema } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';

afterEach(cleanup);
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
});
