import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('opt-in live runner with offline HTTP', () => {
  it.each([200, 503])('reports actual application outcomes with HTTP %i', status => {
    const stub = `globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      const context = JSON.parse(body.contents[0].parts[0].text);
      const bot = typeof context.actorId === 'string';
      const proposal = bot ? { gameId: context.gameId, handId: context.handId,
        expectedVersion: context.expectedVersion, actorId: context.actorId, type: 'fold' }
        : { summary: 'Offline analysis.', goodDecisions: [], possibleMistakes: [], nextSteps: ['Review position.'] };
      const result = ${status} === 200 ? { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(bot ? { ...proposal, amountTo: null } : proposal) }] }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 10 } }
        : { error: { status: 'UNAVAILABLE', message: 'Model is currently experiencing high demand.' } };
      return new Response(JSON.stringify(result), { status: ${status}, headers: { 'content-type': 'application/json' } });
    };`;
    const result = spawnSync(process.execPath, ['--require', './tests/helpers/process-user-shim.cjs',
      '--import', 'tsx', '--import', `data:text/javascript,${encodeURIComponent(stub)}`,
      'scripts/gemini-live-smoke.ts', '--live'], { encoding: 'utf8', timeout: 10000,
    env: { ...process.env, GEMINI_API_KEY: 'offline-only', GEMINI_ENABLED: 'true',
      GEMINI_PRIMARY_MODEL: 'gemini-3.5-flash-lite', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      GEMINI_MAX_ATTEMPTS: '1', GEMINI_BOT_TIMEOUT_MS: '30000', GEMINI_BOT_TOTAL_MS: '35000' } });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status, result.stdout).toBe(status === 200 ? 0 : 1);
    const rows = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line)).filter(row => row.event === 'live-smoke');
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ purpose: 'bot', passed: status === 200, providerCalls: 1,
        terminalStatus: status === 200 ? 'model' : 'local_fallback' }),
      expect.objectContaining({ purpose: 'analysis', passed: status === 200, providerCalls: 1,
        terminalStatus: status === 200 ? 'completed' : 'failed' }),
    ]));
    expect(result.stdout).not.toContain('offline-only');
  });
});
