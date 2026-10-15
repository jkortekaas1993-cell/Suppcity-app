import { chunk, compareTimestamps, maxUpdatedAt, mergeRow, rewind } from '../merge';
import type { SyncRow } from '../types';

const row = (over: Partial<SyncRow> = {}): SyncRow => ({
  id: 'r1',
  user_id: 'u1',
  created_at: '2026-10-12T10:00:00.000Z',
  updated_at: '2026-10-12T10:00:00.000Z',
  deleted_at: null,
  title: 'a',
  ...over,
});

describe('mergeRow (LWW)', () => {
  it('inserts when there is no local row', () => {
    expect(mergeRow(null, row())).toEqual(row());
  });
  it('remote newer wins', () => {
    const merged = mergeRow(row(), row({ title: 'b', updated_at: '2026-10-12T11:00:00.000Z' }));
    expect(merged?.title).toBe('b');
  });
  it('local newer wins → no write when nothing changes', () => {
    expect(mergeRow(row({ title: 'mine', updated_at: '2026-10-12T12:00:00Z' }), row({ title: 'old' }))).toBeNull();
  });
  it('identical rows → no write (also with different timestamp precision)', () => {
    expect(mergeRow(row(), row({ updated_at: '2026-10-12T10:00:00+00:00', server_updated_at: 'x' }))).toBeNull();
  });
  it('tie → remote wins (server sequenced)', () => {
    expect(mergeRow(row({ title: 'local' }), row({ title: 'remote' }))?.title).toBe('remote');
  });
  it('microseconds decide', () => {
    expect(compareTimestamps('2026-10-12T10:00:00.000002+00:00', '2026-10-12T10:00:00.000001Z')).toBe(1);
    const merged = mergeRow(row({ updated_at: '2026-10-12T10:00:00.000001Z' }), row({ title: 'b', updated_at: '2026-10-12T10:00:00.000002Z' }));
    expect(merged?.title).toBe('b');
  });
  it('older remote delete still deletes, local content kept', () => {
    const merged = mergeRow(
      row({ title: 'edited', updated_at: '2026-10-12T12:00:00Z' }),
      row({ deleted_at: '2026-10-12T11:00:00Z', updated_at: '2026-10-12T11:00:00Z' }),
    );
    expect(merged).toMatchObject({ title: 'edited', deleted_at: '2026-10-12T11:00:00Z' });
  });
  it('newer remote cannot undelete a local delete', () => {
    const merged = mergeRow(
      row({ deleted_at: '2026-10-12T10:30:00Z', updated_at: '2026-10-12T10:30:00Z' }),
      row({ title: 'b', updated_at: '2026-10-12T11:00:00Z' }),
    );
    expect(merged).toMatchObject({ title: 'b', deleted_at: '2026-10-12T10:30:00Z' });
  });
  it('keeps local identity fields', () => {
    const merged = mergeRow(row(), row({ title: 'b', created_at: '1999-01-01T00:00:00Z', updated_at: '2026-10-13T00:00:00Z' }));
    expect(merged?.created_at).toBe('2026-10-12T10:00:00.000Z');
  });
  it('converges: merge(a,b) and merge(b,a) agree on content', () => {
    const a = row({ title: 'a', updated_at: '2026-10-12T11:00:00.000Z' });
    const b = row({ title: 'b', updated_at: '2026-10-12T12:00:00.000Z', deleted_at: '2026-10-12T12:00:00.000Z' });
    const ab = mergeRow(a, b) ?? a;
    const ba = mergeRow(b, a) ?? b;
    expect({ ...ab }).toEqual({ ...ba });
  });
});

describe('helpers', () => {
  it('chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
  it('rewind and maxUpdatedAt', () => {
    expect(rewind('2026-10-12T10:05:00.000Z', 300_000)).toBe('2026-10-12T10:00:00.000Z');
    expect(rewind(null, 1)).toBeNull();
    expect(maxUpdatedAt([row(), row({ updated_at: '2026-10-13T00:00:00Z' })])).toBe('2026-10-13T00:00:00Z');
    expect(maxUpdatedAt([])).toBeNull();
  });
});
