import {
  clampWeeklyGoal,
  daysBetween,
  DEFAULT_WEEKLY_GOAL,
  startOfWeek,
  weekGoalProgress,
  weekIndex,
  weekKey,
  weekVolume,
} from '../week';

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('week helpers', () => {
  it('clamps the weekly goal to 1..5', () => {
    expect(clampWeeklyGoal(0)).toBe(1);
    expect(clampWeeklyGoal(9)).toBe(5);
    expect(clampWeeklyGoal(3.4)).toBe(3);
    expect(clampWeeklyGoal('4')).toBe(4);
    expect(clampWeeklyGoal(null)).toBe(DEFAULT_WEEKLY_GOAL);
    expect(clampWeeklyGoal('abc')).toBe(DEFAULT_WEEKLY_GOAL);
  });

  it('starts weeks on Monday (local)', () => {
    const monday = startOfWeek(local(2026, 10, 18)); // Sunday
    expect([monday.getFullYear(), monday.getMonth() + 1, monday.getDate(), monday.getHours()]).toEqual([2026, 10, 12, 0]);
    expect(weekIndex(local(2026, 10, 12, 0))).toBe(weekIndex(local(2026, 10, 18, 23)));
    expect(weekIndex(local(2026, 10, 19, 0))).toBe(weekIndex(local(2026, 10, 18, 23)) + 1);
  });

  it('builds ISO week keys, also around new year', () => {
    expect(weekKey(local(2026, 10, 16))).toBe('2026-W42');
    expect(weekKey(local(2026, 12, 31))).toBe('2026-W53');
    expect(weekKey(local(2027, 1, 3))).toBe('2026-W53');
    expect(weekKey(local(2027, 1, 4))).toBe('2027-W01');
    expect(weekIndex(local(2027, 1, 4))).toBe(weekIndex(local(2026, 12, 28)) + 1);
  });

  it('counts progress toward the weekly goal without going over', () => {
    const now = local(2026, 10, 16);
    const started = [local(2026, 10, 12), local(2026, 10, 14), local(2026, 10, 9)].map((d) => d.toISOString());
    expect(weekGoalProgress(started, now, 4)).toEqual({ goal: 4, done: 2, filled: 2, reached: false });
    expect(weekGoalProgress(started, now, 1)).toEqual({ goal: 1, done: 2, filled: 1, reached: true });
    expect(weekGoalProgress([], now, 3)).toEqual({ goal: 3, done: 0, filled: 0, reached: false });
  });

  it('compares this week volume with last week', () => {
    const now = local(2026, 10, 16);
    const v = weekVolume(
      [
        { startedAt: local(2026, 10, 13).toISOString(), volumeKg: 10_800 },
        { startedAt: local(2026, 10, 7).toISOString(), volumeKg: 10_000 },
        { startedAt: local(2026, 9, 30).toISOString(), volumeKg: 99_999 },
      ],
      now,
    );
    expect(v).toEqual({ thisWeekKg: 10_800, lastWeekKg: 10_000, changePct: 8 });
    expect(weekVolume([], now).changePct).toBeNull();
  });

  it('counts calendar days between moments', () => {
    expect(daysBetween(local(2026, 10, 13, 23), local(2026, 10, 16, 1))).toBe(3);
    expect(daysBetween(local(2026, 10, 16, 1), local(2026, 10, 16, 23))).toBe(0);
  });
});
