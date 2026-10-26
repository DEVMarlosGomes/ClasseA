import { Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AgendaCell } from '@shared/slots';
import type { Appointment } from '@shared/types';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/motion';
import { dayChipLabel, todayKey } from '@/lib/dates';

export interface DayColumn {
  date: string;
  cells: (AgendaCell & { appt?: Appointment })[];
}

export type SelectionMode = 'block' | 'release';

interface Selection {
  date: string;
  from: number;
  to: number;
  mode: SelectionMode;
}

interface AgendaGridProps {
  columns: DayColumn[];
  onApply: (date: string, cells: DayColumn['cells'], mode: SelectionMode) => void;
  onOpenAppointment: (a: Appointment) => void;
  compact?: boolean;
}

const LONG_PRESS_MS = 320;

/**
 * Tap a free slot to block it, tap a blocked slot to free it. Press-and-drag (touch) or click-and-drag
 * (mouse) selects a run of slots in one day. Busy slots open the appointment.
 */
export function AgendaGrid({ columns, onApply, onOpenAppointment, compact }: AgendaGridProps) {
  const [sel, setSel] = useState<Selection | null>(null);
  const selRef = useRef<Selection | null>(null);
  const press = useRef<{ timer: number; x: number; y: number; date: string; idx: number; pointer: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  selRef.current = sel;

  // While dragging on touch, stop the page from scrolling.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (selRef.current) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const modeFor = (cell: AgendaCell): SelectionMode | null =>
    cell.state === 'free' || cell.state === 'busy' ? 'block' : cell.state === 'blocked' ? 'release' : null;

  const begin = (date: string, idx: number) => {
    const col = columns.find((c) => c.date === date);
    const cell = col?.cells[idx];
    if (!cell) return;
    const mode = modeFor(cell);
    if (!mode) return;
    haptic(12);
    setSel({ date, from: idx, to: idx, mode });
  };

  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el) return null;
    return { date: el.dataset.date!, idx: Number(el.dataset.idx) };
  };

  const finish = () => {
    const s = selRef.current;
    setSel(null);
    if (!s) return;
    const col = columns.find((c) => c.date === s.date);
    if (!col) return;
    const [a, b] = s.from <= s.to ? [s.from, s.to] : [s.to, s.from];
    onApply(s.date, col.cells.slice(a, b + 1), s.mode);
  };

  const inSel = (date: string, idx: number) => {
    if (!sel || sel.date !== date) return false;
    const [a, b] = sel.from <= sel.to ? [sel.from, sel.to] : [sel.to, sel.from];
    return idx >= a && idx <= b;
  };

  const rows = columns[0]?.cells.length ?? 0;
  const cellH = compact ? 26 : 34;

  return (
    <div
      ref={gridRef}
      className="select-none"
      onPointerMove={(e) => {
        const p = press.current;
        if (p && !selRef.current && (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8)) {
          // Moved before the long-press fired: the user is scrolling.
          clearTimeout(p.timer);
          press.current = null;
          return;
        }
        if (!selRef.current) return;
        const c = cellAt(e.clientX, e.clientY);
        if (c && c.date === selRef.current.date && c.idx !== selRef.current.to) setSel({ ...selRef.current, to: c.idx });
      }}
      onPointerUp={() => {
        const p = press.current;
        if (p) {
          clearTimeout(p.timer);
          press.current = null;
          if (!selRef.current) {
            // A plain tap toggles one slot (or opens the appointment).
            const col = columns.find((c) => c.date === p.date);
            const cell = col?.cells[p.idx];
            if (cell?.appt && cell.state === 'busy') return onOpenAppointment(cell.appt);
            const mode = cell && modeFor(cell);
            if (cell && mode) onApply(p.date, [cell], mode);
            return;
          }
        }
        finish();
      }}
      onPointerCancel={() => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
        setSel(null);
      }}
    >
      <div className={cn('grid gap-x-1.5', columns.length > 1 ? 'grid-cols-[44px_repeat(7,minmax(0,1fr))]' : 'grid-cols-[44px_minmax(0,1fr)]')}>
        <div />
        {columns.length > 1 &&
          columns.map((c) => {
            const l = dayChipLabel(c.date, todayKey());
            return (
              <div key={c.date} className={cn('pb-2 text-center', c.date === todayKey() && 'text-gold-400')}>
                <p className="font-label text-[11px] text-text-400">{l.top}</p>
                <p className="tabular text-[16px] font-bold">{l.bottom}</p>
              </div>
            );
          })}
        {Array.from({ length: rows }, (_, r) => (
          <div key={`row${r}`} className="contents">
            <div className="tabular pr-1 text-right text-[11px] leading-none text-text-400" style={{ height: cellH }}>
              {columns[0]!.cells[r]!.start.endsWith(':00') ? columns[0]!.cells[r]!.start : ''}
            </div>
            {columns.map((col) => {
              const cell = col.cells[r]!;
              const selected = inSel(col.date, r);
              const prev = col.cells[r - 1];
              const continuesAppt = cell.appt && prev?.appt?.id === cell.appt.id;
              return (
                <div
                  key={col.date + cell.start}
                  role="button"
                  tabIndex={cell.state === 'off' ? -1 : 0}
                  aria-label={`${cell.start}, ${cell.state === 'free' ? 'livre' : cell.state === 'busy' ? `ocupado${cell.appt ? ` por ${cell.appt.clientName}` : ''}` : cell.state === 'blocked' ? `bloqueado${cell.reason ? `: ${cell.reason}` : ''}` : 'fora do expediente'}`}
                  data-cell
                  data-date={col.date}
                  data-idx={r}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (cell.appt && cell.state === 'busy') return onOpenAppointment(cell.appt);
                    const mode = modeFor(cell);
                    if (mode) onApply(col.date, [cell], mode);
                  }}
                  onPointerDown={(e) => {
                    if (cell.state === 'off') return;
                    if (e.pointerType === 'mouse' && cell.state !== 'busy') {
                      // Mouse: selection starts right away; a click is a one-slot selection.
                      e.preventDefault();
                      begin(col.date, r);
                      return;
                    }
                    const timer = cell.state === 'busy' ? 0 : window.setTimeout(() => begin(col.date, r), LONG_PRESS_MS);
                    press.current = { timer, x: e.clientX, y: e.clientY, date: col.date, idx: r, pointer: e.pointerType };
                  }}
                  className={cn(
                    'relative mb-1 flex items-center overflow-hidden rounded-[8px] border px-2 text-[12px] transition-colors duration-100',
                    cell.state === 'free' && 'cursor-pointer border-ink-600/80 bg-white/[0.035] hover:border-gold-600/70',
                    cell.state === 'busy' && 'cursor-pointer border-transparent bg-gold-500 text-ink-950',
                    cell.state === 'blocked' && 'hatch cursor-pointer border-ink-600 text-text-400',
                    cell.state === 'off' && 'border-transparent bg-transparent',
                    selected && (sel?.mode === 'block' ? '!border-gold-400 !bg-gold-500/30' : '!border-text-100/60 !bg-white/10'),
                  )}
                  style={{ height: cellH - 4 }}
                >
                  {cell.state === 'busy' && cell.appt && !continuesAppt && (
                    <span className="truncate font-bold">{columns.length > 1 ? cell.appt.clientName.split(' ')[0] : `${cell.appt.start} · ${cell.appt.clientName}`}</span>
                  )}
                  {cell.state === 'blocked' && columns.length === 1 && (
                    <span className="flex items-center gap-1 truncate">
                      <Lock className="size-3" strokeWidth={1.75} aria-hidden="true" />
                      {cell.reason || 'Bloqueado'}
                    </span>
                  )}
                  {cell.state === 'free' && columns.length === 1 && <span className="tabular text-text-400/70">{cell.start}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
