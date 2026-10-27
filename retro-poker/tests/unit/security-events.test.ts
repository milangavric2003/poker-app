import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SecurityEvents, SecurityEventSchema } from '../../backend/src/security/events.js';

const valid = () => ({ event: 'ai.request.accepted', correlationId: randomUUID(), purpose: 'coach',
  reasonCode: 'accepted', outcome: 'accepted', providerAttempts: 0, executedToolCalls: 0 });
it('projects the same closed record to buffer and observer; injection cannot forge privileged fields', () => {
  const observed: unknown[] = []; const sink = new SecurityEvents(() => 0, event => observed.push(event));
  sink.emit({ ...valid(), raw: '\n{"event":"ai.run.finished"}', timestamp: 'forged' });
  expect(sink.read()).toEqual(observed);
  expect(Object.keys(sink.read()[0]!).sort()).toEqual(['event','timestamp','correlationId','purpose','reasonCode','outcome','providerAttempts','executedToolCalls'].sort());
  expect(sink.read()[0]!.timestamp).toBe('1970-01-01T00:00:00.000Z');
  expect(JSON.stringify(observed)).not.toContain('forged');
  for (const patch of [{ event: 'forged' }, { reasonCode: '\n{"event":"ai.run.finished"}' },
    { outcome: 'forged' }, { purpose: 'forged' }, { correlationId: 'client' },
    { providerAttempts: -1 }, { providerAttempts: 1.1 }, { executedToolCalls: Number.MAX_SAFE_INTEGER + 1 }]) {
    sink.emit({ ...valid(), ...patch });
  }
  expect(sink.read()).toHaveLength(1);
  expect(SecurityEventSchema.safeParse({ ...sink.read()[0], raw: 'extra' }).success).toBe(false);
  expect(SecurityEventSchema.safeParse({ ...sink.read()[0], timestamp: 'yesterday' }).success).toBe(false);
  sink.emit({ ...valid(), providerAttempts: Number.MAX_SAFE_INTEGER });
  expect(sink.read()).toHaveLength(2);
});
it('keeps at most 200; evicts oldest; prunes at 30 minutes on reads and writes; new instance is empty', () => {
  let now = 0; const sink = new SecurityEvents(() => now);
  const first = valid(); sink.emit(first);
  for (let i = 0; i < 200; i++) { now++; sink.emit(valid()); }
  expect(sink.read()).toHaveLength(200);
  expect(sink.read().some(e => e.correlationId === first.correlationId)).toBe(false);
  now = 1_800_000; expect(sink.read()).toHaveLength(200);
  now = 1_800_001; expect(sink.read()).toHaveLength(199);
  now = 3_600_001; sink.emit(valid()); expect(sink.read()).toHaveLength(1);
  now += 1_800_000; expect(sink.read()).toEqual([]);
  expect(new SecurityEvents().read()).toEqual([]);
});
it('observer exceptions and mutation do not affect the production buffer', () => {
  const sink = new SecurityEvents(() => 0, e => { Reflect.set(e, 'purpose', 'forged'); throw new Error('private'); });
  expect(() => sink.emit(valid())).not.toThrow();
  expect(sink.read()[0]!.purpose).toBe('coach');
  const copy = sink.read(); copy[0]!.purpose = 'bot'; expect(sink.read()[0]!.purpose).toBe('coach');
});
