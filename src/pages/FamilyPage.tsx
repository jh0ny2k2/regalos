import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useFamily } from '@/hooks/useFamily';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { FamilyMemberCard } from '@/components/family/FamilyMemberCard';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDateTime, isPast } from '@/lib/dates';
import { useNow } from '@/hooks/useNow';

export function FamilyPage() {
  const { familyId = '' } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { family, members, deadlineOpen, loading, error, reload } = useFamily(familyId);
  const now = useNow(60_000);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const me = members.find((m) => m.is_me);
  const isAdmin = me?.role === 'ADMIN';

  if (loading && !family) return <LoadingState rows={3} label="Cargando la familia…" />;
  if (error || !family) {
    return (
      <EmptyState
        icon="🔒"
        title="No puedes ver esta familia"
        description={error ?? 'Puede que no seas miembro o que el enlace no sea correcto.'}
        action={<Link to="/" className="btn-ghost">Volver al inicio</Link>}
      />
    );
  }

  const deadlinePassed = isPast(family.deadline_at, now);

  const leave = async () => {
    if (!session) return;
    try {
      await api.leaveFamily(family.id, session.user.id);
      toast.show('Has salido de la familia.', 'info');
      navigate('/', { replace: true });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo salir.', 'error');
    }
  };

  return (
    <div className="space-y-10">
      <section className="animate-fade-up text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Familia</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{family.name}</h1>
        <p className="mt-3 text-sm text-cream/60">
          Navidad: {formatDateTime(family.christmas_at)} · Cierre de cartas: {formatDateTime(family.deadline_at)}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="glass p-5">
            <Countdown to={family.deadline_at} label={deadlinePassed ? 'Las cartas ya están cerradas' : 'Cierre de cartas'} />
          </div>
          <div className="glass p-5">
            <Countdown to={family.christmas_at} label="Hasta Navidad" />
          </div>
        </div>
        {!deadlinePassed && me && (
          <p className="mt-6 text-sm text-cream/70">
            {me.total_wishes === 0
              ? 'Aún no has escrito tu carta. ¡Dile a Papá Noel lo que quieres!'
              : `Llevas ${me.total_wishes} ${me.total_wishes === 1 ? 'deseo' : 'deseos'} en tu carta.`}
          </p>
        )}
      </section>

      <section aria-labelledby="members-title">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="members-title" className="text-2xl">Mi familia</h2>
          <span className="text-sm text-cream/50">{members.length} {members.length === 1 ? 'persona' : 'personas'}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, i) => (
            <FamilyMemberCard key={m.user_id} member={m} familyId={family.id} deadlineOpen={deadlineOpen} index={i} />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap justify-center gap-3 border-t border-white/10 pt-8">
        {isAdmin && (
          <Link to={`/familia/${family.id}/admin`} className="btn-ghost">
            ⚙️ Administrar familia
          </Link>
        )}
        <button type="button" className="btn-ghost text-cream/60" onClick={() => setConfirmLeave(true)}>
          Salir de la familia
        </button>
      </section>

      <ConfirmDialog
        open={confirmLeave}
        title="¿Salir de la familia?"
        message="Perderás acceso a esta familia y a sus cartas. Tu carta y tus reservas dejarán de estar visibles."
        confirmLabel="Salir"
        danger
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />

      <button type="button" className="sr-only" onClick={reload}>
        Actualizar
      </button>
    </div>
  );
}
