import { DISCLAIMER } from '../../copy';
import { intakesToCsv, supplementsToCsv, toCsv } from '../csv';
import { emptyForm, validateSupplementForm } from '../form';
import {
  diffReminders,
  FORBIDDEN_REMINDER_WORDS,
  IOS_PENDING_LIMIT,
  isNeutralCopy,
  parseReminderData,
  NEUTRAL_REMINDER_BODY,
  planReminders,
  reminderBody,
  REMINDER_BUDGET,
  toExpoWeekday,
} from '../reminderPlan';
import { maskFromDays, type ScheduleLike } from '../schedule';
import { applyIntakeDelta, daysLeftLabel, reorderSignals, stockView } from '../stock';

const EVERY_DAY = 0b1111111;

describe('stock', () => {
  it('computes days left from units and the user\'s own schedule', () => {
    expect(stockView({ units_left: 22, units_per_pack: 40 }, [{ days_mask: EVERY_DAY }])).toEqual({
      daysLeft: 22,
      fraction: 0.55,
      low: false,
      empty: false,
    });
    // Three times a week: 6 units last 14 days.
    expect(stockView({ units_left: 6, units_per_pack: 50 }, [{ days_mask: maskFromDays([0, 2, 4]) }]).daysLeft).toBe(14);
    // Twice a day.
    expect(stockView({ units_left: 13, units_per_pack: null }, [{ days_mask: EVERY_DAY }, { days_mask: EVERY_DAY }])).toMatchObject({
      daysLeft: 6,
      fraction: null,
      low: true,
    });
    expect(stockView({ units_left: null, units_per_pack: 30 }, [{ days_mask: EVERY_DAY }]).daysLeft).toBeNull();
    expect(stockView({ units_left: 10, units_per_pack: 30 }, []).daysLeft).toBeNull();
  });

  it('subtracts one unit per taken intake and gives it back on undo', () => {
    expect(applyIntakeDelta(5, false, true)).toBe(4);
    expect(applyIntakeDelta(4, true, false)).toBe(5);
    expect(applyIntakeDelta(0, false, true)).toBe(0);
    expect(applyIntakeDelta(5, true, true)).toBe(5);
    expect(applyIntakeDelta(null, false, true)).toBeNull();
  });

  it('labels days left', () => {
    expect(daysLeftLabel(6)).toBe('~6 dagen');
    expect(daysLeftLabel(1)).toBe('~1 dag');
    expect(daysLeftLabel(0)).toBe('op');
  });

  it('only tells the shop "almost out for variant X" (hard rule 1)', () => {
    const signals = reorderSignals([
      { name: 'Creatine', shopify_variant_gid: 'gid://shopify/ProductVariant/1', units_left: 6, units_per_pack: 100, schedules: [{ days_mask: EVERY_DAY }] },
      { name: 'Omega 3', shopify_variant_gid: 'gid://shopify/ProductVariant/2', units_left: 58, units_per_pack: 90, schedules: [{ days_mask: EVERY_DAY }] },
      { name: 'Eigen pot', shopify_variant_gid: null, units_left: 1, units_per_pack: 30, schedules: [{ days_mask: EVERY_DAY }] },
      { name: 'Whey', shopify_variant_gid: 'gid://shopify/ProductVariant/3', units_left: 2, units_per_pack: 30, schedules: [{ days_mask: EVERY_DAY }] },
    ]);
    expect(signals).toEqual([
      { variantGid: 'gid://shopify/ProductVariant/3', productTitle: 'Whey', daysLeft: 2 },
      { variantGid: 'gid://shopify/ProductVariant/1', productTitle: 'Creatine', daysLeft: 6 },
    ]);
    for (const s of signals) expect(Object.keys(s).sort()).toEqual(['daysLeft', 'productTitle', 'variantGid']);
  });
});

