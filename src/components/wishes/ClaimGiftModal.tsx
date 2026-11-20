import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Confetti } from '@/components/ui/Confetti';

interface Props {
  open: boolean;
  wishName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

/** Confirmación de reserva. El resto de la familia solo verá que está reservado. */
export function ClaimGiftModal({ open, wishName, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setDone(true);
      window.setTimeout(() => {
        setDone(false);
        onClose();
      }, 1400);
    } catch {
      // El llamante ya muestra el error; el modal sigue abierto para reintentar o cancelar
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy || done ? () => {} : onClose}
      title={done ? '¡Hecho!' : '¿Quieres encargarte de este regalo?'}
      size="sm"
      footer={
        !done && (
          <>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="btn-gold" onClick={handleConfirm} disabled={busy}>
              {busy ? 'Reservando…' : 'Sí, me encargo'}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center animate-pop-in">
          <span className="text-6xl" aria-hidden="true">🎁</span>
          <p className="text-cream/80">Te lo has apuntado. ¡Qué gran regalo!</p>
          <Confetti pieces={40} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-cream/80">
            <span className="font-medium text-cream">{wishName}</span>
          </p>
          <p className="rounded-xl bg-black/20 px-4 py-3 text-sm text-cream/70">
            El resto de la familia verá que ya está reservado, pero nadie sabrá que has sido tú.
          </p>
        </div>
      )}
    </Modal>
  );
}
