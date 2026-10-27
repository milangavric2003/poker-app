import { z } from 'zod';

// Run before shared contracts are constructed: strict CSP also reports Zod's
// caught eval capability probe. Runtime validation works without that probe/JIT.
z.config({ jitless: true });
