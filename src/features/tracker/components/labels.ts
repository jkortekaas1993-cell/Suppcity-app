import type { Equipment, MuscleGroup } from '@/lib/db/types';

export const MUSCLE_LABELS_NL: Record<MuscleGroup, string> = {
  borst: 'Borst',
  rug: 'Rug',
  schouders: 'Schouders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  onderarmen: 'Onderarmen',
  quadriceps: 'Quadriceps',
  hamstrings: 'Hamstrings',
  billen: 'Billen',
  kuiten: 'Kuiten',
  buik: 'Buik',
  onderrug: 'Onderrug',
  full_body: 'Overig',
};

export const EQUIPMENT_LABELS_NL: Record<Equipment, string> = {
  barbell: 'Halter',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Kabel',
  bodyweight: 'Lichaamsgewicht',
  kettlebell: 'Kettlebell',
  band: 'Elastiek',
  other: 'Overig',
};

/** Filter groups for the exercise picker (Borst, Rug, Benen, ...). */
export const MUSCLE_FILTERS: { label: string; muscles: MuscleGroup[] }[] = [
  { label: 'Borst', muscles: ['borst'] },
  { label: 'Rug', muscles: ['rug', 'onderrug'] },
  { label: 'Benen', muscles: ['quadriceps', 'hamstrings', 'billen', 'kuiten'] },
  { label: 'Schouders', muscles: ['schouders'] },
  { label: 'Armen', muscles: ['biceps', 'triceps', 'onderarmen'] },
  { label: 'Core', muscles: ['buik'] },
  { label: 'Overig', muscles: ['full_body'] },
];
