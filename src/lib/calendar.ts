import { shopTimeToDate } from '@shared/time';

interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  date: string;
  start: string;
  end: string;
  uid: string;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function icsContent(e: CalendarEvent): string {
  const start = shopTimeToDate(e.date, e.start);
  const end = shopTimeToDate(e.date, e.end);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Classe A Barbearia//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@classeabarbearia`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(e.description)}`,
    `LOCATION:${escapeIcs(e.location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Seu horário na Classe A',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(e: CalendarEvent): void {
  const blob = new Blob([icsContent(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'classe-a-agendamento.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const start = stamp(shopTimeToDate(e.date, e.start));
  const end = stamp(shopTimeToDate(e.date, e.end));
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${start}/${end}`, details: e.description, location: e.location, ctz: 'America/Sao_Paulo' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
