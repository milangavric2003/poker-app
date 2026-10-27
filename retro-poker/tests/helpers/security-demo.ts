import { preview, type PreviewServer } from 'vite';
import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from '../../backend/src/app.js';
import { loadAiConfig } from '../../backend/src/ai/config.js';
import { systemClock } from '../../backend/src/ai/coordinator.js';
import type { RandomSource } from '../../backend/src/engine/types.js';
import type { AiProvider, AgentProvider } from '../../backend/src/ai/types.js';
import { FakeAiProvider, legalBotProposal } from './fake-ai-provider.js';
import { securityFixture } from './security-fixtures.js';
import { buildSecurityProduction } from './security-server.js';

// Only this local CLI injects synthetic data. Normal server entrypoints are unchanged.
// No env-file loader or production provider factory is called, even if a key exists.
const provider: AiProvider & AgentProvider = {
  async generate(request, signal) {
    await delay(150, undefined, { signal });
    if (request.purpose === 'bot') {
      const context = request.context as Parameters<typeof legalBotProposal>[0];
      const preferred = context.legalActions.filter(action => ['check', 'call', 'all_in'].includes(action.type));
      return legalBotProposal({ ...context, legalActions: preferred.length ? preferred : context.legalActions });
    }
    return new FakeAiProvider([{ kind: 'analysis_success' }]).generate(request, signal);
  },
  async generateAgent(request, signal) {
    await delay(150, undefined, { signal });
    return new FakeAiProvider([{ kind: request.stepOrdinal === 1 ? 'agent_tool' : 'agent_final' }])
      .generateAgent(request, signal);
  },
};
const fixture = securityFixture();
function demoRandom(): RandomSource { return { next: () => 0.9, clone: demoRandom }; }
const backend = buildApp({ ...fixture.dependencies, aiProvider: provider, aiClock: systemClock,
  botRandom: demoRandom(),
  aiConfig: loadAiConfig({ GEMINI_API_KEY: 'offline-security-demo' }) });
let frontend: PreviewServer | undefined;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await frontend?.close();
  await backend.close();
}

async function main() {
  await backend.listen({ host: '127.0.0.1', port: 3001 });
  await buildSecurityProduction();
  frontend = await preview({ configFile: 'vite.config.ts', envDir: false });
  console.log('Week08 lokalni demo: http://127.0.0.1:5173/');
  console.log('FAKE provider, sintetičke karte, 0 live AI poziva. Model oznake u UI-ju su konfiguracione oznake.');
  console.log('Stvarni sat: najviše 5 novih analiza/coaching zahteva u 60 s; najviše 2 aktivna provider posla.');
  console.log('Za početak: 1 bot, AI režim isključen, Nova partija, All-in, coaching cilj Odluke po fazama.');
  console.log('Za gašenje: Ctrl+C.');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void close().then(() => process.exit(0)); });
  }
}

void main().catch(async () => {
  console.error('Demo nije pokrenut. Proveri da li su portovi 3001/5173 slobodni i zavisnosti instalirane.');
  await close();
  process.exitCode = 1;
});
