import type { MuscleGroup } from '@/lib/db';

/** Dutch labels for the muscle-group bars (Voortgang → Week). */
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
  full_body: 'Hele lichaam',
};

export function muscleLabel(m: MuscleGroup): string {
  return MUSCLE_LABELS_NL[m] ?? m;
}
