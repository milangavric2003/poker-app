import { ProviderError, type AiProvider, type ProviderRequest, type ProviderResult } from '../../backend/src/ai/types.js';

export type FakeAiStep = ProviderResult | { kind: 'analysis_success' } | { kind: 'malformed' | 'schema_mismatch' | 'semantic_illegal'
  | 'timeout' | '429' | '5xx' | 'safety_refusal' | 'auth_config' | 'network' }
  | { kind: 'pending'; id?: string };
interface Pending { resolve: (result: ProviderResult) => void; reject: (error: unknown) => void; signal: AbortSignal; }

export class FakeAiProvider implements AiProvider {
  readonly calls: Array<{ request: ProviderRequest; signal: AbortSignal; attemptOrdinal: number;
    model: string; context: unknown }> = [];
  readonly pending = new Map<string, Pending>();
  constructor(private readonly steps: FakeAiStep[] = []) {}
  enqueue(...steps: FakeAiStep[]): void { this.steps.push(...steps); }
  get callCount(): number { return this.calls.length; }
  async generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult> {
    this.calls.push({ request: structuredClone(request), signal, attemptOrdinal: request.attemptOrdinal,
      model: request.model, context: structuredClone(request.context) });
    const step = this.steps.shift() ?? { kind: 'schema_mismatch' as const };
    if (!('kind' in step)) return structuredClone(step);
    if (step.kind === 'pending' || step.kind === 'timeout') {
      const id = step.kind === 'pending' ? step.id ?? `pending-${this.calls.length}` : `timeout-${this.calls.length}`;
      return await new Promise<ProviderResult>((resolve, reject) => { this.pending.set(id, { resolve, reject, signal }); });
    }
    if (step.kind === 'malformed') return { candidate: '{not-json' };
    if (step.kind === 'schema_mismatch') return { candidate: { answer: 'check' } };
    if (step.kind === 'analysis_success') {
      return { candidate: { summary: 'Analiza fake uspesno zavrsena.', goodDecisions: [],
        possibleMistakes: [], nextSteps: ['Nastavi da proveravas velicinu pota.'] } };
    }
    if (step.kind === 'semantic_illegal') return { candidate: { gameId: '00000000-0000-4000-8000-000000000000',
      handId: '00000000-0000-4000-8000-000000000000', expectedVersion: 0, actorId: 'wrong', type: 'check' } };
    if (step.kind === '429') throw new ProviderError('rate_limited');
    if (step.kind === '5xx') throw new ProviderError('server_error');
    if (step.kind === 'safety_refusal') throw new ProviderError('safety_refusal');
    if (step.kind === 'auth_config') throw new ProviderError('auth_config_error');
    throw new ProviderError('network_error');
  }
  resolve(id: string, result: ProviderResult): void { this.pending.get(id)?.resolve(result); }
  reject(id: string, error: unknown): void { this.pending.get(id)?.reject(error); }
}

export function legalBotProposal(context: { gameId: string; handId: string; expectedVersion: number;
  actorId: string; legalActions: ReadonlyArray<{ type: string; minAmountTo?: number }> }): ProviderResult {
  const legal = context.legalActions.find(action => action.type === 'check') ?? context.legalActions[0]!;
  return { candidate: { gameId: context.gameId, handId: context.handId,
    expectedVersion: context.expectedVersion, actorId: context.actorId, type: legal.type,
    ...((legal.type === 'bet' || legal.type === 'raise') ? { amountTo: legal.minAmountTo } : {}) } };
}
