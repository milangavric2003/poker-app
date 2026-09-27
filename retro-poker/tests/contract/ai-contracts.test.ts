import { describe, expect, it } from 'vitest';
import { GameConfigSchema, GameErrorSchema, GameViewSchema } from '../../shared/contracts.js';
import { publicView } from '../helpers/public-fixtures.js';

const idleAi = {
  mode: 'off', availability: 'unavailable', active: null, lastBotOutcome: null,
  analysis: { status: 'idle', interactionId: null, result: null },
};

describe('Week04 provider-neutral public contracts (FR-001, FR-015–FR-023)', () => {
  it('defaults omitted aiMode to false while preserving the Week03 request', () => {
    expect(GameConfigSchema.parse({ botCount: 3 })).toEqual({ botCount: 3, aiMode: false });
  });

  it.each([true, false])('accepts boolean aiMode=%s without coercion', aiMode => {
    expect(GameConfigSchema.parse({ botCount: 1, aiMode })).toEqual({ botCount: 1, aiMode });
  });

  it.each(['true', 1, null])('rejects non-boolean aiMode %j', aiMode => {
    expect(GameConfigSchema.safeParse({ botCount: 1, aiMode }).success).toBe(false);
  });

  it('keeps GameConfig strict after adding aiMode', () => {
    expect(GameConfigSchema.safeParse({ botCount: 1, aiMode: false, apiKey: 'must-not-cross-browser-boundary' }).success)
      .toBe(false);
  });

  it('requires and runtime-validates the additive public AI snapshot', () => {
    const value = { ...publicView(), ai: idleAi };
    expect(GameViewSchema.parse(value)).toEqual(value);
    expect(GameViewSchema.safeParse(publicView()).success).toBe(false);
    expect(GameViewSchema.safeParse({ ...value, ai: { ...idleAi, rawResponse: '{}' } }).success).toBe(false);
  });

  it.each(['AI_UNAVAILABLE', 'AI_ALREADY_PENDING', 'ANALYSIS_NOT_ALLOWED'])(
    'accepts the safe Week04 error code %s and still rejects internal details', code => {
    const value = { error: { code, message: 'AI zahtev nije dostupan.' } };
    expect(GameErrorSchema.parse(value)).toEqual(value);
    expect(GameErrorSchema.safeParse({ error: { ...value.error, apiKey: 'secret' } }).success).toBe(false);
    });
});
