/** Pure helpers for the Ik profile header (tested in __tests__/profile.test.ts). */

// A letter has distinct upper and lower case (avoids \p{L}, which older Hermes lacks).
const isLetter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase();
const firstLetter = (word: string) => [...word].find(isLetter) ?? '';

/** "Jesse Roelofsen" → "JR", "jesse" → "J"; null when there is no usable name. */
export function initialsFor(name: string | null): string | null {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((p) => firstLetter(p) !== '');
  const first = parts[0];
  if (!first) return null;
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return `${firstLetter(first)}${last ? firstLetter(last) : ''}`.toUpperCase();
}

/** Meta line under "Jouw profiel": "Lid sinds oktober 2026 · 47 workouts". */
export function profileMeta(input: { signedIn: boolean; memberSince: string | null; workoutCount: number | null }): string {
  const parts: string[] = [];
  if (input.memberSince) parts.push(`Lid sinds ${input.memberSince}`);
  if (input.workoutCount !== null && input.workoutCount >= 0) {
    parts.push(`${input.workoutCount.toLocaleString('nl-NL')} ${input.workoutCount === 1 ? 'workout' : 'workouts'}`);
  }
  if (parts.length === 0) return input.signedIn ? 'Ingelogd bij Supp City' : 'Niet ingelogd · trainen werkt ook zonder account';
  return parts.join(' · ');
}
