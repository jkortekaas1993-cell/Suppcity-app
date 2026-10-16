import {
  addDays,
  countDays,
  daysFromMask,
  effectiveMask,
  inferTrainingDays,
  intakesPerWeek,
  isDueOn,
  maskFromDays,
  normaliseTime,
  occurrencesOn,
  scheduleLabel,
  weekdayOf,
  weekOf,
  type ScheduleLike,
} from '../schedule';

const MON_WED_FRI = maskFromDays([0, 2, 4]);

describe('weekday masks', () => {
  it('round-trips days and counts them', () => {
    expect(MON_WED_FRI).toBe(0b10101);
    expect(daysFromMask(MON_WED_FRI)).toEqual([0, 2, 4]);
    expect(countDays(0b1111111)).toBe(7);
    expect(maskFromDays([7, -1, 6])).toBe(0b1000000);
  });

  it('derives training and rest days from the user\'s training days', () => {
    expect(effectiveMask('fixed', 0b11, MON_WED_FRI)).toBe(0b11);
    expect(effectiveMask('training', 0, MON_WED_FRI)).toBe(MON_WED_FRI);
    expect(effectiveMask('rest', 0, MON_WED_FRI)).toBe(0b1101010);
    expect(effectiveMask('rest', 0, 0b1111111)).toBe(0);
  });
});

describe('dates', () => {
  it('uses Monday = 0', () => {
    expect(weekdayOf('2026-10-12')).toBe(0); // Monday
    expect(weekdayOf('2026-10-16')).toBe(4); // Friday
    expect(weekdayOf('2026-10-18')).toBe(6); // Sunday
  });

  it('builds the Monday-first week, also across month and DST boundaries', () => {
    expect(weekOf('2026-10-16')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(weekOf('2026-11-01')[0]).toBe('2026-10-26');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('normalises times the user typed', () => {
    expect(normaliseTime('8:00')).toBe('08:00');
    expect(normaliseTime('0730')).toBe('07:30');
    expect(normaliseTime('17.30')).toBe('17:30');
    expect(normaliseTime('24:00')).toBeNull();
    expect(normaliseTime('8')).toBeNull();
    expect(normaliseTime('')).toBeNull();
  });
});

describe('due moments', () => {
  const schedules: ScheduleLike[] = [
    { id: 'a', supplement_id: 'creatine', days_mask: MON_WED_FRI, mode: 'training', time_local: '17:30' },
    { id: 'b', supplement_id: 'omega', days_mask: 0b1111111, mode: 'fixed', time_local: '08:00' },
    { id: 'c', supplement_id: 'zma', days_mask: 0b1101010, mode: 'rest', time_local: '22:00' },
  ];

  it('lists today\'s moments sorted by time', () => {
    const fri = occurrencesOn(schedules, '2026-10-16');
    expect(fri.map((o) => o.scheduledFor)).toEqual(['2026-10-16T08:00', '2026-10-16T17:30']);
    const sat = occurrencesOn(schedules, '2026-10-17');
    expect(sat.map((o) => o.supplementId)).toEqual(['omega', 'zma']);
  });

  it('a logged workout makes that date a training day', () => {
    expect(isDueOn(schedules[0]!, '2026-10-17', { workedOut: true })).toBe(true);
    expect(isDueOn(schedules[2]!, '2026-10-17', { workedOut: true })).toBe(false);
    expect(isDueOn(schedules[1]!, '2026-10-17', { workedOut: true })).toBe(true);
  });

  it('counts planned intakes per week', () => {
    expect(intakesPerWeek(schedules)).toBe(3 + 7 + 4);
  });

  it('labels schedules in Dutch', () => {
    expect(scheduleLabel({ days_mask: MON_WED_FRI, mode: 'fixed' })).toBe('ma, wo, vr');
    expect(scheduleLabel({ days_mask: 0b1111111, mode: 'fixed' })).toBe('elke dag');
    expect(scheduleLabel({ days_mask: MON_WED_FRI, mode: 'training' })).toBe('trainingsdagen');
  });
});

describe('inferTrainingDays', () => {
  it('keeps weekdays trained at least twice in the last four weeks', () => {
    const today = new Date(2026, 9, 16, 12, 0); // Fri 16 Oct, local
    const at = (d: number) => new Date(2026, 9, d, 18, 0).toISOString();
    const starts = [at(5), at(12), at(7), at(14), at(9), at(1) /* Thu once */, new Date(2026, 7, 3, 18).toISOString() /* too old */];
    expect(daysFromMask(inferTrainingDays(starts, today))).toEqual([0, 2]);
    expect(daysFromMask(inferTrainingDays(starts, today, { minHits: 1 }))).toEqual([0, 2, 3, 4]);
  });
});
