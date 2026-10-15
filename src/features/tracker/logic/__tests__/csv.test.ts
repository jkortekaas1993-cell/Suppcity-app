import { EXERCISES_NL } from '@/content/exercises.nl';

import { escapeCsvField, parseCsv, toCsv } from '../csv';
import { workoutsToCsv, type ExportRow } from '../csvExport';
import {
  buildAliasIndex,
  CsvImportError,
  mapExerciseNames,
  parseDurationSeconds,
  parseExportDate,
  parseHevyCsv,
  parseStrongCsv,
  parseWorkoutCsv,
} from '../csvImport';

const HEVY = [
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
  '"Push dag","26 Jan 2024, 18:05","26 Jan 2024, 19:10","Goed, ""zwaar""","Bench Press (Barbell)",,,0,"warmup",40,10,,,',
  '"Push dag","26 Jan 2024, 18:05","26 Jan 2024, 19:10","Goed, ""zwaar""","Bench Press (Barbell)",,,1,"normal",80,5,,,8',
  '"Push dag","26 Jan 2024, 18:05","26 Jan 2024, 19:10","Goed, ""zwaar""","Zercher Carry",,,0,"normal",60,,,30,',
  '"Pull","28 Jan 2024, 09:00","28 Jan 2024, 10:00","","Pull Up",,,0,"normal",,8,,,',
].join('\n');

const STRONG = [
  'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
  '2024-01-26 18:05:00;Legs;1h 5m;Squat (Barbell);W;60;5;0;0;;;',
  '2024-01-26 18:05:00;Legs;1h 5m;Squat (Barbell);1;100;5;0;0;;;8,5',
  '2024-01-26 18:05:00;Legs;1h 5m;Squat (Barbell);Rest Timer;0;0;0;90;;;',
  '2024-01-26 18:05:00;Legs;1h 5m;Leg Press;1;180;10;0;0;;;',
  'not-a-date;Legs;1h;Leg Press;1;180;10;0;0;;;',
].join('\r\n');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, empty fields and CRLF', () => {
    expect(parseCsv('a,"b,c","d""e"\r\n1,,3\r\n')).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '', '3'],
    ]);
  });
  it('detects semicolons and strips BOM', () => {
    expect(parseCsv('﻿a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('round-trips through toCsv', () => {
    const csv = toCsv(['x', 'y'], [['a,b', 'he said "hi"'], [1, null]]);
    expect(parseCsv(csv)).toEqual([
      ['x', 'y'],
      ['a,b', 'he said "hi"'],
      ['1', ''],
    ]);
    expect(escapeCsvField('plain')).toBe('plain');
  });
});

describe('dates and durations', () => {
  it('parses Hevy and Strong dates in local time', () => {
    const d = parseExportDate('26 Jan 2024, 18:05');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2024, 0, 26, 18, 5]);
    const s = parseExportDate('2024-01-26 18:05:00');
    expect(s?.getTime()).toBe(d?.getTime());
    expect(parseExportDate('2024-01-26T17:05:00.000Z')?.toISOString()).toBe('2024-01-26T17:05:00.000Z');
    expect(parseExportDate('nope')).toBeNull();
  });
  it('parses durations', () => {
    expect(parseDurationSeconds('1h 5m')).toBe(3900);
    expect(parseDurationSeconds('45m')).toBe(2700);
    expect(parseDurationSeconds('3600')).toBe(3600);
    expect(parseDurationSeconds('1:05:00')).toBe(3900);
    expect(parseDurationSeconds('')).toBeNull();
  });
});

describe('parseHevyCsv', () => {
  it('groups rows into workouts with typed sets', () => {
    const { workouts, warnings } = parseHevyCsv(HEVY);
    expect(warnings).toEqual([]);
    expect(workouts).toHaveLength(2);
    const push = workouts[0];
    expect(push?.title).toBe('Push dag');
    expect(push?.notes).toBe('Goed, "zwaar"');
    expect(push?.source).toBe('import_hevy');
    expect(push?.sets.map((s) => [s.exerciseName, s.setType, s.weightKg, s.reps, s.rpe, s.position])).toEqual([
      ['Bench Press (Barbell)', 'warmup', 40, 10, null, 0],
      ['Bench Press (Barbell)', 'normal', 80, 5, 8, 1],
      ['Zercher Carry', 'normal', 60, null, null, 2],
    ]);
    const durationMs = Date.parse(push?.endedAt ?? '') - Date.parse(push?.startedAt ?? '');
    expect(durationMs).toBe(65 * 60_000);
    expect(workouts[1]?.sets[0]).toMatchObject({ exerciseName: 'Pull Up', weightKg: null, reps: 8 });
  });
  it('converts pounds when only weight_lbs exists', () => {
    const csv = 'title,start_time,end_time,exercise_title,set_index,set_type,weight_lbs,reps\nA,26 Jan 2024 18:05,,Squat (Barbell),0,normal,225,5';
    expect(parseHevyCsv(csv).workouts[0]?.sets[0]?.weightKg).toBe(102.06);
  });
  it('rejects a Strong file', () => {
    expect(() => parseHevyCsv(STRONG)).toThrow(CsvImportError);
  });
});

