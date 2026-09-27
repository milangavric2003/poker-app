import { buildApp, productionAiDependencies } from './app.js';
const app = buildApp(productionAiDependencies());
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
try {
  await app.listen({ host: '127.0.0.1', port: 3001 });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
