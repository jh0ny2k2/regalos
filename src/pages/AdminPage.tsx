import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFamily } from '@/hooks/useFamily';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { AVATAR_EMOJI, AVATAR_KEYS, type AvatarKey, type Member } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { fromLocalInputValue, toLocalInputValue } from '@/lib/dates';
import { validateFamily } from '@/lib/validation';

export function AdminPage() {
  const { familyId = '' } = useParams();
  const { session } = useAuth();
  const { family, members, loading, error, reload } = useFamily(familyId);
  const me = members.find((m) => m.is_me);

  if (loading && !family) return <LoadingState rows={3} label="Cargando administración…" />;
  if (error || !family) {
    return <EmptyState icon="🔒" title="No puedes ver esta página" description={error ?? undefined} action={<Link to="/" className="btn-ghost">Inicio</Link>} />;
  }
  if (me && me.role !== 'ADMIN') {
    return (
      <EmptyState
        icon="🔒"
        title="Solo el administrador puede gestionar la familia."
        action={<Link to={`/familia/${familyId}`} className="btn-ghost">Volver a la familia</Link>}
      />
    );
  }

  return (
    <div className="space-y-10">
      <section className="animate-fade-up">
        <Link to={`/familia/${familyId}`} className="text-sm text-cream/50 underline-offset-4 hover:underline">
          ← Volver a la familia
        </Link>
        <h1 className="mt-3 text-4xl">⚙️ Administración</h1>
      </section>

      <SettingsSection familyId={familyId} initial={family} onSaved={reload} />
      <InviteSection familyId={familyId} />
      <MembersSection familyId={familyId} members={members} selfId={session?.user.id ?? ''} onChanged={reload} />

      <p className="text-xs text-cream/40">
        Por privacidad, la administración no muestra quién ha reservado o comprado cada regalo.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Configuración general
// -----------------------------------------------------------------------------
function SettingsSection({
  familyId,
  initial,
  onSaved,
}: {
  familyId: string;
  initial: { name: string; deadline_at: string; christmas_at: string };
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [deadline, setDeadline] = useState(toLocalInputValue(initial.deadline_at));
  const [christmas, setChristmas] = useState(toLocalInputValue(initial.christmas_at));
  const [errors, setErrors] = useState<{ name?: string; deadline?: string; christmas?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initial.name);
    setDeadline(toLocalInputValue(initial.deadline_at));
    setChristmas(toLocalInputValue(initial.christmas_at));
  }, [initial.name, initial.deadline_at, initial.christmas_at]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = fromLocalInputValue(deadline);
    const c = fromLocalInputValue(christmas);
    const { errors: found, valid } = validateFamily(name, d, c);
    setErrors(found);
    if (!valid || !d || !c) return;

    setBusy(true);
    try {
      await api.updateFamily(familyId, {
        name: name.trim(),
        deadline_at: d.toISOString(),
        christmas_at: c.toISOString(),
      });
      toast.show('Configuración guardada.', 'success');
      onSaved();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass p-6">
      <h2 className="text-2xl">Configuración</h2>
      <form onSubmit={save} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="adm-name" className="label">Nombre de la familia</label>
          <input id="adm-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          {errors.name && <p className="mt-1 text-sm text-red-300">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="adm-deadline" className="label">Fecha límite de cartas</label>
          <input id="adm-deadline" type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {errors.deadline && <p className="mt-1 text-sm text-red-300">{errors.deadline}</p>}
          <p className="mt-1 text-xs text-cream/50">No se puede cambiar si ya hay regalos reservados.</p>
        </div>
        <div>
          <label htmlFor="adm-christmas" className="label">Fecha de Navidad</label>
          <input id="adm-christmas" type="datetime-local" className="input" value={christmas} onChange={(e) => setChristmas(e.target.value)} />
          {errors.christmas && <p className="mt-1 text-sm text-red-300">{errors.christmas}</p>}
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Código de invitación
// -----------------------------------------------------------------------------
function InviteSection({ familyId }: { familyId: string }) {
  const toast = useToast();
  const code = useAsync<string>(() => api.getInviteCode(familyId), [familyId]);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const value = code.data ?? '';
  const joinUrl = value ? `${window.location.origin}/unirse?code=${encodeURIComponent(value)}` : '';

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.show('Código copiado al portapapeles.', 'success');
  };

  const share = async () => {
    const text = `Únete a nuestra familia en Carta de Navidad con el código ${value}`;
    if (navigator.share) {
      await navigator.share({ title: 'Carta de Navidad', text, url: joinUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${joinUrl}`);
      toast.show('Invitación copiada. Pégala donde quieras.', 'success');
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await api.regenerateInviteCode(familyId);
      toast.show('Nuevo código generado. El anterior ya no funciona.', 'success');
      code.reload();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo regenerar.', 'error');
    } finally {
      setRegenerating(false);
      setConfirmRegen(false);
    }
  };

  return (
    <section className="glass p-6">
      <h2 className="text-2xl">Invitar a la familia</h2>
      <p className="mt-1 text-sm text-cream/60">Comparte este código para que se unan. Puedes regenerarlo cuando quieras.</p>

      {code.loading ? (
        <div className="skeleton mt-5 h-14 rounded-xl" />
      ) : (
        <div className="mt-5 flex flex-col items-center gap-4">
          <p className="rounded-xl border border-gold/40 bg-black/30 px-5 py-3 font-mono text-xl tracking-[0.2em] text-gold select-all">
            {value}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-ghost" onClick={copy}>Copiar código</button>
            <button type="button" className="btn-ghost" onClick={share}>Compartir invitación</button>
            <button type="button" className="btn-danger" onClick={() => setConfirmRegen(true)} disabled={regenerating}>
              Generar nuevo código
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegen}
        title="¿Generar un código nuevo?"
        message="El código actual dejará de funcionar. Quienes ya están dentro no se ven afectados."
        confirmLabel="Generar"
        danger
        onConfirm={regenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// Miembros
// -----------------------------------------------------------------------------
function MembersSection({
  familyId,
  members,
  selfId,
  onChanged,
}: {
  familyId: string;
  members: Member[];
  selfId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [removing, setRemoving] = useState<Member | null>(null);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      toast.show(ok, 'success');
      onChanged();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo completar la acción.', 'error');
    }
  };

  return (
    <section className="glass p-6">
      <h2 className="text-2xl">Miembros</h2>
      <ul className="mt-5 divide-y divide-white/10">
        {members.map((m) => {
          const isSelf = m.user_id === selfId;
          return (
            <li key={m.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar avatarKey={m.avatar_key} name={m.display_name} size="sm" />
                <div>
                  <p className="font-medium">
                    {m.display_name} {isSelf && <span className="text-xs text-gold">(tú)</span>}
                  </p>
                  <p className="text-xs text-cream/50">{m.role === 'ADMIN' ? 'Administrador' : 'Miembro'}</p>
                </div>
              </div>

              {!isSelf && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`avatar-${m.user_id}`}>Avatar de {m.display_name}</label>
                  <select
                    id={`avatar-${m.user_id}`}
                    className="input !w-auto !py-1.5 text-sm"
                    value={m.avatar_key}
                    onChange={(e) =>
                      run(() => api.setMemberAvatar(familyId, m.user_id, e.target.value as AvatarKey), 'Avatar actualizado.')
                    }
                  >
                    {AVATAR_KEYS.map((k) => (
                      <option key={k} value={k} className="bg-pine-deep">
                        {AVATAR_EMOJI[k]} {k}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() =>
                      run(
                        () => api.updateMemberRole(familyId, m.user_id, m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'),
                        m.role === 'ADMIN' ? 'Rol cambiado a miembro.' : 'Ahora es administrador.',
                      )
                    }
                  >
                    {m.role === 'ADMIN' ? 'Quitar admin' : 'Hacer admin'}
                  </button>
                  <button type="button" className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => setRemoving(m)}>
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={removing !== null}
        title={`¿Eliminar a ${removing?.display_name ?? ''}?`}
        message="Se borrarán su carta y sus reservas. Los regalos que tenía reservados volverán a estar disponibles."
        confirmLabel="Eliminar"
        danger
        onConfirm={async () => {
          if (removing) {
            await run(() => api.removeMember(familyId, removing.user_id), 'Miembro eliminado.');
          }
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