describe('parseStrongCsv', () => {
  it('parses sets, skips rest-timer rows and warns on bad dates', () => {
    const { workouts, warnings } = parseStrongCsv(STRONG);
    expect(workouts).toHaveLength(1);
    const w = workouts[0];
    expect(w?.source).toBe('import_strong');
    expect(w?.sets.map((s) => [s.exerciseName, s.setType, s.weightKg, s.reps, s.rpe])).toEqual([
      ['Squat (Barbell)', 'warmup', 60, 5, null],
      ['Squat (Barbell)', 'normal', 100, 5, 8.5],
      ['Leg Press', 'normal', 180, 10, null],
    ]);
    expect(Date.parse(w?.endedAt ?? '') - Date.parse(w?.startedAt ?? '')).toBe(3900_000);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Regel 6');
  });
  it('converts lbs via the Weight Unit column', () => {
    const csv = 'Date,Workout Name,Exercise Name,Set Order,Weight,Weight Unit,Reps\n2024-01-26 18:05:00,A,Deadlift (Barbell),1,315,lbs,3';
    expect(parseStrongCsv(csv).workouts[0]?.sets[0]?.weightKg).toBe(142.88);
  });
});

describe('parseWorkoutCsv', () => {
  it('auto-detects the format', () => {
    expect(parseWorkoutCsv(HEVY).format).toBe('hevy');
    expect(parseWorkoutCsv(STRONG).format).toBe('strong');
    expect(() => parseWorkoutCsv('foo,bar\n1,2')).toThrow(CsvImportError);
  });
});

describe('exercise mapping', () => {
  const index = buildAliasIndex(
    EXERCISES_NL.map((e) => ({ id: e.slug, name: e.name_nl, aliases: e.aliases_en })),
  );
  it('maps English aliases case- and punctuation-insensitively', () => {
    const m = mapExerciseNames(['Bench Press (Barbell)', 'squat (barbell)', 'Leg Press', 'Zercher Carry', 'zercher carry'], index);
    expect(m.matched.get('Bench Press (Barbell)')).toBe('bench-press-barbell');
    expect(m.matched.get('squat (barbell)')).toBe('squat-barbell');
    expect(m.matched.get('Leg Press')).toBe('leg-press-machine');
    expect(m.unknown).toEqual(['Zercher Carry']);
  });
  it('library aliases are unique across exercises', () => {
    const seen = new Map<string, string>();
    for (const e of EXERCISES_NL) {
      for (const a of e.aliases_en) {
        const key = a.toLowerCase();
        expect(seen.get(key) ?? e.slug).toBe(e.slug);
        seen.set(key, e.slug);
      }
    }
  });
});

describe('workoutsToCsv', () => {
  it('exports Hevy-compatible rows that re-import', () => {
    const row: ExportRow = {
      workoutId: 'w1',
      title: 'Push, zwaar',
      startedAt: '2026-10-15T10:00:00.000Z',
      endedAt: '2026-10-15T11:00:00.000Z',
      notes: null,
      source: 'app',
      exerciseId: 'bench-press-barbell',
      exerciseName: 'Bankdrukken (halter)',
      setIndex: 0,
      setType: 'normal',
      weightKg: 82.5,
      reps: 5,
      rpe: null,
      completedAt: '2026-10-15T10:10:00.000Z',
    };
    const csv = workoutsToCsv([row]);
    expect(csv.split('\r\n')[0]).toBe(
      'title,start_time,end_time,description,exercise_title,set_index,set_type,weight_kg,reps,rpe,exercise_id,workout_id,source,completed_at',
    );
    const back = parseHevyCsv(csv).workouts[0];
    expect(back?.title).toBe('Push, zwaar');
    expect(back?.startedAt).toBe('2026-10-15T10:00:00.000Z');
    expect(back?.sets[0]).toMatchObject({ exerciseName: 'Bankdrukken (halter)', weightKg: 82.5, reps: 5 });
  });
});
