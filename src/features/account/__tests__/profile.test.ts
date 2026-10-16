import { initialsFor, profileMeta } from '../profile';

describe('initialsFor', () => {
  it('takes first and last initial', () => {
    expect(initialsFor('Jesse Roelofsen')).toBe('JR');
    expect(initialsFor('  jan van der berg ')).toBe('JB');
    expect(initialsFor('Émile')).toBe('É');
  });
  it('returns null without a name', () => {
    expect(initialsFor(null)).toBeNull();
    expect(initialsFor('  ')).toBeNull();
    expect(initialsFor('123')).toBeNull();
  });
});

describe('profileMeta', () => {
  it('joins member-since and workout count', () => {
    expect(profileMeta({ signedIn: true, memberSince: 'oktober 2026', workoutCount: 47 })).toBe('Lid sinds oktober 2026 · 47 workouts');
    expect(profileMeta({ signedIn: false, memberSince: null, workoutCount: 1 })).toBe('1 workout');
  });
  it('falls back to the sign-in state', () => {
    expect(profileMeta({ signedIn: true, memberSince: null, workoutCount: null })).toBe('Ingelogd bij Supp City');
    expect(profileMeta({ signedIn: false, memberSince: null, workoutCount: null })).toMatch(/Niet ingelogd/);
  });
});
