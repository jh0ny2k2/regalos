import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFamily } from '@/hooks/useFamily';
import { useWishes } from '@/hooks/useWishes';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { WishCard } from '@/components/wishes/WishCard';
import { ClaimGiftModal } from '@/components/wishes/ClaimGiftModal';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Wish } from '@/types';

/** Carta de otro miembro. Solo muestra disponibilidad, nunca quién reservó. */
export function MemberLetterPage() {
  const { familyId = '', userId = '' } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const { members, loading: familyLoading } = useFamily(familyId);
  const { wishes, loading, error, run, pending, reload } = useWishes(familyId, userId);
  const [claiming, setClaiming] = useState<Wish | null>(null);
  const [releasing, setReleasing] = useState<Wish | null>(null);

  const member = members.find((m) => m.user_id === userId);
  const isOwnLetter = session?.user.id === userId;

  if (familyLoading || loading) return <LoadingState rows={3} label="Abriendo la carta…" />;
  if (isOwnLetter) {
    // Si alguien llega aquí con su propio id, lo llevamos a su carta
    return (
      <EmptyState
        icon="🎅"
        title="Esta es tu propia carta."
        action={<Link to={`/familia/${familyId}/mi-carta`} className="btn-primary">Ir a mi carta</Link>}
      />
    );
  }
  if (error || !member) {
    return (
      <EmptyState
        icon="🔒"
        title="No puedes ver esta carta"
        description={error ?? 'Esta persona no pertenece a tu familia.'}
        action={<Link to={`/familia/${familyId}`} className="btn-ghost">Volver a la familia</Link>}
      />
    );
  }

  const available = wishes.filter((w) => w.availability === 'AVAILABLE').length;

  const claim = async () => {
    if (!claiming) return;
    await api.reserveWish(claiming.id).catch((err: unknown) => {
      // Si alguien se ha adelantado, refrescamos para mostrar el estado real
      reload();
      throw err;
    });
    reload();
  };

  const release = async () => {
    if (!releasing) return;
    await run(`rel-${releasing.id}`, () => api.releaseReservation(releasing.id));
    toast.show('Has liberado el regalo. Vuelve a estar disponible.', 'info');
    setReleasing(null);
  };

  return (
    <div className="space-y-8">
      <section className="animate-fade-up flex flex-col items-center gap-4 text-center">
        <Avatar avatarKey={member.avatar_key} name={member.display_name} size="lg" />
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Carta de</p>
        <h1 className="text-4xl">{member.display_name}</h1>
        <p className="text-cream/70">
          {available === 0
            ? 'Por ahora no quedan regalos disponibles.'
            : `${available} ${available === 1 ? 'regalo disponible' : 'regalos disponibles'}`}
        </p>
        <Link to={`/familia/${familyId}`} className="text-sm text-cream/50 underline-offset-4 hover:underline">
          ← Volver a la familia
        </Link>
      </section>

      {wishes.length === 0 ? (
        <EmptyState
          icon="🎄"
          title="Parece que todavía no ha escrito su carta a Papá Noel."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {wishes.map((w, i) => {
            const reservedByMe = w.is_mine;
            const reservedByOther = w.availability !== 'AVAILABLE' && !w.is_mine;
            return (
              <WishCard
                key={w.id}
                wish={w}
                index={i}
                giftAction={
                  reservedByMe ? (
                    <button
                      type="button"
                      className="btn-ghost !px-3 !py-2 text-xs"
                      onClick={() => setReleasing(w)}
                      disabled={pending === `rel-${w.id}` || w.availability === 'PURCHASED'}
                    >
                      Liberar reserva
                    </button>
                  ) : reservedByOther ? null : (
                    <button
                      type="button"
                      className="btn-gold !px-3 !py-2 text-xs"
                      onClick={() => setClaiming(w)}
                    >
                      🎁 Se lo regalo
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      )}

      <ClaimGiftModal
        open={claiming !== null}
        wishName={claiming?.name ?? ''}
        onClose={() => setClaiming(null)}
        onConfirm={async () => {
          try {
            await claim();
            toast.show('Regalo reservado. Lo tienes en «Mis regalos».', 'success');
          } catch (err) {
            toast.show(err instanceof Error ? err.message : 'No se pudo reservar.', 'error');
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={releasing !== null}
        title="¿Liberar este regalo?"
        message="Volverá a estar disponible para el resto de la familia."
        confirmLabel="Liberar"
        onConfirm={release}
        onCancel={() => setReleasing(null)}
      />
    </div>
  );
}
