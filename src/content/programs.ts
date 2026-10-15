/**
 * Ready-made training programs (kant-en-klare schema's). Reference exercises by slug
 * from exercises.nl.ts. Pure training content: no products, no supplement advice.
 * Program and day slugs are stable (routines store `program_slug`); only add.
 */
export interface ProgramExerciseSeed {
  slug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface ProgramDaySeed {
  name: string;
  exercises: ProgramExerciseSeed[];
}

export interface ProgramSeed {
  slug: string;
  name: string;
  level: 'beginner' | 'gevorderd';
  daysPerWeek: number;
  description: string;
  days: ProgramDaySeed[];
}

function e(slug: string, sets: number, repsMin: number, repsMax: number, restSeconds: number): ProgramExerciseSeed {
  return { slug, sets, repsMin, repsMax, restSeconds };
}

export const PROGRAMS: readonly ProgramSeed[] = [
  {
    slug: 'full-body-3x',
    name: 'Beginner full body 3x per week',
    level: 'beginner',
    daysPerWeek: 3,
    description:
      'Twee afwisselende full-body dagen (A/B), bijvoorbeeld ma-wo-vr. Lukt het bovenste aantal herhalingen in alle sets? Doe er de volgende keer iets gewicht bij.',
    days: [
      {
        name: 'Dag A',
        exercises: [
          e('squat-barbell', 3, 5, 8, 150),
          e('bench-press-barbell', 3, 5, 8, 150),
          e('barbell-row', 3, 8, 10, 120),
          e('lateral-raise-dumbbell', 2, 10, 15, 60),
          e('crunch', 2, 10, 15, 60),
        ],
      },
      {
        name: 'Dag B',
        exercises: [
          e('deadlift-barbell', 2, 5, 5, 180),
          e('overhead-press-barbell', 3, 6, 8, 150),
          e('lat-pulldown-cable', 3, 8, 12, 90),
          e('leg-press-machine', 2, 10, 12, 120),
          e('dumbbell-curl', 2, 10, 12, 60),
        ],
      },
    ],
  },
  {
    slug: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    level: 'gevorderd',
    daysPerWeek: 6,
    description:
      'Drie dagen die je één of twee keer per week rondloopt (3 of 6 trainingen). Duwen, trekken en benen elk op een eigen dag.',
    days: [
      {
        name: 'Push',
        exercises: [
          e('bench-press-barbell', 4, 5, 8, 150),
          e('shoulder-press-dumbbell', 3, 8, 10, 120),
          e('incline-bench-press-dumbbell', 3, 8, 12, 90),
          e('lateral-raise-dumbbell', 3, 12, 15, 60),
          e('triceps-rope-pushdown', 3, 10, 12, 60),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          e('deadlift-barbell', 3, 3, 5, 180),
          e('pull-up', 3, 6, 10, 120),
          e('seated-cable-row', 3, 8, 12, 90),
          e('face-pull-cable', 3, 12, 15, 60),
          e('hammer-curl-dumbbell', 3, 10, 12, 60),
        ],
      },
      {
        name: 'Legs',
        exercises: [
          e('squat-barbell', 4, 5, 8, 150),
          e('romanian-deadlift-barbell', 3, 8, 10, 120),
          e('leg-press-machine', 3, 10, 12, 90),
          e('lying-leg-curl-machine', 3, 10, 12, 60),
          e('standing-calf-raise-machine', 4, 10, 15, 60),
        ],
      },
    ],
  },
  {
    slug: 'upper-lower',
    name: 'Upper / Lower',
    level: 'gevorderd',
    daysPerWeek: 4,
    description:
      'Vier trainingen per week: twee keer bovenlichaam, twee keer onderlichaam. Elke spiergroep twee keer per week.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          e('bench-press-barbell', 4, 5, 8, 150),
          e('barbell-row', 4, 6, 10, 120),
          e('shoulder-press-dumbbell', 3, 8, 10, 90),
          e('lat-pulldown-cable', 3, 8, 12, 90),
          e('dumbbell-curl', 2, 10, 12, 60),
          e('triceps-pushdown-cable', 2, 10, 12, 60),
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          e('squat-barbell', 4, 5, 8, 150),
          e('romanian-deadlift-barbell', 3, 8, 10, 120),
          e('leg-extension-machine', 3, 10, 12, 60),
          e('seated-leg-curl-machine', 3, 10, 12, 60),
          e('standing-calf-raise-machine', 3, 10, 15, 60),
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          e('overhead-press-barbell', 4, 5, 8, 150),
          e('pull-up', 4, 6, 10, 120),
          e('incline-bench-press-dumbbell', 3, 8, 12, 90),
          e('seated-cable-row', 3, 8, 12, 90),
          e('lateral-raise-dumbbell', 3, 12, 15, 60),
          e('hammer-curl-dumbbell', 2, 10, 12, 60),
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          e('deadlift-barbell', 3, 3, 5, 180),
          e('bulgarian-split-squat', 3, 8, 10, 90),
          e('hip-thrust-barbell', 3, 8, 12, 90),
          e('lying-leg-curl-machine', 3, 10, 12, 60),
          e('hanging-leg-raise', 3, 10, 15, 60),
        ],
      },
    ],
  },
];
