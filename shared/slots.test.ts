import { describe, expect, it } from 'vitest';
import { buildAgendaCells, computeDayAvailability, endTime, generateSlots, lockSlices, periodOf } from './slots';
import { mergeRanges, shopTimeToDate, subtractRanges, toMinutes, weekdayOf } from './time';
import type { Barber, BarberDay } from './types';

const template: Barber['weeklyTemplate'] = {
  sun: [],
  mon: [],
  tue: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
  wed: [{ start: '09:00', end: '12:00' }],
  thu: [{ start: '09:00', end: '12:00' }],
  fri: [{ start: '09:00', end: '12:00' }],
  sat: [{ start: '08:00', end: '12:00' }],
};
const barber = { id: 'b1', weeklyTemplate: template, slotIntervalMin: 30, bufferMin: 0 };
// 2026-10-27 is a Tuesday, 2026-10-25 a Sunday.
const TUE = '2026-10-27';
const SUN = '2026-10-25';

const slots = (day: BarberDay | null, durationMin: number, opts: Partial<Parameters<typeof generateSlots>[1]> = {}, b = barber, busy: { start: string; end: string }[] = []) =>
  generateSlots(computeDayAvailability(b, TUE, day, busy), { durationMin, ...opts });

describe('time helpers', () => {
  it('merges and subtracts ranges', () => {
    expect(mergeRanges([{ start: 60, end: 120 }, { start: 100, end: 200 }, { start: 300, end: 360 }])).toEqual([
      { start: 60, end: 200 },
      { start: 300, end: 360 },
    ]);
    expect(subtractRanges([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 90, end: 120 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 90 },
    ]);
  });
  it('knows weekdays', () => {
    expect(weekdayOf(TUE)).toBe('tue');
    expect(weekdayOf(SUN)).toBe('sun');
  });
});

describe('generateSlots', () => {
  it('uses the weekly template', () => {
    const s = slots(null, 30);
    expect(s[0]).toBe('09:00');
    expect(s).toContain('11:30');
    expect(s).not.toContain('12:00');
    expect(s).toContain('13:00');
    expect(s.at(-1)).toBe('17:30');
    expect(s).toHaveLength(6 + 10);
  });

  it('returns nothing on a day without template', () => {
    expect(generateSlots(computeDayAvailability(barber, SUN, null, []), { durationMin: 30 })).toEqual([]);
  });

  it('honours a closed day override but keeps extra openings', () => {
    expect(slots({ status: 'closed', blocks: [], extraOpenings: [] }, 30)).toEqual([]);
    expect(slots({ status: 'closed', blocks: [], extraOpenings: [{ start: '19:00', end: '20:00' }] }, 30)).toEqual([
      '19:00',
      '19:30',
    ]);
  });

  it('adds extra openings on top of the template', () => {
    const s = generateSlots(
      computeDayAvailability(barber, SUN, { status: 'open', blocks: [], extraOpenings: [{ start: '10:00', end: '14:00' }] }, []),
      { durationMin: 60 },
    );
    expect(s).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00']);
  });

  it('subtracts blocks', () => {
    const s = slots({ status: 'open', blocks: [{ start: '10:00', end: '11:00', reason: 'Almoço' }], extraOpenings: [] }, 30);
    expect(s).not.toContain('10:00');
    expect(s).not.toContain('10:30');
    expect(s).toContain('09:30');
    expect(s).toContain('11:00');
  });

  it('subtracts busy appointments', () => {
    const s = slots(null, 30, {}, barber, [{ start: '09:30', end: '10:30' }]);
    expect(s.slice(0, 3)).toEqual(['09:00', '10:30', '11:00']);
  });

  it('only offers starts where the whole duration fits', () => {
    const s = slots(null, 60);
    expect(s).toContain('11:00');
    expect(s).not.toContain('11:30');
    expect(s.at(-1)).toBe('17:00');
    // A 60-minute service cannot straddle a 30-minute block.
    const blocked = slots({ status: 'open', blocks: [{ start: '10:00', end: '10:30' }], extraOpenings: [] }, 60);
    expect(blocked).not.toContain('09:30');
    expect(blocked).toContain('09:00');
  });

  it('applies the buffer after the service and after existing appointments', () => {
    const withBuffer = { ...barber, bufferMin: 15 };
    const s = slots(null, 30, {}, withBuffer, [{ start: '10:00', end: '10:30' }]);
    // 09:30 + 30 + 15 would cross the 10:00 appointment.
    expect(s).not.toContain('09:30');
    expect(s).toContain('09:00');
    // 10:30 is inside the previous appointment's buffer (until 10:45).
    expect(s).not.toContain('10:30');
    expect(s).toContain('11:00');
    // At the end of the range the buffer must also fit: 11:30 + 30 + 15 > 12:00.
    expect(s).not.toContain('11:30');
  });

  it('rejects a duration that does not fit anywhere', () => {
    expect(slots(null, 4 * 60)).toEqual(['13:00', '13:30', '14:00']);
    expect(slots(null, 6 * 60)).toEqual([]);
    expect(slots(null, 0)).toEqual([]);
  });

  it('respects the minimum advance on the same day only', () => {
    const now = { date: TUE, minutes: toMinutes('10:10') };
    const s = slots(null, 30, { now, minAdvanceMin: 60 });
    expect(s[0]).toBe('11:30');
    expect(slots(null, 30, { now: { date: '2026-10-26', minutes: 1000 }, minAdvanceMin: 60 })[0]).toBe('09:00');
    expect(slots(null, 30, { now: { date: '2026-10-28', minutes: 0 } })).toEqual([]);
  });

  it('keeps a regular grid after odd-length blocks', () => {
    const s = slots({ status: 'open', blocks: [{ start: '09:00', end: '09:20' }], extraOpenings: [] }, 30);
    expect(s[0]).toBe('09:30');
  });
});

