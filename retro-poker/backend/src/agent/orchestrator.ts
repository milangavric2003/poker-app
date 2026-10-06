import { CoachGoalSchema, CoachModelStepSchema, CoachOutputIssueSchema, CoachRequestSchema,
  jsonUtf8Bytes, DecisionEvidenceArgumentsSchema } from '../../../shared/contracts.js';
import { ProviderError, type AgentStepContext, type AgentStepResult, type ProviderUsage } from '../ai/types.js';
import { getDecisionEvidence } from './tools.js';
import { validateDecisionEvidence, validateFinalOutput } from './validation.js';
import { CORE_AGENT_LIMITS, agentResponseJsonSchema, type AgentLimits, type AgentRunOptions,
  type AgentRunState, type FailureCategory, type StopReason } from './types.js';

const categories: Record<string, FailureCategory> = { timeout: 'provider_timeout', rate_limited: 'rate_limit',
  server_error: 'provider_unavailable', network_error: 'provider_transport', safety_refusal: 'provider_refusal',
  auth_config_error: 'authentication_configuration', config_error: 'authentication_configuration',
  invalid_request: 'authentication_configuration', malformed: 'invalid_structured_response' };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function safeUsage(usage: Partial<ProviderUsage> | undefined): Partial<ProviderUsage> | undefined {
  if (!usage) return undefined;
  const result: Partial<ProviderUsage> = {};
  for (const key of ['promptTokens', 'candidateTokens', 'thoughtTokens', 'cachedTokens', 'totalTokens'] as const) {
    const value = usage[key]; result[key] = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  return result;
}

/** Transport-free run. A session must still own start/commit and supply isCurrent/signal. */
export class BoundedAgentRun {
  private readonly options: AgentRunOptions;
  private readonly limits: AgentLimits;
  private readonly controller = new AbortController();
  private readonly current: AgentRunState;
  private work: Promise<AgentRunState> | undefined;
  private activeAttempt: { record: AgentRunState['attempts'][number]; started: number } | undefined;
  private invalidLimits = false;
  constructor(options: AgentRunOptions) {
    this.options = { ...options, goal: freeze(structuredClone(options.goal)), snapshot: freeze(structuredClone(options.snapshot)) };
    this.limits = { ...CORE_AGENT_LIMITS, ...options.limits };
    for (const key of Object.keys(CORE_AGENT_LIMITS) as Array<keyof AgentLimits>) {
      const value = this.limits[key];
      if (!Number.isSafeInteger(value) || value < (key.startsWith('max') ? 0 : 1)
        || value > CORE_AGENT_LIMITS[key]) this.invalidLimits = true;
    }
    const start = options.clock.now();
    this.current = { runId: options.runId, gameId: options.snapshot.gameId, handId: options.snapshot.handId,
      expectedVersion: options.snapshot.expectedVersion, factsRevision: options.snapshot.factsRevision,
      goal: structuredClone(options.goal), status: 'created', startedAt: start, deadlineAt: start + this.limits.totalDeadlineMs,
      stepCount: 0, providerAttemptCount: 0, toolCallCount: 0, recentActionKeys: [], validatedToolResult: null,
      stopReason: null, failureCategory: null, result: null, sampleLimited: options.snapshot.facts.aggregates.length > 0,
      terminalTransitionCount: 0, attempts: [], toolAttemptCount: 0, toolRejectionCount: 0,
      validationCount: 0, validationRejectedCount: 0, finishedAt: null };
  }
  get state(): AgentRunState { return structuredClone(this.current); }
  private get terminal(): boolean { return ['completed', 'stopped', 'failed'].includes(this.current.status); }
  private finish(reason: StopReason, category: FailureCategory | null = null): void {
    if (this.terminal) return;
    if (this.activeAttempt) {
      const { record, started } = this.activeAttempt;
      record.durationMs = Math.max(0, this.options.clock.now() - started);
      record.outcome = reason === 'cancelled' ? 'cancelled' : reason === 'stale_state' ? 'stale' : 'timeout';
      this.activeAttempt = undefined;
    }
    this.current.status = reason === 'completed' ? 'completed'
      : ['provider_failed', 'tool_failed', 'malformed_output'].includes(reason) ? 'failed' : 'stopped';
    this.current.stopReason = reason; this.current.failureCategory = category;
    this.current.finishedAt = this.options.clock.now();
    if (reason !== 'completed') this.current.result = null;
    this.current.terminalTransitionCount++;
    this.controller.abort();
    // Observers cannot undo a terminal transition or leak their exception.
    try { this.options.onTerminal?.(this.state); } catch { /* terminal state remains committed */ }
  }
  cancel(): void { if (!this.terminal) { this.controller.abort(); this.finish('cancelled'); } }
  /** Trusted session preflight, before dispatch; no external calls. */
  stopIfNoEvidence(): void {
    if (!this.context().availableDecisionCount) this.finish('insufficient_evidence');
  }
  private checkpoint(): boolean {
    if (this.terminal) return false;
    if (this.controller.signal.aborted || this.options.signal?.aborted) { this.finish('cancelled'); return false; }
    const identity = { runId: this.current.runId, gameId: this.current.gameId, handId: this.current.handId,
      expectedVersion: this.current.expectedVersion, factsRevision: this.current.factsRevision };
    if (this.options.isCurrent && !this.options.isCurrent(Object.freeze(identity))) { this.finish('stale_state'); return false; }
    if (this.options.clock.now() >= this.current.deadlineAt) { this.finish('deadline'); return false; }
    return true;
  }
  /** Race cancellation separately: a provider is permitted to ignore AbortSignal. */
  private async bounded<T>(operation: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
    const child = new AbortController(); const timer = new AbortController();
    let rejectAbort: (error: unknown) => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
    const abort = () => { child.abort(); rejectAbort(new DOMException('Aborted', 'AbortError')); };
    this.controller.signal.addEventListener('abort', abort, { once: true });
    const timeout = this.options.clock.sleep(ms, timer.signal).then(() => {
      child.abort(); throw new ProviderError('timeout');
    });
    try {
      if (this.controller.signal.aborted) abort();
      return await Promise.race([Promise.resolve().then(() => {
        if (child.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        return operation(child.signal);
      }), timeout, aborted]);
    } finally {
      timer.abort(); child.abort(); this.controller.signal.removeEventListener('abort', abort);
    }
  }
  private context(): AgentStepContext {
    const { snapshot, goal } = this.options;
    const availableDecisionCount = snapshot.facts.decisions.filter(d => goal.focus === 'street'
      || (goal.focus === 'betting' && ['call', 'bet', 'raise', 'all_in'].includes(d.chosenAction.type))
      || (goal.focus === 'showdown' && d.outcome?.reason === 'showdown')).length;
    return { goal, availableDecisionCount, sampleLimited: snapshot.facts.aggregates.length > 0,
      ...(this.current.validatedToolResult ? { toolResult: structuredClone(this.current.validatedToolResult) } : {}) };
  }
  private async modelStep(): Promise<unknown> {
    if (!this.checkpoint()) return undefined;
    if (this.current.stepCount >= this.limits.maxSteps) { this.finish('step_limit'); return undefined; }
    if (this.current.providerAttemptCount >= this.limits.maxProviderAttempts) { this.finish('call_budget'); return undefined; }
    const context = this.context();
    if (jsonUtf8Bytes(context) > 32768) { this.finish('invalid_input'); return undefined; }
    const stepOrdinal = (this.current.stepCount + 1) as 1 | 2;
    let model = this.options.model;
    let relation: 'initial' | 'same_model_retry' | 'model_fallback' = 'initial';
    for (let ordinal = 1; ordinal <= this.limits.maxAttemptsPerStep; ordinal++) {
      if (!this.checkpoint()) return undefined;
      if (this.current.providerAttemptCount >= this.limits.maxProviderAttempts) { this.finish('call_budget'); return undefined; }
      const started = this.options.clock.now();
      const remainingMs = this.current.deadlineAt - started;
      const attempt = { stepOrdinal, attemptOrdinal: ordinal as 1 | 2, runAttemptOrdinal: this.current.providerAttemptCount + 1,
        model, relation, outcome: 'success' as import('../ai/types.js').AttemptOutcome, durationMs: 0 };
      let result: AgentStepResult | undefined; let failure: ProviderError | undefined;
      try {
        result = await this.bounded(signal => {
          if (!this.checkpoint()) throw new DOMException('Aborted', 'AbortError');
          this.current.stepCount = stepOrdinal;
          this.current.providerAttemptCount++;
          this.current.attempts.push(attempt);
          this.activeAttempt = { record: attempt, started };
          return this.options.provider.generateAgent({ purpose: 'coach', runId: this.current.runId,
            stepOrdinal, attemptOrdinal: ordinal as 1 | 2,
            runAttemptOrdinal: this.current.providerAttemptCount as 1 | 2 | 3 | 4, model,
            context: structuredClone(context), responseSchema: agentResponseJsonSchema,
            deadlineAt: this.current.deadlineAt, remainingMs: this.current.deadlineAt - this.options.clock.now() }, signal);
        }, Math.min(this.limits.providerAttemptTimeoutMs, remainingMs));
      } catch (error) {
        failure = error instanceof ProviderError ? error : new ProviderError('network_error');
      }
      if (this.terminal) return undefined;
      if (failure) attempt.outcome = failure.kind === 'config_error' ? 'auth_config_error' : failure.kind;
      attempt.durationMs = Math.max(0, this.options.clock.now() - started);
      const usage = safeUsage(result?.usage);
      if (usage) Object.assign(attempt, { usage });
      this.activeAttempt = undefined;
      if (!this.checkpoint()) return undefined;
      if (!failure) {
        this.current.validationCount++;
        try {
          const candidate = result!.candidate;
          if ((typeof candidate === 'string' ? new TextEncoder().encode(candidate).byteLength : jsonUtf8Bytes(candidate)) > 32768) throw new Error();
          const parsed = CoachModelStepSchema.safeParse(typeof candidate === 'string' ? JSON.parse(candidate) : candidate);
          if (!parsed.success) throw new Error();
          return parsed.data;
        } catch { this.current.validationRejectedCount++; this.finish('malformed_output', 'invalid_structured_response'); return undefined; }
      }
      if (failure.kind === 'malformed') {
        const issue = CoachOutputIssueSchema.safeParse(failure.outputIssue);
        if (issue.success) this.current.outputIssue = issue.data;
        this.finish('malformed_output', 'invalid_structured_response'); return undefined;
      }
      const transient = ['timeout', 'rate_limited', 'server_error', 'network_error'].includes(failure.kind);
      if (!transient || ordinal >= this.limits.maxAttemptsPerStep) {
        this.finish('provider_failed', categories[failure.kind] ?? 'provider_transport'); return undefined;
      }
      if (this.current.providerAttemptCount >= this.limits.maxProviderAttempts) { this.finish('call_budget'); return undefined; }
      const minimum = this.options.backoffMinMs ?? 500; const maximum = this.options.backoffMaxMs ?? 1000;
      const delay = Math.max(Math.min(maximum, Math.max(minimum, 500) + (this.options.jitter?.next(250) ?? 0)), failure.retryAfterMs ?? 0);
      const remaining = this.current.deadlineAt - this.options.clock.now();
      try { await this.options.clock.sleep(Math.min(delay, remaining), this.controller.signal); } catch { /* checkpoint */ }
      if (!this.checkpoint()) return undefined;
      if (failure.kind === 'server_error' && this.options.fallbackModel) { model = this.options.fallbackModel; relation = 'model_fallback'; }
      else relation = 'same_model_retry';
    }
    this.finish('provider_failed', 'provider_transport'); return undefined;
  }
  private async consume(candidate: unknown, stage: 1 | 2): Promise<boolean> {
    if (!this.checkpoint()) return false;
    const parsed = CoachModelStepSchema.safeParse(candidate);
    if (!parsed.success) { this.finish('malformed_output', 'invalid_structured_response'); return false; }
    const proposal = parsed.data;
    if (proposal.kind === 'refusal') {
      this.finish(proposal.reason === 'insufficient_context' ? 'insufficient_evidence' : 'invalid_model_proposal'); return false;
    }
    if (proposal.kind === 'tool_request') {
      this.current.toolAttemptCount++;
      if (proposal.name !== 'get_decision_evidence') { this.current.toolRejectionCount++; this.finish('unknown_tool'); return false; }
      const args = DecisionEvidenceArgumentsSchema.safeParse(proposal.arguments);
      this.current.validationCount++;
      if (!args.success || args.data.focus !== this.options.goal.focus) {
        this.current.validationRejectedCount++; this.current.toolRejectionCount++; this.finish('invalid_tool_arguments'); return false;
      }
      const key = JSON.stringify([proposal.name, { focus: args.data.focus, limit: args.data.limit }, this.current.factsRevision]);
      if (this.current.recentActionKeys.includes(key)) { this.current.toolRejectionCount++; this.finish('repeated_action'); return false; }
      if (this.current.toolCallCount >= this.limits.maxToolCalls) { this.current.toolRejectionCount++; this.finish('tool_call_limit'); return false; }
      if (stage !== 1) { this.current.toolRejectionCount++; this.finish('invalid_model_proposal'); return false; }
      const toolMs = Math.min(this.limits.toolTimeoutMs, this.current.deadlineAt - this.options.clock.now());
      const toolDeadlineAt = this.options.clock.now() + toolMs;
      try {
        const output = await this.bounded(async signal => {
          if (!this.checkpoint()) throw new DOMException('Aborted', 'AbortError');
          this.current.recentActionKeys.push(key); this.current.toolCallCount++;
          return (this.options.executeTool ?? getDecisionEvidence)(this.options.snapshot,
            structuredClone(args.data), { signal, now: () => this.options.clock.now(), deadlineAt: toolDeadlineAt });
        }, toolMs);
        if (!this.checkpoint()) return false;
        const validation = validateDecisionEvidence(output, this.options.snapshot, args.data);
        this.current.validationCount++;
        if (validation.status === 'rejected') { this.current.validationRejectedCount++; this.finish('tool_failed', 'tool_validation'); return false; }
        this.current.validatedToolResult = structuredClone(validation.result);
        this.current.sampleLimited = validation.result.sampleLimited;
        if (validation.status === 'insufficient_evidence') { this.finish('insufficient_evidence'); return false; }
        return true;
      } catch (error) {
        if (this.checkpoint()) this.finish('tool_failed', error instanceof ProviderError && error.kind === 'timeout'
          || (error && typeof error === 'object' && 'category' in error && error.category === 'tool_timeout') ? 'tool_timeout' : 'tool_error');
        return false;
      }
    }
    if (stage !== 2 || !this.current.validatedToolResult) { this.finish('invalid_model_proposal'); return false; }
    const validated = validateFinalOutput(proposal, this.current.validatedToolResult);
    this.current.validationCount++;
    if (validated.status === 'rejected') { this.current.validationRejectedCount++; this.finish('malformed_output', 'evidence_rejected'); return false; }
    if (validated.status === 'insufficient_evidence') { this.finish('insufficient_evidence'); return false; }
    if (this.checkpoint()) { this.current.result = validated.result; this.finish('completed'); }
    return false;
  }
  execute(): Promise<AgentRunState> {
    if (this.work) return this.work.then(() => this.state);
    if (this.terminal) return Promise.resolve(this.state);
    // Defer entry so reentrant or concurrent starts see the same promise.
    this.work = Promise.resolve().then(async () => {
      const abort = () => this.cancel();
      this.options.signal?.addEventListener('abort', abort, { once: true });
      try {
        if (!this.checkpoint()) return this.state;
        const { snapshot, goal } = this.options;
        if (this.invalidLimits || !CoachGoalSchema.safeParse(goal).success
          || !CoachRequestSchema.safeParse({ gameId: snapshot.gameId, handId: snapshot.handId,
            expectedVersion: snapshot.expectedVersion, goal }).success
          || !CoachRequestSchema.shape.gameId.safeParse(this.current.runId).success
          || !Number.isSafeInteger(snapshot.factsRevision) || snapshot.factsRevision < 0
          || !['won', 'lost'].includes(snapshot.status) || snapshot.factsRevision !== snapshot.facts.revision
          || snapshot.gameId !== snapshot.facts.gameId || snapshot.facts.decisions.length > 200) {
          this.finish('invalid_input'); return this.state;
        }
        this.current.status = 'running';
        if (!this.context().availableDecisionCount) { this.finish('insufficient_evidence'); return this.state; }
        const first = await this.modelStep();
        if (!this.terminal && await this.consume(first, 1)) {
          const second = await this.modelStep();
          if (!this.terminal) await this.consume(second, 2);
        }
      } catch { if (this.checkpoint()) this.finish('invalid_input'); }
      finally { this.options.signal?.removeEventListener('abort', abort); }
      return this.state;
    });
    return this.work.then(() => this.state);
  }
}
