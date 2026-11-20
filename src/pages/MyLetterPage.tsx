import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { useWishes } from '@/hooks/useWishes';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { WishCard } from '@/components/wishes/WishCard';
import { WishFormModal } from '@/components/wishes/WishFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Confetti } from '@/components/ui/Confetti';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { isPast, formatDateTime } from '@/lib/dates';
import { useNow } from '@/hooks/useNow';
import type { Wish, WishInput } from '@/types';

type SortKey = 'priority' | 'price' | 'name';

const SORTERS: Record<SortKey, (a: Wish, b: Wish) => number> = {
  priority: (a, b) => b.priority - a.priority || a.name.localeCompare(b.name),
  price: (a, b) => (b.approx_price_cents ?? -1) - (a.approx_price_cents ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
};

export function MyLetterPage() {
  const { familyId = '' } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const now = useNow(60_000);
  const userId = session?.user.id ?? '';
  const { family, deadlineOpen, loading: familyLoading } = useFamily(familyId);
  const { wishes, loading, error, run, pending, reload } = useWishes(familyId, userId);

  const [sort, setSort] = useState<SortKey>('priority');
  const [editing, setEditing] = useState<Wish | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Wish | null>(null);

  const sorted = useMemo(() => [...wishes].sort(SORTERS[sort]), [wishes, sort]);
  const deadlinePassed = family ? isPast(family.deadline_at, now) : false;

  if (familyLoading || loading) return <LoadingState rows={3} label="Abriendo tu carta…" />;
  if (error || !family) {
    return (
      <EmptyState
        icon="🔒"
        title="No puedes ver tu carta"
        description={error ?? undefined}
        action={<Link to={`/familia/${familyId}`} className="btn-ghost">Volver a la familia</Link>}
      />
    );
  }

  // Tras el plazo la RPC devuelve la carta vacía; la UI lo refleja sin revelar nada.
  if (deadlinePassed) {
    return (
      <EmptyState
        icon="🔒"
        title="Tu carta ya está en camino al Polo Norte."
        description={`El plazo terminó el ${formatDateTime(family.deadline_at)}. Ahora toca esperar a Navidad.`}
        action={<Link to={`/familia/${familyId}`} className="btn-ghost">Volver a la familia</Link>}
      />
    );
  }

  // Los errores se propagan al formulario (handleSave) o se muestran como toast (handleDelete)
  const handleSave = async (input: WishInput) => {
    if (editing) {
      await api.updateWish(editing.id, input);
      toast.show('Deseo actualizado.', 'success');
    } else {
      await api.createWish(familyId, input);
      toast.show('Deseo añadido a tu carta 🎄', 'success');
    }
    setEditing(undefined);
    reload();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await run(`del-${toDelete.id}`, () => api.deleteWish(toDelete.id));
      toast.show('Deseo eliminado.', 'info');
      setToDelete(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo eliminar.', 'error');
      setToDelete(null);
    }
  };

  const progress = Math.min(100, Math.round((sorted.length / 5) * 100));
  const complete = sorted.length >= 5;

  return (
    <div className="space-y-8">
      <section className="animate-fade-up">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">{family.name}</p>
        <h1 className="mt-2 text-4xl">🎅 Mi Carta de Navidad</h1>

        <div className="glass mt-6 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cream/80">
              {sorted.length} {sorted.length === 1 ? 'deseo' : 'deseos'}
            </span>
            <span className="text-cream/50">Objetivo orientativo: 5</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Progreso de tu carta"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-christmas transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {complete && <p className="mt-3 text-sm text-gold">¡Carta completa! Papá Noel ya tiene trabajo 🎉</p>}
          {complete && <Confetti pieces={50} />}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-primary" onClick={() => setEditing(null)}>
            + Añadir deseo
          </button>
          <label className="flex items-center gap-2 text-sm text-cream/70">
            Ordenar por
            <select
              className="input !w-auto !py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="priority" className="bg-pine-deep">Prioridad</option>
              <option value="price" className="bg-pine-deep">Precio</option>
              <option value="name" className="bg-pine-deep">Nombre</option>
            </select>
          </label>
        </div>
        {deadlineOpen && (
          <p className="mt-3 text-xs text-cream/50">Puedes editar tu carta hasta el {formatDateTime(family.deadline_at)}.</p>
        )}
      </section>

      {sorted.length === 0 ? (
        <EmptyState
          icon="🎄"
          title="Parece que todavía no has escrito tu carta a Papá Noel."
          description="Añade tu primer deseo y tu familia podrá verlo."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((w, i) => (
            <WishCard
              key={w.id}
              wish={w}
              index={i}
              actions={
                <>
                  <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setEditing(w)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-danger !px-3 !py-2 text-xs"
                    onClick={() => setToDelete(w)}
                    disabled={pending === `del-${w.id}`}
                  >
                    Eliminar
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      <WishFormModal
        open={editing !== undefined}
        initial={editing}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Eliminar este deseo?"
        message={`«${toDelete?.name ?? ''}» desaparecerá de tu carta. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
