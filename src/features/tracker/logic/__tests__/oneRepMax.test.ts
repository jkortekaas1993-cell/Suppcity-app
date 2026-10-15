import { epley1rm, round, setVolume } from '../oneRepMax';

describe('epley1rm', () => {
  it('applies w × (1 + reps/30)', () => {
    expect(epley1rm(100, 10)).toBeCloseTo(133.333, 2);
    expect(epley1rm(60, 5)).toBeCloseTo(70, 5);
  });
  it('returns the weight for a single rep', () => {
    expect(epley1rm(140, 1)).toBe(140);
  });
  it('returns null for invalid input', () => {
    expect(epley1rm(null, 5)).toBeNull();
    expect(epley1rm(100, 0)).toBeNull();
    expect(epley1rm(0, 5)).toBeNull();
    expect(epley1rm(Number.NaN, 5)).toBeNull();
  });
});

describe('setVolume / round', () => {
  it('multiplies kg × reps and ignores missing values', () => {
    expect(setVolume(62.5, 8)).toBe(500);
    expect(setVolume(null, 8)).toBe(0);
    expect(setVolume(50, null)).toBe(0);
  });
  it('rounds without float noise', () => {
    expect(round(0.1 + 0.2, 2)).toBe(0.3);
    expect(round(133.3333, 1)).toBe(133.3);
  });
});
