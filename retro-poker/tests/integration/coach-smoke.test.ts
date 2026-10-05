import { describe, expect, it, vi } from 'vitest';
import { runCoachSmoke } from '../../scripts/coach-smoke.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { ProviderError, type AiProvider, type AgentProvider } from '../../backend/src/ai/types.js';
import { FakeAiProvider, type FakeAiStep } from '../helpers/fake-ai-provider.js';

const configured = () => loadAiConfig({ GEMINI_API_KEY: 'SMOKE_SECRET_KEY', GEMINI_MAX_ATTEMPTS: '2' });
function fakeRun(steps: FakeAiStep[]) {
  const provider = new FakeAiProvider(steps);
  return { provider, work: () => runCoachSmoke(['--live'], () => ({ aiConfig: configured(), aiProvider: provider })) };
}

describe('T030 bounded Week05 smoke through HTTP/session/orchestrator', () => {
  it('without the exact --live flag does not load configuration or create a provider', async () => {
    const factory = vi.fn(() => { throw new Error('must not load secrets'); });
    for (const args of [[], ['--live=false'], ['--offline']]) {
      const result = await runCoachSmoke(args, factory);
      expect(result.exitCode).toBe(0);
      expect(result.report).toMatchObject({ executed: false, reason: 'opt_in_required', providerCallCount: 0, toolCallCount: 0 });
    }
    expect(factory).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'missing_key', 'missing_agent'] as const)('rejects %s configuration before any call', async kind => {
    const provider = new FakeAiProvider();
    const dependencies = () => ({ aiConfig: kind === 'missing_key' ? loadAiConfig({})
      : kind === 'disabled' ? loadAiConfig({ GEMINI_API_KEY: 'SMOKE_SECRET_KEY', GEMINI_ENABLED: 'false' }) : configured(),
    aiProvider: kind === 'missing_agent' ? { generate: provider.generate.bind(provider) } : provider });
    const result = await runCoachSmoke(['--live'], dependencies);
    expect(result.exitCode).toBe(2);
    expect(result.report).toMatchObject({ executed: false, reason: 'configuration_unavailable', providerCallCount: 0, toolCallCount: 0 });
    expect(provider.calls).toHaveLength(0); expect(provider.agentCalls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain('SMOKE_SECRET_KEY');
  });

  it('completes exactly one run with two distinct model steps, the actual tool and validated final', async () => {
    const { provider, work } = fakeRun([{ kind: 'agent_tool' }, { kind: 'agent_final' }]);
    const result = await work();
    expect(result.exitCode).toBe(0);
    expect(result.report).toMatchObject({ executed: true, passed: true, status: 'completed', stopReason: 'completed',
      stepCount: 2, providerCallCount: 2, toolCallCount: 1, finalValidated: true, readOnlySnapshotPreserved: true,
      maxRuns: 1, maxProviderCalls: 2, usage: { runCount: 1, stepCount: 2, providerAttemptCount: 2,
        toolExecutionCount: 1, validationCount: 5, retryCount: 0, modelFallbackCount: 0 } });
    expect(result.report.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(provider.calls).toHaveLength(0);
    expect(provider.agentCalls.map(call => [call.stepOrdinal, call.attemptOrdinal, call.runAttemptOrdinal]))
      .toEqual([[1, 1, 1], [2, 1, 2]]);
    const [first, second] = provider.agentCalls;
    expect(first!.request.context.toolResult).toBeUndefined();
    expect(second!.request.context.toolResult?.decisions).toHaveLength(1);
    expect(second!.deadlineAt).toBe(first!.deadlineAt);
    expect(second!.model).toBe(first!.model);
    const output = JSON.stringify(result);
    for (const marker of ['SMOKE_SECRET_KEY', 'Pregled dostupnih odluka.', 'Proveri legalne opcije',
      'holeCards', 'finding', 'systemInstruction', 'responseSchema', '"candidate":', 'rawResponse']) {
      expect(output).not.toContain(marker);
    }
  });

  it.each(['unknown_tool', 'invalid_arguments'] as const)('reports %s rejection with zero executor calls', async kind => {
    const { provider, work } = fakeRun([{ kind }]);
    const result = await work();
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({ executed: true, passed: false, status: 'stopped',
      stopReason: kind === 'unknown_tool' ? 'unknown_tool' : 'invalid_tool_arguments',
      providerCallCount: 1, toolCallCount: 0, finalValidated: false, readOnlySnapshotPreserved: true,
      usage: { runCount: 1, toolRejectionCount: 1, toolExecutionCount: 0 } });
    expect(provider.agentCalls).toHaveLength(1);
  });

  it.each(['timeout_error', '429', '5xx', 'auth_config'] as const)('stops %s after one attempt with no retry or fallback', async kind => {
    const { provider, work } = fakeRun([{ kind }, { kind: 'agent_tool' }, { kind: 'agent_final' }]);
    const result = await work();
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({ status: 'failed', stopReason: 'provider_failed', providerCallCount: 1,
      toolCallCount: 0, finalValidated: false, usage: { retryCount: 0, modelFallbackCount: 0 } });
    expect(provider.agentCalls).toHaveLength(1);
  });

  it('a step-two failure keeps the executed tool count and does not restart the workflow', async () => {
    const { provider, work } = fakeRun([{ kind: 'agent_tool' }, { kind: '5xx' }, { kind: 'agent_final' }]);
    const result = await work();
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({ stepCount: 2, providerCallCount: 2, toolCallCount: 1,
      status: 'failed', finalValidated: false, readOnlySnapshotPreserved: true });
    expect(provider.agentCalls).toHaveLength(2);
  });

  it('rejects invented evidence as a failed smoke, even after two successful provider responses', async () => {
    const { work } = fakeRun([{ kind: 'agent_tool' }, { kind: 'invalid_final' }]);
    const result = await work();
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({ status: 'failed', stopReason: 'malformed_output',
      failureCategory: 'evidence_rejected', providerCallCount: 2, toolCallCount: 1, finalValidated: false });
  });

  it('reports insufficient evidence after the tool as an incomplete live outcome, without another call', async () => {
    // One scripted way to reach the observed live category; not a claim about raw live output.
    const { provider, work } = fakeRun([{ kind: 'agent_tool' }, { kind: 'agent_refusal' }, { kind: 'agent_final' }]);
    const result = await work();
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({ executed: true, passed: false, status: 'stopped',
      stopReason: 'insufficient_evidence', stepCount: 2, providerCallCount: 2, toolCallCount: 1,
      finalValidated: false, evidenceCount: 0, readOnlySnapshotPreserved: true,
      usage: { runCount: 1, retryCount: 0, modelFallbackCount: 0 } });
    expect(provider.agentCalls).toHaveLength(2);
  });

  it('never prints exception text or provider content, including configuration factory failures', async () => {
    const factoryResult = await runCoachSmoke(['--live'], () => { throw new Error('SECRET_EXCEPTION'); });
    expect(factoryResult.exitCode).toBe(2); expect(JSON.stringify(factoryResult)).not.toContain('SECRET_EXCEPTION');
    const provider: AiProvider & AgentProvider = {
      generate: async () => { throw new Error('SECRET_BOT'); },
      generateAgent: async () => { throw new ProviderError('auth_config_error', 'SECRET_PROVIDER_RESPONSE'); },
    };
    const result = await runCoachSmoke(['--live'], () => ({ aiConfig: configured(), aiProvider: provider }));
    expect(result.exitCode).toBe(1);
    for (const secret of ['SMOKE_SECRET_KEY', 'SECRET_BOT', 'SECRET_PROVIDER_RESPONSE']) expect(JSON.stringify(result)).not.toContain(secret);
  });
});
