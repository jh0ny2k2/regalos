import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { formatPrice, PRIORITY_LABEL, priorityStars, safeHttpUrl } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { MyReservation } from '@/types';

/** Única vista de reservas: solo las del usuario actual, nunca las de otros. */
export function MyReservationsPage() {
  const toast = useToast();
  const list = useAsync<MyReservation[]>(() => api.listMyReservations(), []);
  const [pending, setPending] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<MyReservation | null>(null);

  const act = async (r: MyReservation, action: () => Promise<void>, ok: string) => {
    setPending(r.wish_id);
    try {
      await action();
      toast.show(ok, 'success');
      list.reload();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setPending(null);
    }
  };

  if (list.loading) return <LoadingState rows={2} label="Cargando tus regalos…" />;
  if (list.error) {
    return <EmptyState icon="⚠️" title="No pudimos cargar tus regalos" description={list.error} />;
  }

  const rows = list.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="🎁"
        title="Todavía no te has encargado de ningún regalo."
        description="Cuando reserves un regalo de la carta de alguien, aparecerá aquí. Solo tú lo verás."
        action={<Link to="/" className="btn-ghost">Ir a mis familias</Link>}
      />
    );
  }

  const pendingRows = rows.filter((r) => r.status === 'RESERVED');
  const purchasedRows = rows.filter((r) => r.status === 'PURCHASED');

  return (
    <div className="space-y-10">
      <section className="animate-fade-up">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Privado</p>
        <h1 className="mt-2 text-4xl">🎁 Regalos que voy a comprar</h1>
        <p className="mt-2 text-sm text-cream/60">
          Solo tú puedes ver esta lista. Nadie más de tu familia sabe que eres tú.
        </p>
      </section>

      <Group title="Pendientes de comprar" rows={pendingRows} empty="No tienes regalos pendientes.">
        {(r) => (
          <ReservationCard
            key={r.wish_id}
            r={r}
            busy={pending === r.wish_id}
            actions={
              <>
                <button
                  type="button"
                  className="btn-gold !px-3 !py-2 text-xs"
                  disabled={pending === r.wish_id}
                  onClick={() => act(r, () => api.markPurchased(r.wish_id), '¡Genial! Regalo marcado como comprado.')}
                >
                  Marcar como comprado
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-2 text-xs"
                  disabled={pending === r.wish_id}
                  onClick={() => setReleasing(r)}
                >
                  Liberar reserva
                </button>
              </>
            }
          />
        )}
      </Group>

      <Group title="Comprados" rows={purchasedRows} empty="Aún no has marcado ninguno como comprado.">
        {(r) => <ReservationCard key={r.wish_id} r={r} />}
      </Group>

      <ConfirmDialog
        open={releasing !== null}
        title="¿Liberar esta reserva?"
        message="El regalo volverá a estar disponible para la familia."
        confirmLabel="Liberar"
        danger
        onConfirm={async () => {
          if (releasing) {
            await act(releasing, () => api.releaseReservation(releasing.wish_id), 'Reserva liberada.');
          }
          setReleasing(null);
        }}
        onCancel={() => setReleasing(null)}
      />
    </div>
  );
}

function Group({
  title,
  rows,
  empty,
  children,
}: {
  title: string;
  rows: MyReservation[];
  empty: string;
  children: (r: MyReservation) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-2xl">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-cream/50">{empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">{rows.map(children)}</div>
      )}
    </section>
  );
}

function ReservationCard({
  r,
  actions,
  busy = false,
}: {
  r: MyReservation;
  actions?: React.ReactNode;
  busy?: boolean;
}) {
  const url = safeHttpUrl(r.product_url);
  const purchased = r.status === 'PURCHASED';
  const price = formatPrice(r.approx_price_cents);

  return (
    <article className={`glass animate-fade-up flex flex-col gap-3 p-5 ${busy ? 'opacity-60' : ''}`}>
      <p className="text-xs uppercase tracking-wider text-cream/50">Para {r.owner_name}</p>
      <h3 className="text-lg">{r.wish_name}</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-cream/70">
        <span title={PRIORITY_LABEL[r.priority]}>{priorityStars(r.priority)}</span>
        {price && <span className="tabular-nums">{price}</span>}
      </div>
      <p className="text-sm">
        {purchased ? (
          <span className="text-emerald-300">🟢 Comprado</span>
        ) : (
          <span className="text-gold">🟡 Reservado</span>
        )}
      </p>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-gold underline-offset-4 hover:underline">
          Ver producto ↗
        </a>
      )}
      {actions && <div className="mt-auto flex flex-wrap gap-2 pt-1">{actions}</div>}
    </article>
  );
}
