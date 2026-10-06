import { describe, expect, it, vi } from 'vitest';
import { runCoachLiveEval } from '../../scripts/coach-live-eval.js';
describe('T035 live eval CLI preflight', () => {
  it('requires exact opt-in and rejects invalid flags before ledger or provider construction', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await runCoachLiveEval([])).toBe(0);
      expect(await runCoachLiveEval(['--live=false'])).toBe(0);
      for (const flags of [['--runs=51'], ['--runs=0'], ['--runs=1.5'], ['--runs=2', '--runs=3'],
        ['--label=bad/label'], ['--unknown'], ['--label=a', '--label=b']]) {
        expect(await runCoachLiveEval(['--live', ...flags])).toBe(2);
      }
    } finally { output.mockRestore(); }
  });
});
