import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Limiter, LimiterFullError } from '../src/limiter.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

test('limiter runs at most maxConcurrent tasks and queues the rest in order', async () => {
  const limiter = new Limiter(2);
  const gates = [deferred(), deferred(), deferred()];
  const order: number[] = [];
  const tasks = gates.map((g, i) =>
    limiter.run(async () => {
      order.push(i);
      await g.promise;
      return i;
    }),
  );
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(order, [0, 1]);
  assert.equal(limiter.active, 2);
  assert.equal(limiter.waiting, 1);
  gates[0]!.resolve();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(order, [0, 1, 2]);
  gates[1]!.resolve();
  gates[2]!.resolve();
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2]);
  assert.equal(limiter.active, 0);
});

test('limiter refuses work beyond the queue bound and recovers after failures', async () => {
  const limiter = new Limiter(1, 1);
  const gate = deferred();
  const first = limiter.run(() => gate.promise);
  const second = limiter.run(async () => 'second');
  await assert.rejects(limiter.run(async () => 'third'), LimiterFullError);
  gate.resolve();
  await first;
  assert.equal(await second, 'second');
  await assert.rejects(limiter.run(async () => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(limiter.active, 0);
  assert.equal(await limiter.run(async () => 'ok'), 'ok');
});
