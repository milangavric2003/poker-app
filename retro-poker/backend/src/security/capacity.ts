import { ProviderError, type AiProvider, type AgentProvider } from '../ai/types.js';

/** A reservation counts immediately. Only the original operation settling releases running work. */
export class ProviderLease {
  private state: 'reserved' | 'running' | 'settled' = 'reserved';
  constructor(private readonly release: () => void) {}
  releaseUnused(): void {
    if (this.state === 'reserved') { this.state = 'settled'; this.release(); }
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state !== 'reserved') throw new Error('Provider lease already consumed');
    this.state = 'running';
    try { return await operation(); }
    finally { this.state = 'settled'; this.release(); }
  }
}
export class ProviderCapacity {
  private count = 0;
  get active(): number { return this.count; }
  reserve(): ProviderLease | null {
    if (this.count >= 2) return null;
    this.count++;
    return new ProviderLease(() => { this.count--; });
  }
  /** One owner for the initial reservation; subsequent attempts reserve only at dispatch. */
  bind(provider: AiProvider, initial: ProviderLease) {
    let unused: ProviderLease | undefined = initial;
    const invoke = <T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> => {
      if (signal.aborted) { unused?.releaseUnused(); unused = undefined;
        return Promise.reject(new DOMException('Aborted', 'AbortError')); }
      const lease = unused ?? this.reserve(); unused = undefined;
      // A full capacity is not a transport failure and must not create a retry queue.
      if (!lease) return Promise.reject(new ProviderError('invalid_request'));
      return lease.run(operation);
    };
    const wrapped: AiProvider & Partial<AgentProvider> = {
      generate: (request, signal) => invoke(signal, () => provider.generate(request, signal)),
    };
    if ('generateAgent' in provider && typeof provider.generateAgent === 'function') {
      const agent = provider as AiProvider & AgentProvider;
      wrapped.generateAgent = (request, signal) => invoke(signal, () => agent.generateAgent(request, signal));
    }
    return { provider: wrapped, releaseUnused: () => { unused?.releaseUnused(); unused = undefined; } };
  }
}

export const processCapacity = { current: new ProviderCapacity() };
