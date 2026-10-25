import { addDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const SHOP_TZ = 'America/Sao_Paulo';

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface MinuteRange {
  start: number;
  end: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isHHmm(value: string): boolean {
  return HHMM.test(value);
}

export function toMinutes(hhmm: string): number {
  const match = HHMM.exec(hhmm);
  if (!match) throw new Error(`Invalid time: ${hhmm}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 24:00 is allowed as an end-of-day boundary. */
export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function rangeToMinutes(range: TimeRange): MinuteRange {
  return { start: toMinutes(range.start), end: range.end === '24:00' ? 1440 : toMinutes(range.end) };
}

export function minutesToRange(range: MinuteRange): TimeRange {
  return { start: fromMinutes(range.start), end: fromMinutes(range.end) };
}

/** Sorts and merges overlapping or touching ranges. */
export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const out: MinuteRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** Removes every `cut` range from `base`. Both inputs may be unsorted. */
export function subtractRanges(base: MinuteRange[], cuts: MinuteRange[]): MinuteRange[] {
  let result = mergeRanges(base);
  for (const cut of mergeRanges(cuts)) {
    const next: MinuteRange[] = [];
    for (const r of result) {
      if (cut.end <= r.start || cut.start >= r.end) {
        next.push(r);
        continue;
      }
      if (cut.start > r.start) next.push({ start: r.start, end: cut.start });
      if (cut.end < r.end) next.push({ start: cut.end, end: r.end });
    }
    result = next;
  }
  return result;
}

export function overlaps(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Today's date (yyyy-MM-dd) and minutes since midnight in the shop time zone. */
export function shopNow(now: Date = new Date()): { date: string; minutes: number } {
  const date = formatInTimeZone(now, SHOP_TZ, 'yyyy-MM-dd');
  const hhmm = formatInTimeZone(now, SHOP_TZ, 'HH:mm');
  return { date, minutes: toMinutes(hhmm) };
}

/** Converts a shop-local wall time into the UTC instant. */
export function shopTimeToDate(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, SHOP_TZ);
}

export function addDaysToDateKey(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export const WEEKDAY_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function weekdayOf(date: string): WeekdayKey {
  return WEEKDAY_KEYS[parseISO(date).getDay()]!;
}

export function cycleKey(date: string): string {
  return date.slice(0, 7);
}
