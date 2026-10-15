import {
  formatCountdown,
  formatDuration,
  formatElapsed,
  formatKg,
  formatNumberNl,
  parseDecimalInput,
} from '../format';

describe('format', () => {
  it('formats Dutch numbers', () => {
    expect(formatNumberNl(1234.5)).toBe('1.234,5');
    expect(formatNumberNl(62.5)).toBe('62,5');
    expect(formatNumberNl(100)).toBe('100');
    expect(formatNumberNl(1.25, 2)).toBe('1,25');
    expect(formatNumberNl(12345678)).toBe('12.345.678');
    expect(formatKg(null)).toBe('–');
    expect(formatKg(82.5)).toBe('82,5 kg');
  });
  it('formats elapsed and countdown', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(3_725_000)).toBe('1:02:05');
    expect(formatCountdown(89_100)).toBe('1:30');
    expect(formatCountdown(0)).toBe('0:00');
  });
  it('formats durations', () => {
    expect(formatDuration(600_000)).toBe('10 min');
    expect(formatDuration(4_500_000)).toBe('1 u 15 min');
    expect(formatDuration(7_200_000)).toBe('2 u');
  });
  it('parses decimal input with comma or dot', () => {
    expect(parseDecimalInput('62,5')).toBe(62.5);
    expect(parseDecimalInput(' 80 ')).toBe(80);
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('-5')).toBeNull();
  });
});
