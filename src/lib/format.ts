const euro = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatPrice(cents: number | null): string | null {
  if (cents === null) return null;
  return `≈ ${euro.format(cents / 100)}`;
}

export const PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Me gustaría',
  2: 'Lo quiero bastante',
  3: 'Lo quiero mucho',
};

export function priorityStars(priority: 1 | 2 | 3): string {
  return '⭐'.repeat(priority);
}

/** Acepta solo http/https. Evita enlaces javascript: o de otros esquemas. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Convierte "35,5" o "35.5" en céntimos. Devuelve null si está vacío. */
export function eurosToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}
