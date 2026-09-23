import { buildApp } from '../../backend/src/app';
import { ac23Deck, sequenceRandom } from './fixtures';

const app = buildApp({ deck: ac23Deck, deckRandom: sequenceRandom([]),
  botRandom: sequenceRandom(Array(100).fill(0.9)) });
await app.listen({ host: '127.0.0.1', port: Number(process.env.TEST_BACKEND_PORT ?? 0) });
const address = app.server.address();
if (address && typeof address !== 'string') process.send?.(address.port);
process.on('message', () => { void app.close().then(() => process.exit(0)); });
