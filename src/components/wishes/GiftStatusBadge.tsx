import type { Availability } from '@/types';

interface Props {
  availability: Availability;
  /** Si es true, la reserva es mía y se muestra como tal. */
  isMine?: boolean;
}

/**
 * Nunca muestra quién compró el regalo. Para terceros solo indica que está reservado.
 */
export function GiftStatusBadge({ availability, isMine = false }: Props) {
  if (availability === 'AVAILABLE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">
        <span aria-hidden="true">●</span> Disponible
      </span>
    );
  }

  if (isMine) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-gold">
        <span aria-hidden="true">🎁</span> Tuyo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-christmas/20 px-2.5 py-1 text-xs font-medium text-red-200">
      <span aria-hidden="true">🎁</span> Ya reservado
    </span>
  );
}
