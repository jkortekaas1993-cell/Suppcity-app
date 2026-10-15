/**
 * Ready-made training programs (kant-en-klare schema's). Reference exercises by slug
 * from exercises.nl.ts. Pure training content: no products, no supplement advice.
 */
export interface ProgramDaySeed {
  name: string;
  exercises: { slug: string; sets: number; repsMin: number; repsMax: number; restSeconds: number }[];
}

export interface ProgramSeed {
  slug: string;
  name: string;
  level: 'beginner' | 'gevorderd';
  daysPerWeek: number;
  description: string;
  days: ProgramDaySeed[];
}

export const PROGRAMS: readonly ProgramSeed[] = [
  {
    slug: 'full-body-3x',
    name: 'Full body 3x per week',
    level: 'beginner',
    daysPerWeek: 3,
    description: 'Twee afwisselende full-body dagen (A/B). Elke week iets zwaarder.',
    days: [
      {
        name: 'Dag A',
        exercises: [
          { slug: 'squat-barbell', sets: 3, repsMin: 5, repsMax: 8, restSeconds: 150 },
          { slug: 'bench-press-barbell', sets: 3, repsMin: 5, repsMax: 8, restSeconds: 150 },
          { slug: 'barbell-row', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120 },
        ],
      },
      {
        name: 'Dag B',
        exercises: [
          { slug: 'deadlift-barbell', sets: 2, repsMin: 5, repsMax: 5, restSeconds: 180 },
          { slug: 'overhead-press-barbell', sets: 3, repsMin: 6, repsMax: 8, restSeconds: 150 },
          { slug: 'lat-pulldown-cable', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
        ],
      },
    ],
  },
];
