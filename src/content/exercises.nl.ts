import type { Equipment, MuscleGroup } from '@/lib/db/types';

/**
 * Seed data for the Dutch exercise library. `slug` is the stable key used by
 * programs.ts, CSV import mapping and sync; never rename a slug, only add.
 * Tracker builder extends this list (target ~150 for MVP).
 */
export interface ExerciseSeed {
  slug: string;
  name_nl: string;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  /** Names used by Hevy/Strong exports, for CSV import mapping. */
  aliases_en: string[];
}

export const EXERCISES_NL: readonly ExerciseSeed[] = [
  {
    slug: 'bench-press-barbell',
    name_nl: 'Bankdrukken (halter)',
    primary_muscle: 'borst',
    secondary_muscles: ['triceps', 'schouders'],
    equipment: 'barbell',
    aliases_en: ['Bench Press (Barbell)'],
  },
  {
    slug: 'squat-barbell',
    name_nl: 'Squat (halter)',
    primary_muscle: 'quadriceps',
    secondary_muscles: ['billen', 'hamstrings', 'onderrug'],
    equipment: 'barbell',
    aliases_en: ['Squat (Barbell)'],
  },
  {
    slug: 'deadlift-barbell',
    name_nl: 'Deadlift (halter)',
    primary_muscle: 'onderrug',
    secondary_muscles: ['hamstrings', 'billen', 'rug'],
    equipment: 'barbell',
    aliases_en: ['Deadlift (Barbell)'],
  },
  {
    slug: 'overhead-press-barbell',
    name_nl: 'Schouderdrukken staand (halter)',
    primary_muscle: 'schouders',
    secondary_muscles: ['triceps'],
    equipment: 'barbell',
    aliases_en: ['Overhead Press (Barbell)'],
  },
  {
    slug: 'barbell-row',
    name_nl: 'Voorovergebogen roeien (halter)',
    primary_muscle: 'rug',
    secondary_muscles: ['biceps', 'onderrug'],
    equipment: 'barbell',
    aliases_en: ['Bent Over Row (Barbell)'],
  },
  {
    slug: 'pull-up',
    name_nl: 'Optrekken',
    primary_muscle: 'rug',
    secondary_muscles: ['biceps'],
    equipment: 'bodyweight',
    aliases_en: ['Pull Up'],
  },
  {
    slug: 'lat-pulldown-cable',
    name_nl: 'Lat pulldown (kabel)',
    primary_muscle: 'rug',
    secondary_muscles: ['biceps'],
    equipment: 'cable',
    aliases_en: ['Lat Pulldown (Cable)'],
  },
  {
    slug: 'dumbbell-curl',
    name_nl: 'Bicepscurl (dumbbell)',
    primary_muscle: 'biceps',
    secondary_muscles: ['onderarmen'],
    equipment: 'dumbbell',
    aliases_en: ['Bicep Curl (Dumbbell)'],
  },
  {
    slug: 'triceps-pushdown-cable',
    name_nl: 'Triceps pushdown (kabel)',
    primary_muscle: 'triceps',
    secondary_muscles: [],
    equipment: 'cable',
    aliases_en: ['Triceps Pushdown', 'Triceps Pushdown (Cable - Straight Bar)'],
  },
  {
    slug: 'leg-press-machine',
    name_nl: 'Beenpers (machine)',
    primary_muscle: 'quadriceps',
    secondary_muscles: ['billen'],
    equipment: 'machine',
    aliases_en: ['Leg Press', 'Leg Press (Machine)'],
  },
  {
    slug: 'romanian-deadlift-barbell',
    name_nl: 'Roemeense deadlift (halter)',
    primary_muscle: 'hamstrings',
    secondary_muscles: ['billen', 'onderrug'],
    equipment: 'barbell',
    aliases_en: ['Romanian Deadlift (Barbell)'],
  },
  {
    slug: 'standing-calf-raise-machine',
    name_nl: 'Kuitheffen staand (machine)',
    primary_muscle: 'kuiten',
    secondary_muscles: [],
    equipment: 'machine',
    aliases_en: ['Standing Calf Raise (Machine)', 'Calf Raise (Machine)'],
  },
];