describe('daylight saving (if Brazil brings it back)', () => {
  it('slots stay in wall-clock time and UTC instants stay ordered across the switch', () => {
    // 2018-11-04 was the last DST start in São Paulo: 00:00 jumped to 01:00.
    const day = '2018-11-04';
    const a = computeDayAvailability({ ...barber, weeklyTemplate: { ...template, sun: [{ start: '00:00', end: '03:00' }] } }, day, null, []);
    const s = generateSlots(a, { durationMin: 30 });
    expect(s[0]).toBe('00:00');
    const instants = s.map((t) => shopTimeToDate(day, t).getTime());
    for (let i = 1; i < instants.length; i++) expect(instants[i]!).toBeGreaterThanOrEqual(instants[i - 1]!);
    // Outside DST periods São Paulo is UTC-3.
    expect(shopTimeToDate('2026-10-27', '09:00').toISOString()).toBe('2026-10-27T12:00:00.000Z');
  });
});

describe('helpers', () => {
  it('computes end times, periods and lock slices', () => {
    expect(endTime('09:30', 45)).toBe('10:15');
    expect(periodOf('09:00')).toBe('manha');
    expect(periodOf('12:00')).toBe('tarde');
    expect(periodOf('18:30')).toBe('noite');
    expect(lockSlices('09:30', 45, 15)).toEqual(['0930', '0945', '1000']);
    expect(lockSlices('09:40', 30, 15)).toEqual(['0930', '0945', '1000']);
  });

  it('builds agenda cells with states', () => {
    const a = computeDayAvailability(barber, TUE, { status: 'open', blocks: [{ start: '13:00', end: '14:00', reason: 'Almoço' }], extraOpenings: [] }, [
      { start: '09:00', end: '10:00' },
    ]);
    const cells = buildAgendaCells(a, '08:00', '19:00');
    const at = (t: string) => cells.find((c) => c.start === t)?.state;
    expect(at('08:00')).toBe('off');
    expect(at('09:00')).toBe('busy');
    expect(at('10:00')).toBe('free');
    expect(at('13:30')).toBe('blocked');
    expect(at('12:00')).toBe('off');
  });
});
