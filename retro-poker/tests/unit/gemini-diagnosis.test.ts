import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('diagnostic CLI failure exit codes (offline HTTP)', () => {
  it.each([503, 200])('fails on HTTP %i without valid generation content', status => {
    const directory = mkdtempSync(join(tmpdir(), 'gemini-diagnostic-'));
    const envFile = join(directory, 'fake.env');
    writeFileSync(envFile, 'GEMINI_API_KEY=offline-fake-only\nGEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite\n');
    const stub = `globalThis.fetch = async () => new Response(JSON.stringify(${JSON.stringify(status === 503
      ? { error: { status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand. fake-secret' } }
      : { candidates: [] })}), { status: ${status}, headers: { 'content-type': 'application/json' } });`;
    try {
      const result = spawnSync(process.execPath, ['--require', './tests/helpers/process-user-shim.cjs',
        '--import', 'tsx', '--import', `data:text/javascript,${encodeURIComponent(stub)}`,
        'scripts/gemini-diagnosis.ts'], { encoding: 'utf8', timeout: 15000,
      env: { ...process.env, RUN_GEMINI_DIAGNOSTIC: '1', GEMINI_DIAGNOSTIC_ENV_FILE: envFile,
        GEMINI_API_KEY: 'offline-fake-only', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite' } });
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('A-minimal-text');
      expect(result.stdout).not.toMatch(/fake-secret|offline-fake-only/);
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain('B-minimal-json-schema');
    } finally { unlinkSync(envFile); rmdirSync(directory); }
  });
});
