import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined: (familyId: string) => void;
}

const CODE_PATTERN = /^NAVIDAD-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** Normaliza lo que escribe el usuario: mayúsculas, espacios fuera, guiones de sobra. */
function normalizeCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = compact.startsWith('NAVIDAD') ? compact.slice(7) : compact;
  if (body.length !== 8) return raw.trim().toUpperCase();
  return `NAVIDAD-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function JoinFamilyModal({ open, onClose, onJoined }: Props) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCode('');
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const normalized = normalizeCode(code);
    if (!CODE_PATTERN.test(normalized)) {
      setError('El código tiene el formato NAVIDAD-XXXX-XXXX.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const familyId = await api.joinFamily(normalized);
      toast.show('¡Te has unido a la familia!', 'success');
      onJoined(familyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo unir a la familia.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Unirme a una familia"
      size="sm"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="join-family-form" className="btn-primary" disabled={busy || !code.trim()}>
            {busy ? 'Uniéndome…' : 'Unirme'}
          </button>
        </>
      }
    >
      <form id="join-family-form" onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-cream/70">Pide el código de invitación a tu administrador familiar.</p>
        <div>
          <label htmlFor="invite-code" className="label">Código de invitación</label>
          <input
            id="invite-code"
            className="input text-center font-mono tracking-widest uppercase"
            placeholder="NAVIDAD-XXXX-XXXX"
            value={code}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
      </form>
    </Modal>
  );
}
