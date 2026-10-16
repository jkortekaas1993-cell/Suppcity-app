import { nodeSqliteAvailable, openNodeSqlite } from '../testing/nodeSqliteDb';
import { createTransactionQueue } from '../txQueue';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('transaction queue', () => {
  it('runs tasks one at a time, in order, and keeps going after a failure', async () => {
    const q = createTransactionQueue();
    const log: string[] = [];
    const task = (name: string, fail = false) => async () => {
      log.push(`start ${name}`);
      await tick();
      await tick();
      log.push(`end ${name}`);
      if (fail) throw new Error(name);
      return name;
    };
    const results = await Promise.allSettled([q.run(task('a')), q.run(task('b', true)), q.run(task('c'))]);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});

const maybe = nodeSqliteAvailable ? describe : describe.skip;

maybe('exclusive transactions on one database (node:sqlite)', () => {
  it('concurrent writers do not interleave or fail; a failing one rolls back alone', async () => {
    const db = openNodeSqlite();
    await db.runAsync('CREATE TABLE t (k TEXT PRIMARY KEY, v INTEGER)', []);
    const write = (k: string, fail = false) =>
      db.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('INSERT INTO t (k, v) VALUES (?, 1)', [k]);
        await tick();
        await tx.runAsync('UPDATE t SET v = v + 1 WHERE k = ?', [k]);
        if (fail) throw new Error('boom');
      });
    const res = await Promise.allSettled([write('a'), write('b', true), write('c')]);
    expect(res.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(await db.getAllAsync('SELECT k, v FROM t ORDER BY k', [])).toEqual([
      { k: 'a', v: 2 },
      { k: 'c', v: 2 },
    ]);
  });

  it('a nested transaction is a bug and throws instead of waiting forever', async () => {
    const db = openNodeSqlite();
    const err = await db.withExclusiveTransactionAsync((tx) => tx.withExclusiveTransactionAsync(async () => undefined)).catch((e: unknown) => e);
    expect((err as Error).message).toMatch(/Nested transaction/);
  });
});
