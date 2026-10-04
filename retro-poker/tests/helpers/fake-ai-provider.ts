import { ProviderError, type AiProvider, type AgentProvider, type AgentStepRequest,
  type ProviderRequest, type ProviderResult } from '../../backend/src/ai/types.js';

export type FakeAiStep = ProviderResult | { kind: 'analysis_success' } | { kind: 'malformed' | 'schema_mismatch' | 'semantic_illegal'
  | 'timeout' | 'timeout_error' | '429' | '5xx' | 'safety_refusal' | 'auth_config' | 'network'
  | 'agent_tool' | 'agent_refusal' | 'agent_final' | 'unknown_tool' | 'invalid_arguments' | 'invalid_final' }
  | { kind: 'pending'; id?: string };
interface Pending { resolve: (result: ProviderResult) => void; reject: (error: unknown) => void; signal: AbortSignal; }

export class FakeAiProvider implements AiProvider, AgentProvider {
  readonly agentCalls: Array<{ request: AgentStepRequest; signal: AbortSignal; model: string;
    stepOrdinal: number; attemptOrdinal: number; runAttemptOrdinal: number; context: unknown; deadlineAt: number }> = [];
  readonly calls: Array<{ request: ProviderRequest; signal: AbortSignal; attemptOrdinal: number;
    model: string; context: unknown }> = [];
  readonly pending = new Map<string, Pending>();
  constructor(private readonly steps: FakeAiStep[] = []) {}
  enqueue(...steps: FakeAiStep[]): void { this.steps.push(...steps); }
  get callCount(): number { return this.calls.length; }
  async generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> {
    this.calls.push({ request: structuredClone(request), signal, attemptOrdinal: request.attemptOrdinal,
      model: request.model, context: structuredClone(request.context) });
    return this.respond(signal, request.context);
  }
  async generateAgent(request: AgentStepRequest, signal: AbortSignal): Promise<ProviderResult> {
    this.agentCalls.push({ request: structuredClone(request), signal, model: request.model,
      stepOrdinal: request.stepOrdinal, attemptOrdinal: request.attemptOrdinal,
      runAttemptOrdinal: request.runAttemptOrdinal, context: structuredClone(request.context), deadlineAt: request.deadlineAt });
    return this.respond(signal, request.context);
  }
  private async respond(signal: AbortSignal, context: unknown): Promise<ProviderResult> {
    const step = this.steps.shift() ?? { kind: 'schema_mismatch' as const };
    if (!('kind' in step)) return structuredClone(step);
    if (step.kind === 'pending' || step.kind === 'timeout') {
      const ordinal = this.calls.length + this.agentCalls.length;
      const id = step.kind === 'pending' ? step.id ?? `pending-${ordinal}` : `timeout-${ordinal}`;
      return await new Promise<ProviderResult>((resolve, reject) => { this.pending.set(id, { resolve, reject, signal }); });
    }
    if (step.kind === 'malformed') return { candidate: '{not-json' };
    if (step.kind === 'schema_mismatch') return { candidate: { answer: 'check' } };
    if (['agent_tool', 'unknown_tool', 'invalid_arguments'].includes(step.kind)) {
      const goal = (context as { goal?: { focus?: string } }).goal;
      return { candidate: { kind: 'tool_request', name: step.kind === 'unknown_tool' ? 'shell' : 'get_decision_evidence',
        arguments: { focus: goal?.focus ?? 'street', limit: step.kind === 'invalid_arguments' ? 0 : 10 } } };
    }
    if (step.kind === 'agent_refusal') return { candidate: { kind: 'refusal', reason: 'insufficient_context' } };
    if (step.kind === 'agent_final' || step.kind === 'invalid_final') {
      const result = (context as { toolResult?: { decisions: Array<{ decisionRef: string;
        facts: Array<{ factCode: string; finding: string }> }> } }).toolResult;
      const decision = result?.decisions[0]; const fact = decision?.facts[0];
      return { candidate: { kind: 'final', summary: 'Pregled dostupnih odluka.',
        recommendation: 'Proveri legalne opcije pre odluke.', confidence: 'low', completed: true,
        evidence: [{ decisionRef: step.kind === 'invalid_final' ? 'foreign:1' : decision?.decisionRef ?? 'fixture:1',
          factCode: fact?.factCode ?? 'action', finding: fact?.finding ?? '{"type":"call"}' }] } };
    }
    if (step.kind === 'analysis_success') {
      return { candidate: { summary: 'Analiza fake uspesno zavrsena.', goodDecisions: [],
        possibleMistakes: [], nextSteps: ['Nastavi da proveravas velicinu pota.'] } };
    }
    if (step.kind === 'semantic_illegal') return { candidate: { gameId: '00000000-0000-4000-8000-000000000000',
      handId: '00000000-0000-4000-8000-000000000000', expectedVersion: 0, actorId: 'wrong',
      decisionOrdinal: 1, type: 'check' } };
    if (step.kind === '429') throw new ProviderError('rate_limited');
    if (step.kind === 'timeout_error') throw new ProviderError('timeout');
    if (step.kind === '5xx') throw new ProviderError('server_error');
    if (step.kind === 'safety_refusal') throw new ProviderError('safety_refusal');
    if (step.kind === 'auth_config') throw new ProviderError('auth_config_error');
    throw new ProviderError('network_error');
  }
  resolve(id: string, result: ProviderResult): void { this.pending.get(id)?.resolve(result); }
  reject(id: string, error: unknown): void { this.pending.get(id)?.reject(error); }
}

export function legalBotProposal(context: { gameId: string; handId: string; expectedVersion: number;
  actorId: string; decisionOrdinal: number;
  legalActions: ReadonlyArray<{ type: string; minAmountTo?: number }> }): ProviderResult {
  const legal = context.legalActions.find(action => action.type === 'check') ?? context.legalActions[0]!;
  return { candidate: { gameId: context.gameId, handId: context.handId,
    expectedVersion: context.expectedVersion, actorId: context.actorId,
    decisionOrdinal: context.decisionOrdinal, type: legal.type,
    ...((legal.type === 'bet' || legal.type === 'raise') ? { amountTo: legal.minAmountTo } : {}) } };
}
