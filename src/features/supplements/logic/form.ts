import type { SupplementInput } from '../data/types';
import { ALL_DAYS_MASK, effectiveMask, normaliseTime, type ScheduleMode } from './schedule';

/**
 * "+ Supplement toevoegen" form → validated repository input. Pure.
 * Hard rule 4: no defaults for dose or time; the user fills them in.
 */

export interface SupplementFormValues {
  id?: string;
  name: string;
  doseText: string;
  mode: ScheduleMode;
  /** Days chosen for mode 'fixed'. */
  fixedDaysMask: number;
  /** The user's own training days (modes 'training' and 'rest'). */
  trainingDaysMask: number;
  time: string;
  unitsPerPack: string;
  unitsLeft: string;
  variantGid: string | null;
}

export type SupplementFormField = 'name' | 'doseText' | 'days' | 'time' | 'unitsPerPack' | 'unitsLeft';

export type FormResult =
  | { ok: true; input: SupplementInput; trainingDaysMask: number }
  | { ok: false; errors: Partial<Record<SupplementFormField, string>> };

export const NAME_MAX = 60;
export const DOSE_MAX = 40;
const UNITS_MAX = 100_000;

export function emptyForm(trainingDaysMask = 0): SupplementFormValues {
  return {
    name: '',
    doseText: '',
    mode: 'fixed',
    fixedDaysMask: 0,
    trainingDaysMask,
    time: '',
    unitsPerPack: '',
    unitsLeft: '',
    variantGid: null,
  };
}

function parseCount(raw: string): number | null | 'invalid' {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return 'invalid';
  const n = Number(s);
  return n > UNITS_MAX ? 'invalid' : n;
}

export function validateSupplementForm(v: SupplementFormValues, opts: { isNew: boolean }): FormResult {
  const errors: Partial<Record<SupplementFormField, string>> = {};
  const name = v.name.trim();
  if (!name) errors.name = 'Vul een naam in.';
  else if (name.length > NAME_MAX) errors.name = `Maximaal ${NAME_MAX} tekens.`;

  const dose = v.doseText.trim();
  if (dose.length > DOSE_MAX) errors.doseText = `Maximaal ${DOSE_MAX} tekens.`;

  const time = normaliseTime(v.time);
  if (!time) errors.time = 'Vul een tijd in als uu:mm.';

  const mask = effectiveMask(v.mode, v.fixedDaysMask, v.trainingDaysMask);
  if (v.mode === 'fixed' && mask === 0) errors.days = 'Kies minstens één dag.';
  if (v.mode === 'training' && mask === 0) errors.days = 'Kies je trainingsdagen.';
  if (v.mode === 'rest' && (v.trainingDaysMask & ALL_DAYS_MASK) === 0) errors.days = 'Kies je trainingsdagen; de andere dagen zijn rustdagen.';
  else if (v.mode === 'rest' && mask === 0) errors.days = 'Er blijven geen rustdagen over.';

  const perPack = parseCount(v.unitsPerPack);
  if (perPack === 'invalid' || perPack === 0) errors.unitsPerPack = 'Vul een heel aantal porties in.';
  const left = parseCount(v.unitsLeft);
  if (left === 'invalid') errors.unitsLeft = 'Vul een heel aantal porties in.';

  if (Object.keys(errors).length > 0 || !time || perPack === 'invalid' || left === 'invalid') return { ok: false, errors };

  // A new pack starts full when the user only filled in the pack size.
  const unitsLeft = left ?? (opts.isNew ? perPack : null);

  return {
    ok: true,
    trainingDaysMask: v.trainingDaysMask & ALL_DAYS_MASK,
    input: {
      id: v.id,
      name,
      dose_text: dose,
      shopify_variant_gid: v.variantGid,
      units_per_pack: perPack,
      units_left: unitsLeft,
      schedules: [{ mode: v.mode, days_mask: mask, time_local: time }],
    },
  };
}
