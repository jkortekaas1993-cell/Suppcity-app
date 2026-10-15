import {
  activeWorkoutReducer as reduce,
  completedSetCount,
  restRemainingMs,
  type ActiveWorkoutState,
} from '../activeWorkoutReducer';

function started(): ActiveWorkoutState {
  const s = reduce(null, {
    type: 'start',
    workoutId: 'w1',
    title: 'Push',
    startedAt: 1000,
    exercises: [
      {
        exerciseId: 'bench',
        name: 'Bankdrukken',
        restSeconds: 120,
        previous: [
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 4 },
        ],
        setIds: ['s1', 's2', 's3'],
      },
    ],
  });
  if (!s) throw new Error('not started');
  return s;
}

describe('activeWorkoutReducer', () => {
  it('starts with prefilled sets from last time', () => {
    const s = started();
    const sets = s.exercises[0]?.sets ?? [];
    expect(sets.map((x) => x.weightKg)).toEqual([80, 80, null]);
    expect(sets.map((x) => x.position)).toEqual([0, 1, 2]);
  });

  it('ticking a set starts the rest timer with the exercise rest time', () => {
    const s = reduce(started(), { type: 'toggleSet', setId: 's1', now: 5000 });
    expect(s?.restEndsAt).toBe(5000 + 120_000);
    expect(s?.restDurationSeconds).toBe(120);
    expect(s && completedSetCount(s)).toBe(1);
    expect(restRemainingMs(s ?? null, 65_000)).toBe(60_000);
  });

  it('ticking an empty set copies previous values; unticking keeps values', () => {
    let s = reduce(started(), { type: 'updateSet', setId: 's1', patch: { weightKg: null, reps: null } });
    s = reduce(s, { type: 'toggleSet', setId: 's1', now: 1 });
    expect(s?.exercises[0]?.sets[0]).toMatchObject({ weightKg: 80, reps: 5, completedAt: 1 });
    s = reduce(s, { type: 'toggleSet', setId: 's1', now: 2 });
    expect(s?.exercises[0]?.sets[0]).toMatchObject({ weightKg: 80, reps: 5, completedAt: null });
  });

  it('adds a set copying the one above, and removes sets', () => {
    let s = reduce(started(), { type: 'updateSet', setId: 's3', patch: { weightKg: 85, reps: 3 } });
    s = reduce(s, { type: 'addSet', exerciseId: 'bench', setId: 's4' });
    expect(s?.exercises[0]?.sets[3]).toMatchObject({ id: 's4', weightKg: 85, reps: 3, position: 3 });
    s = reduce(s, { type: 'removeSet', setId: 's2' });
    expect(s?.exercises[0]?.sets.map((x) => x.id)).toEqual(['s1', 's3', 's4']);
  });

  it('adds exercises after existing positions and ignores duplicates', () => {
    let s = reduce(started(), { type: 'addExercise', exercise: { exerciseId: 'row', name: 'Roeien', setIds: ['r1'] } });
    expect(s?.exercises[1]?.sets[0]?.position).toBe(3);
    expect(s?.exercises[1]?.restSeconds).toBe(90);
    s = reduce(s, { type: 'addExercise', exercise: { exerciseId: 'row', name: 'Roeien', setIds: ['r2'] } });
    expect(s?.exercises).toHaveLength(2);
    s = reduce(s, { type: 'removeExercise', exerciseId: 'bench' });
    expect(s?.exercises.map((e) => e.exerciseId)).toEqual(['row']);
  });

  it('no rest timer when rest is 0, and clamps configured rest', () => {
    let s = reduce(started(), { type: 'setRestSeconds', exerciseId: 'bench', seconds: 0 });
    s = reduce(s, { type: 'toggleSet', setId: 's1', now: 10 });
    expect(s?.restEndsAt).toBeNull();
    s = reduce(s, { type: 'setRestSeconds', exerciseId: 'bench', seconds: 99_999 });
    expect(s?.exercises[0]?.restSeconds).toBe(900);
  });

  it('adjusts and skips rest', () => {
    let s = reduce(started(), { type: 'toggleSet', setId: 's1', now: 0 });
    s = reduce(s, { type: 'adjustRest', deltaSeconds: 30, now: 1000 });
    expect(s?.restEndsAt).toBe(150_000);
    s = reduce(s, { type: 'adjustRest', deltaSeconds: -200, now: 1000 });
    expect(s?.restEndsAt).toBeNull();
    s = reduce(s, { type: 'toggleSet', setId: 's2', now: 0 });
    s = reduce(s, { type: 'skipRest' });
    expect(s?.restEndsAt).toBeNull();
  });

  it('ignores actions without an active workout and ends cleanly', () => {
    expect(reduce(null, { type: 'skipRest' })).toBeNull();
    expect(reduce(started(), { type: 'end' })).toBeNull();
  });
});
