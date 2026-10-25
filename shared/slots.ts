import {
  type MinuteRange,
  type TimeRange,
  fromMinutes,
  mergeRanges,
  minutesToRange,
  rangeToMinutes,
  subtractRanges,
  weekdayOf,
} from './time';
import type { AvailabilityPublic, Barber, BarberDay, BlockRange } from './types';

export interface BusyInput {
  start: string;
  end: string;
}

/**
 * Builds the public, PII-free availability document for one barber on one day.
 * Template ranges apply unless the day is closed; extra openings always apply.
 */
export function computeDayAvailability(
  barber: Pick<Barber, 'id' | 'weeklyTemplate' | 'slotIntervalMin' | 'bufferMin'>,
  date: string,
  day: Pick<BarberDay, 'status' | 'blocks' | 'extraOpenings'> | null,
  busy: BusyInput[],
): AvailabilityPublic {
  const template = barber.weeklyTemplate[weekdayOf(date)] ?? [];
  const base = day?.status === 'closed' ? [] : template;
  const working = mergeRanges([...base, ...(day?.extraOpenings ?? [])].map(rangeToMinutes)).map(
    minutesToRange,
  );
  const blocked: BlockRange[] = (day?.blocks ?? []).map((b) => ({
    start: b.start,
    end: b.end,
    reason: b.reason ?? null,
  }));
  return {
    barberId: barber.id,
    date,
    workingRanges: working,
    blocked,
    busy: busy.map((b) => ({ start: b.start, end: b.end })),
    slotIntervalMin: barber.slotIntervalMin,
    bufferMin: barber.bufferMin,
  };
}

export interface SlotOptions {
  /** Total duration of the selected services in minutes. */
  durationMin: number;
  /** Shop-local "now"; slots on that date before now + minAdvanceMin are dropped. */
  now?: { date: string; minutes: number };
  minAdvanceMin?: number;
}

/**
 * Returns every start time (HH:mm) where `durationMin + bufferMin` fits without
 * crossing a block, an existing appointment (plus its buffer) or the end of a working range.
 */
export function generateSlots(availability: AvailabilityPublic, options: SlotOptions): string[] {
  const { durationMin, now, minAdvanceMin = 0 } = options;
  const step = Math.max(5, availability.slotIntervalMin);
  const buffer = Math.max(0, availability.bufferMin);
  if (durationMin <= 0) return [];

  const busy = availability.busy.map(rangeToMinutes).map((r) => ({ start: r.start, end: r.end + buffer }));
  const blocked = availability.blocked.map(rangeToMinutes);
  const free = subtractRanges(availability.workingRanges.map(rangeToMinutes), [...blocked, ...busy]);
  const working = mergeRanges(availability.workingRanges.map(rangeToMinutes));

  let earliest = -1;
  if (now) {
    if (now.date > availability.date) return [];
    if (now.date === availability.date) earliest = now.minutes + minAdvanceMin;
  }

  const needed = durationMin + buffer;
  const starts = new Set<number>();
  // Starts are aligned to the grid of each working range, not to the free gaps,
  // so the client sees a regular grid (09:00, 09:30…) even after odd-length blocks.
  for (const range of working) {
    for (let t = range.start; t + needed <= range.end; t += step) {
      if (t < earliest) continue;
      if (fits(free, { start: t, end: t + needed })) starts.add(t);
    }
  }
  return [...starts].sort((a, b) => a - b).map(fromMinutes);
}

function fits(free: MinuteRange[], wanted: MinuteRange): boolean {
  return free.some((r) => r.start <= wanted.start && r.end >= wanted.end);
}

/** Grid cells for the barber agenda view. */
export type CellState = 'free' | 'busy' | 'blocked' | 'off';

export interface AgendaCell {
  start: string;
  end: string;
  state: CellState;
  reason?: string | null;
}

export function buildAgendaCells(
  availability: AvailabilityPublic,
  dayStart = '08:00',
  dayEnd = '21:00',
): AgendaCell[] {
  const step = Math.max(5, availability.slotIntervalMin);
  const from = rangeToMinutes({ start: dayStart, end: dayEnd });
  const working = availability.workingRanges.map(rangeToMinutes);
  const minStart = Math.min(from.start, ...working.map((r) => r.start));
  const maxEnd = Math.max(from.end, ...working.map((r) => r.end));
  const cells: AgendaCell[] = [];
  for (let t = minStart; t + step <= maxEnd; t += step) {
    const cell = { start: t, end: t + step };
    const inWork = working.some((r) => r.start <= cell.start && r.end >= cell.end);
    const busy = availability.busy.map(rangeToMinutes).some((r) => r.start < cell.end && cell.start < r.end);
    const block = availability.blocked.find((b) => {
      const r = rangeToMinutes(b);
      return r.start < cell.end && cell.start < r.end;
    });
    let state: CellState = 'off';
    if (busy) state = 'busy';
    else if (block) state = 'blocked';
    else if (inWork) state = 'free';
    cells.push({ start: fromMinutes(cell.start), end: fromMinutes(cell.end), state, reason: block?.reason });
  }
  return cells;
}

/** Fixed-size lock keys for every interval an appointment occupies. */
export function lockSlices(start: string, durationMin: number, stepMin: number): string[] {
  const s = rangeToMinutes({ start, end: start }).start;
  const out: string[] = [];
  for (let t = s - (s % stepMin); t < s + durationMin; t += stepMin) out.push(fromMinutes(t).replace(':', ''));
  return out;
}

export function endTime(start: string, durationMin: number): string {
  return fromMinutes(rangeToMinutes({ start, end: start }).start + durationMin);
}

export type DayPeriod = 'manha' | 'tarde' | 'noite';

export function periodOf(hhmm: string): DayPeriod {
  const h = Number(hhmm.slice(0, 2));
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

export type { TimeRange };
