import { formatDuration, formatKg, formatNumberNl, formatSigned, formatVolume } from '../format';

describe('nl-NL formatting', () => {
  it('groups thousands with a dot and uses a decimal comma', () => {
    expect(formatNumberNl(2775)).toBe('2.775');
    expect(formatNumberNl(1234567.891, 2)).toBe('1.234.567,89');
    expect(formatNumberNl(108.4)).toBe('108');
    expect(formatKg(102.5)).toBe('102,5');
    expect(formatKg(100)).toBe('100');
    expect(formatNumberNl(-3.26, 1)).toBe('-3,3');
    expect(formatNumberNl(Number.NaN)).toBe('–');
  });
  it('signs deltas', () => {
    expect(formatSigned(14)).toBe('+14');
    expect(formatSigned(-2.5, 1)).toBe('-2,5');
    expect(formatSigned(0.2)).toBe('0');
  });
  it('switches volume to tonnes from 10.000 kg', () => {
    expect(formatVolume(2775)).toEqual({ value: '2.775', unit: 'kg' });
    expect(formatVolume(18400)).toEqual({ value: '18,4', unit: 'ton' });
  });
  it('formats durations', () => {
    expect(formatDuration(45.4)).toEqual({ value: '45', unit: 'min' });
    expect(formatDuration(65)).toEqual({ value: '1:05', unit: 'u' });
    expect(formatDuration(-5)).toEqual({ value: '0', unit: 'min' });
  });
});
