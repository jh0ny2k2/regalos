import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { fromLocalInputValue } from '@/lib/dates';
import { validateFamily } from '@/lib/validation';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (familyId: string) => void;
}

/** Fecha límite por defecto: 15 de diciembre del año en curso a las 23:59. */
function defaultDeadline(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() >= 11 ? y + 1 : y;
  return `${m}-12-15T23:59`;
}

function defaultChristmas(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() >= 11 ? y + 1 : y;
  return `${m}-12-25T00:00`;
}

export function CreateFamilyModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [christmas, setChristmas] = useState(defaultChristmas);
  const [errors, setErrors] = useState<{ name?: string; deadline?: string; christmas?: string }>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDeadline(defaultDeadline());
      setChristmas(defaultChristmas());
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const d = fromLocalInputValue(deadline);
    const c = fromLocalInputValue(christmas);
    const { errors: found, valid } = validateFamily(name, d, c);
    setErrors(found);
    if (!valid || !d || !c) return;

    setBusy(true);
    setSubmitError(null);
    try {
      const id = await api.createFamily(name.trim(), d, c);
      toast.show(`Familia «${name.trim()}» creada. Comparte el código de invitación.`, 'success');
      onCreated(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo crear la familia.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Crear familia"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="create-family-form" className="btn-primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear familia'}
          </button>
        </>
      }
    >
      <form id="create-family-form" onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="fam-name" className="label">Nombre de la familia</label>
          <input
            id="fam-name"
            className="input"
            value={name}
            maxLength={80}
            autoFocus
            placeholder="Familia Pérez"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="mt-1 text-sm text-red-300">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="fam-deadline" className="label">Fecha límite para escribir cartas</label>
          <input
            id="fam-deadline"
            type="datetime-local"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            aria-invalid={Boolean(errors.deadline)}
          />
          {errors.deadline && <p className="mt-1 text-sm text-red-300">{errors.deadline}</p>}
        </div>
        <div>
          <label htmlFor="fam-christmas" className="label">Fecha de Navidad / entrega</label>
          <input
            id="fam-christmas"
            type="datetime-local"
            className="input"
            value={christmas}
            onChange={(e) => setChristmas(e.target.value)}
            aria-invalid={Boolean(errors.christmas)}
          />
          {errors.christmas && <p className="mt-1 text-sm text-red-300">{errors.christmas}</p>}
        </div>
        {submitError && (
          <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{submitError}</p>
        )}
      </form>
    </Modal>
  );
}
