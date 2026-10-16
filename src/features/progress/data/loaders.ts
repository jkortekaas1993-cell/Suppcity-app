import { buildSessions, type SessionStat } from '../logic/exerciseStats';
import { isoWeekRange, summarizeWeeks, type WeekSummary } from '../logic/week';
import { exerciseOptions, exerciseSets, weekRows, type ExerciseOption, type ReadDb } from './queries';

/** This week + last week, compared (Voortgang → Week, Vandaag "Volume week"). */
export async function loadWeekSummary(db: ReadDb, userId: string | null, now = new Date()): Promise<WeekSummary> {
  const from = isoWeekRange(now, -1).start;
  const to = isoWeekRange(now, 0).end;
  const { workouts, sets } = await weekRows(db, from, to, userId);
  return summarizeWeeks(workouts, sets, now);
}

export async function loadExerciseOptions(db: ReadDb, userId: string | null): Promise<ExerciseOption[]> {
  return exerciseOptions(db, userId);
}

export async function loadExerciseSessions(db: ReadDb, exerciseId: string, userId: string | null): Promise<SessionStat[]> {
  return buildSessions(await exerciseSets(db, exerciseId, userId));
}

/** The most-trained exercise and its sessions, for ProgressEntryCard. Null without history. */
export async function loadTopExercise(
  db: ReadDb,
  userId: string | null,
): Promise<{ exercise: ExerciseOption; sessions: SessionStat[] } | null> {
  const [top] = await exerciseOptions(db, userId);
  if (!top) return null;
  return { exercise: top, sessions: await loadExerciseSessions(db, top.id, userId) };
}
