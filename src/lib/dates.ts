import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { SHOP_TZ, addDaysToDateKey, shopNow, shopTimeToDate } from '@shared/time';

export { SHOP_TZ, addDaysToDateKey, shopNow, shopTimeToDate };

/** Formats a yyyy-MM-dd key without ever touching the device time zone. */
function fmtKey(date: string, pattern: string): string {
  return formatInTimeZone(shopTimeToDate(date, '12:00'), SHOP_TZ, pattern, { locale: ptBR });
}

export function todayKey(): string {
  return shopNow().date;
}

export function relativeDayLabel(date: string, today = todayKey()): string {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(today));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return capFirst(fmtKey(date, 'EEE dd').replace('.', ''));
}

/** DayStrip chip: top line weekday / "Hoje", bottom line day number. */
export function dayChipLabel(date: string, today = todayKey()): { top: string; bottom: string } {
  const diff = differenceInCalendarDays(parseISO(date), parseISO(today));
  const top = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : fmtKey(date, 'EEE').replace('.', '');
  return { top, bottom: fmtKey(date, 'dd') };
}

export function capFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Sábado, 25 de outubro" */
export function longDate(date: string): string {
  return capFirst(fmtKey(date, "EEEE, d 'de' MMMM"));
}

/** "25/10/2026" */
export function shortDate(date: string): string {
  return fmtKey(date, 'dd/MM/yyyy');
}

/** "25 out" */
export function compactDate(date: string): string {
  return fmtKey(date, 'd MMM').replace('.', '');
}

export function monthTitle(date: string): string {
  return capFirst(fmtKey(date, "MMMM 'de' yyyy"));
}

export function formatInstant(d: Date, pattern = "dd/MM/yyyy 'às' HH:mm"): string {
  return formatInTimeZone(d, SHOP_TZ, pattern, { locale: ptBR });
}

export function instantToDateKey(d: Date): string {
  return formatInTimeZone(d, SHOP_TZ, 'yyyy-MM-dd');
}

export function nextDays(count: number, from = todayKey()): string[] {
  return Array.from({ length: count }, (_, i) => addDaysToDateKey(from, i));
}

export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function waLink(e164OrDigits: string, text?: string): string {
  const digits = e164OrDigits.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
