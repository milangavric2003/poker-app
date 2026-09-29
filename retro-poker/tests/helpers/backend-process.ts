import { buildApp } from '../../backend/src/app';
import { ac23Deck, sequenceRandom } from './fixtures';
import type { AiProvider, ProviderRequest, ProviderResult } from '../../backend/src/ai/types';
import { loadAiConfig } from '../../backend/src/ai/config';

const fakeProvider: AiProvider = { async generate(request: ProviderRequest): Promise<ProviderResult> {
  if (request.purpose === 'bot') {
    const context = request.context as { gameId: string; handId: string; expectedVersion: number;
      actorId: string; decisionOrdinal: number; legalActions: Array<{ type: string }> };
    const action = context.legalActions.find(candidate => candidate.type === 'check') ?? context.legalActions[0]!;
    return { candidate: { gameId: context.gameId, handId: context.handId,
      expectedVersion: context.expectedVersion, actorId: context.actorId,
      decisionOrdinal: context.decisionOrdinal, type: action.type },
      usage: { promptTokens: 0, candidateTokens: 2, totalTokens: 2 } };
  }
  return { candidate: { summary: 'Offline fake analiza.', goodDecisions: [], possibleMistakes: [],
    nextSteps: ['Nastavi sa proverom uloga.'] }, usage: { promptTokens: 10, candidateTokens: 4, totalTokens: 14 } };
} };

const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
  botRandom: sequenceRandom(Array(100).fill(0.9)), aiProvider: fakeProvider,
  aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-fake-only' }) });
await app.listen({ host: '127.0.0.1', port: Number(process.env.TEST_BACKEND_PORT ?? 0) });
const address = app.server.address();
if (address && typeof address !== 'string') process.send?.(address.port);
process.on('message', () => { void app.close().then(() => process.exit(0)); });
