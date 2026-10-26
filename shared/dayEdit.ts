import { type MinuteRange, fromMinutes, rangeToMinutes, subtractRanges } from './time';
import type { BarberDay, BlockRange } from './types';
import type { TimeRange } from './time';

export const EMPTY_DAY: BarberDay = { status: 'open', blocks: [], extraOpenings: [] };

interface MinuteBlock extends MinuteRange {
  reason: string | null;
}

const toMin = (b: BlockRange): MinuteBlock => ({ ...rangeToMinutes(b), reason: b.reason ?? null });
const toRange = (b: MinuteBlock): BlockRange => ({
  start: fromMinutes(b.start),
  end: b.end === 1440 ? '24:00' : fromMinutes(b.end),
  reason: b.reason,
});

/** Sorts blocks and merges touching/overlapping ones that share a reason (keeps the doc under the 24-block rule). */
export function normalizeBlocks(blocks: BlockRange[]): BlockRange[] {
  const sorted = blocks.map(toMin).filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
  const out: MinuteBlock[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && b.start <= last.end && last.reason === b.reason) last.end = Math.max(last.end, b.end);
    else if (last && b.start < last.end) {
      // Overlap with a different reason: the later block wins on the overlapping part.
      const tail = last.end > b.end ? { start: b.end, end: last.end, reason: last.reason } : null;
      last.end = b.start;
      if (last.end <= last.start) out.pop();
      out.push({ ...b });
      if (tail) out.push(tail);
    } else out.push({ ...b });
  }
  return out.map(toRange);
}

/** Removes `ranges` from every block, splitting blocks when needed. */
function cut(blocks: BlockRange[], ranges: TimeRange[]): BlockRange[] {
  const cuts = ranges.map(rangeToMinutes);
  const out: BlockRange[] = [];
  for (const b of blocks) {
    for (const piece of subtractRanges([rangeToMinutes(b)], cuts)) out.push(toRange({ ...piece, reason: b.reason ?? null }));
  }
  return out;
}

export function blockRanges(day: BarberDay | null, ranges: TimeRange[], reason: string | null): BarberDay {
  const base = day ?? EMPTY_DAY;
  const kept = cut(base.blocks, ranges);
  return { ...base, blocks: normalizeBlocks([...kept, ...ranges.map((r) => ({ ...r, reason }))]) };
}

export function releaseRanges(day: BarberDay | null, ranges: TimeRange[]): BarberDay {
  const base = day ?? EMPTY_DAY;
  return { ...base, blocks: normalizeBlocks(cut(base.blocks, ranges)) };
}

export function blockWholeDay(day: BarberDay | null, reason: string | null): BarberDay {
  return { ...(day ?? EMPTY_DAY), blocks: [{ start: '00:00', end: '24:00', reason }] };
}

export function releaseWholeDay(day: BarberDay | null): BarberDay {
  return { ...(day ?? EMPTY_DAY), status: 'open', blocks: [] };
}

export function addExtraOpening(day: BarberDay | null, range: TimeRange): BarberDay {
  const base = day ?? EMPTY_DAY;
  return { ...base, extraOpenings: [...base.extraOpenings, range].slice(-6), blocks: normalizeBlocks(cut(base.blocks, [range])) };
}

/** Consecutive cell starts → compact ranges, e.g. 09:00,09:30,10:00 (step 30) → 09:00–10:30. */
export function cellsToRanges(starts: string[], stepMin: number): TimeRange[] {
  const mins = [...new Set(starts)].map((s) => rangeToMinutes({ start: s, end: s }).start).sort((a, b) => a - b);
  const out: MinuteRange[] = [];
  for (const m of mins) {
    const last = out[out.length - 1];
    if (last && last.end === m) last.end = m + stepMin;
    else out.push({ start: m, end: m + stepMin });
  }
  return out.map((r) => ({ start: fromMinutes(r.start), end: r.end === 1440 ? '24:00' : fromMinutes(r.end) }));
}