describe('reminder plan', () => {
  const supplements = [
    { id: 'cr', name: 'Creatine', dose_text: '5 g' },
    { id: 'om', name: 'Omega 3', dose_text: '2 caps' },
    { id: 'zz', name: 'Magnesium', dose_text: '' },
  ];

  it('converts weekdays to expo (1 = Sunday)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(toExpoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });

  it('uses one daily trigger for a time that is the same every day', () => {
    const schedules: ScheduleLike[] = [{ id: 's1', supplement_id: 'om', days_mask: EVERY_DAY, mode: 'fixed', time_local: '08:00' }];
    const plan = planReminders(schedules, supplements, undefined, { showNames: true });
    expect(plan.dropped).toBe(0);
    expect(plan.reminders).toEqual([
      {
        id: 'supp-d-0800',
        trigger: { kind: 'daily', hour: 8, minute: 0 },
        title: 'Supp City',
        body: 'Herinnering: Omega 3 (2 caps)',
        data: { kind: 'supplement-reminder', scheduleIds: ['s1'], time: '08:00' },
      },
    ]);
  });

  it('groups supplements at the same moment and repeats weekly per weekday', () => {
    const schedules: ScheduleLike[] = [
      { id: 's1', supplement_id: 'cr', days_mask: maskFromDays([0, 2]), mode: 'training', time_local: '17:30' },
      { id: 's2', supplement_id: 'zz', days_mask: maskFromDays([0]), mode: 'fixed', time_local: '17:30' },
    ];
    const plan = planReminders(schedules, supplements, undefined, { showNames: true });
    expect(plan.reminders.map((r) => [r.id, r.trigger, r.body])).toEqual([
      ['supp-w0-1730', { kind: 'weekly', weekday: 0, hour: 17, minute: 30 }, 'Herinnering: Creatine (5 g), Magnesium'],
      ['supp-w2-1730', { kind: 'weekly', weekday: 2, hour: 17, minute: 30 }, 'Herinnering: Creatine (5 g)'],
    ]);
    expect(plan.reminders[0]!.data.scheduleIds).toEqual(['s1', 's2']);
  });

  it('never exceeds the iOS limit of 64 pending notifications', () => {
    // 10 different times on 6 weekdays = 60 weekly + more → must be capped.
    const schedules: ScheduleLike[] = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      supplement_id: 'cr',
      days_mask: maskFromDays([0, 1, 2, 3, 4, 5]),
      mode: 'fixed' as const,
      time_local: `${String(6 + i).padStart(2, '0')}:00`,
    }));
    const plan = planReminders(schedules, supplements);
    expect(plan.reminders.length).toBe(REMINDER_BUDGET);
    expect(plan.dropped).toBe(72 - REMINDER_BUDGET);
    expect(REMINDER_BUDGET).toBeLessThan(IOS_PENDING_LIMIT);
    expect(new Set(plan.reminders.map((r) => r.id)).size).toBe(REMINDER_BUDGET);
    expect(planReminders(schedules, supplements, 500).reminders.length).toBe(IOS_PENDING_LIMIT);
  });

  it('skips schedules of deleted supplements and invalid times', () => {
    const plan = planReminders(
      [
        { id: 'x', supplement_id: 'gone', days_mask: EVERY_DAY, mode: 'fixed', time_local: '08:00' },
        { id: 'y', supplement_id: 'cr', days_mask: EVERY_DAY, mode: 'fixed', time_local: '8:00' },
      ],
      supplements,
    );
    expect(plan.reminders).toEqual([]);
  });

  it('re-plans by cancelling only our own notifications', () => {
    const { cancel } = diffReminders(['supp-d-0800', 'rest-timer', 'suppsnooze-1'], []);
    expect(cancel).toEqual(['supp-d-0800']);
  });

  it('parses notification data defensively', () => {
    expect(parseReminderData({ kind: 'supplement-reminder', scheduleIds: ['a'], time: '08:00' })).toEqual({
      kind: 'supplement-reminder',
      scheduleIds: ['a'],
      time: '08:00',
    });
    expect(parseReminderData({ kind: 'supplement-reminder', scheduleIds: ['a'], time: '08:00', date: '2026-10-16' })?.date).toBe('2026-10-16');
    expect(parseReminderData({ kind: 'other' })).toBeNull();
    expect(parseReminderData({ kind: 'supplement-reminder', scheduleIds: [1], time: '08:00' })).toBeNull();
    expect(parseReminderData(null)).toBeNull();
  });

  it('lock screen: no names or doses unless the user switched them on (review L8)', () => {
    const schedules: ScheduleLike[] = [{ id: 's1', supplement_id: 'cr', days_mask: EVERY_DAY, mode: 'fixed', time_local: '08:00' }];
    const [r] = planReminders(schedules, supplements).reminders;
    expect(r?.body).toBe(NEUTRAL_REMINDER_BODY);
    expect(NEUTRAL_REMINDER_BODY).toBe('Tijd voor je supplementen');
    expect(`${r?.title} ${r?.body}`).not.toMatch(/Creatine|5 g/);
    expect(planReminders(schedules, supplements, undefined, { showNames: false }).reminders[0]?.body).toBe(NEUTRAL_REMINDER_BODY);
    expect(isNeutralCopy(NEUTRAL_REMINDER_BODY)).toBe(true);
  });

  it('app-authored copy is neutral (hard rule 4)', () => {
    expect(isNeutralCopy(reminderBody([{ name: 'Creatine', dose_text: '5 g' }]))).toBe(true);
    expect(reminderBody([{ name: 'Creatine', dose_text: '5 g' }])).toBe('Herinnering: Creatine (5 g)');
    expect(DISCLAIMER).toBe('Jij bepaalt wat, hoeveel en wanneer. De app geeft geen doseringsadvies; volg het etiket.');
    expect(isNeutralCopy('Creatine voor meer kracht')).toBe(false);
    expect(FORBIDDEN_REMINDER_WORDS).toContain('herstel');
  });
});

