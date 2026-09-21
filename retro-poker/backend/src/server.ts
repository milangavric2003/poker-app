// T002: development transport scaffold only. Game routes belong to T019.
import Fastify from 'fastify';
const app = Fastify({ logger: true });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
try {
  await app.listen({ host: '127.0.0.1', port: 3001 });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

