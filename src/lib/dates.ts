/** Utilidades de fecha. Todo se muestra en la zona horaria del navegador. */

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Valor para <input type="datetime-local"> a partir de un ISO. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convierte el valor de datetime-local a Date, o null si está vacío o es inválido. */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function timeLeft(targetIso: string, now: number = Date.now()): TimeLeft {
  const total = Math.max(0, new Date(targetIso).getTime() - now);
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / 60_000) % 60;
  const hours = Math.floor(total / 3_600_000) % 24;
  const days = Math.floor(total / 86_400_000);
  return { total, days, hours, minutes, seconds };
}

export function isPast(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}

/** Días completos hasta la fecha (redondeo hacia arriba para no decir "0 días" antes de tiempo). */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const ms = new Date(iso).getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
