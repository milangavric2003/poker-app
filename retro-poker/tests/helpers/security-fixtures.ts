import { GameSession } from '../../backend/src/session.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { getDecisionEvidence } from '../../backend/src/agent/tools.js';
import { FakeAiProvider, type FakeAiStep } from './fake-ai-provider.js';
import { FakeClock } from './fake-clock.js';
import { ac23Deck, sequenceRandom } from './fixtures.js';

/** Stable pre/post inputs. UUIDs are server-generated resource labels, never an oracle. */
export const securityInputs = {
  deck: ['As', 'Kc', 'Ah', 'Kd', ...ac23Deck.slice(4)] as const,
  goal: { focus: 'street' as const },
  forbiddenTools: ['shell', 'constructor', 'toString'],
  burstTimes: [0, 1000, 2000, 3000, 4000, 5000],
  scriptPath: '/security-probe.js',
  marker: '__w08ScriptExecuted',
};

export function securityFixture(steps: FakeAiStep[] = []) {
  const provider = new FakeAiProvider(structuredClone(steps));
  const clock = new FakeClock();
  const executions: Array<Parameters<typeof getDecisionEvidence>> = [];
  const dependencies = {
    deck: securityInputs.deck, deckRandom: sequenceRandom([]),
    botRandom: sequenceRandom(Array<number>(100).fill(0.9)),
    aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-security-fake' }),
    aiProvider: provider, aiClock: clock,
    coachExecuteTool: (...args: Parameters<typeof getDecisionEvidence>) => {
      executions.push(args);
      return getDecisionEvidence(...args);
    },
  };
  const session = new GameSession(dependencies);
  return { session, dependencies, provider, clock, executions };
}

export function finishSecurityGame(session: GameSession) {
  const initial = session.create(1);
  return session.action({ gameId: initial.gameId, handId: initial.hand.handId,
    expectedVersion: initial.version, type: 'all_in' });
}

/** Poker and RNG state only; run/usage metadata lives outside this projection. */
export function pokerSnapshot(session: GameSession) {
  const game = session.get();
  if (!game) throw new Error('Missing security game');
  return JSON.stringify({ gameId: game.gameId, version: game.version, botCount: game.botCount,
    handNumber: game.handNumber, hand: game.hand, history: game.history,
    previousResult: game.previousResult, facts: game.facts,
    deckRandom: game.deckRandom, botRandom: game.botRandom });
}

export async function settleSecurityRun(session: GameSession, runId: string) {
  for (let i = 0; i < 500; i++) {
    const run = session.coachStatus(runId);
    if (run.stopReason) {
      // Let the separately queued usage commit settle as well.
      for (let j = 0; j < 20; j++) await Promise.resolve();
      return run;
    }
    await Promise.resolve();
  }
  throw new Error('Immediate fake run failed to settle; fixture/setup failure');
}
