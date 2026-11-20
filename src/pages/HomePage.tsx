import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyFamilies } from '@/hooks/useMyFamilies';
import { useAuth } from '@/hooks/useAuth';
import { useNow } from '@/hooks/useNow';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { daysUntil, formatDateTime, isPast } from '@/lib/dates';
import { CreateFamilyModal } from '@/components/family/CreateFamilyModal';
import { JoinFamilyModal } from '@/components/family/JoinFamilyModal';

/**
 * Pantalla de inicio: lista las familias del usuario y permite crear o unirse.
 */
export function HomePage() {
  const { profile } = useAuth();
  const { families, loading, error, reload } = useMyFamilies();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const now = useNow(60_000);
  const navigate = useNavigate();

  if (loading) return <LoadingState rows={2} label="Cargando tus familias…" />;

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="No pudimos cargar tus familias"
        description={error}
        action={
          <button type="button" className="btn-ghost" onClick={reload}>
            Reintentar
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Hola{profile ? `, ${profile.display_name}` : ''}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Tus familias</h1>
      </section>

      {families.length === 0 ? (
        <EmptyState
          icon="🎄"
          title="Todavía no formas parte de ninguna familia."
          description="Crea una nueva o únete con el código que te haya compartido tu familia."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
                Crear familia
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowJoin(true)}>
                Unirme con código
              </button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {families.map((f, i) => {
            const days = daysUntil(f.christmas_at, now);
            const deadlinePassed = isPast(f.deadline_at, now);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/familia/${f.id}`)}
                className="glass animate-fade-up flex flex-col gap-4 p-5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl">{f.name}</h2>
                  {f.myRole === 'ADMIN' && (
                    <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs text-gold">Admin</span>
                  )}
                </div>
                <p className="text-sm text-cream/70">
                  🎄 {days > 0 ? `Faltan ${days} ${days === 1 ? 'día' : 'días'} para Navidad` : '¡Feliz Navidad!'}
                </p>
                <p className="text-xs text-cream/50">
                  {deadlinePassed
                    ? '🔒 Las cartas están cerradas'
                    : `Plazo para escribir cartas: ${formatDateTime(f.deadline_at)}`}
                </p>
              </button>
            );
          })}
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/20 p-5 sm:justify-center">
            <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
              + Crear familia
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowJoin(true)}>
              Unirme con código
            </button>
          </div>
        </div>
      )}

      <CreateFamilyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setShowCreate(false);
          navigate(`/familia/${id}`);
        }}
      />
      <JoinFamilyModal
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={(id) => {
          setShowJoin(false);
          reload();
          navigate(`/familia/${id}`);
        }}
      />
    </div>
  );
}