describe('form', () => {
  it('requires name, days and time and suggests nothing itself', () => {
    const empty = emptyForm();
    expect(empty.doseText).toBe('');
    expect(empty.time).toBe('');
    expect(empty.fixedDaysMask).toBe(0);
    const res = validateSupplementForm(empty, { isNew: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(['days', 'name', 'time']);
  });

  it('builds repository input; a new pack starts full', () => {
    const res = validateSupplementForm(
      { ...emptyForm(maskFromDays([0, 2, 4])), name: ' Creatine ', doseText: '5 g', mode: 'training', time: '1730', unitsPerPack: '100' },
      { isNew: true },
    );
    expect(res).toEqual({
      ok: true,
      trainingDaysMask: 0b10101,
      input: {
        id: undefined,
        name: 'Creatine',
        dose_text: '5 g',
        shopify_variant_gid: null,
        units_per_pack: 100,
        units_left: 100,
        schedules: [{ mode: 'training', days_mask: 0b10101, time_local: '17:30' }],
      },
    });
  });

  it('rejects rest mode without rest days and bad counts', () => {
    const res = validateSupplementForm(
      { ...emptyForm(EVERY_DAY), name: 'ZMA', mode: 'rest', time: '22:00', unitsPerPack: '0', unitsLeft: '1,5' },
      { isNew: false },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(['days', 'unitsLeft', 'unitsPerPack']);
  });
});

describe('csv', () => {
  it('quotes and neutralises formula cells', () => {
    expect(toCsv(['a', 'b'], [['x, "y"', '=SUM(A1)'], [null, 3]])).toBe('a,b\r\n"x, ""y""",\'=SUM(A1)\r\n,3\r\n');
  });

  it('exports supplements and intakes with stable headers', () => {
    const s = supplementsToCsv([
      {
        supplement_id: 'id1',
        name: 'Creatine',
        dose_text: '5 g',
        units_per_pack: 100,
        units_left: 6,
        shopify_variant_gid: null,
        schedule_id: 'sc1',
        mode: 'training',
        days: 'trainingsdagen',
        time_local: '17:30',
        created_at: '2026-10-16T10:00:00.000Z',
      },
    ]);
    expect(s.split('\r\n')[0]).toBe(
      'supplement_id,name,dose_text,units_per_pack,units_left,shopify_variant_gid,schedule_id,mode,days,time_local,created_at',
    );
    expect(s.split('\r\n')[1]).toBe('id1,Creatine,5 g,100,6,,sc1,training,trainingsdagen,17:30,2026-10-16T10:00:00.000Z');
    const i = intakesToCsv([
      { intake_id: 'i1', supplement_id: 'id1', supplement_name: 'Creatine', scheduled_for: '2026-10-16T17:30', status: 'taken', taken_at: '2026-10-16T15:31:00.000Z', updated_at: '2026-10-16T15:31:00.000Z' },
    ]);
    expect(i.split('\r\n')[1]).toBe('i1,id1,Creatine,2026-10-16T17:30,taken,2026-10-16T15:31:00.000Z,2026-10-16T15:31:00.000Z');
  });
});
