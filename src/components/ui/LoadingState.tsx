/** Skeleton genérico para listas y tarjetas mientras cargan los datos. */
export function LoadingState({ rows = 3, label = 'Cargando…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass h-28 p-5">
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton mt-4 h-3 w-2/3 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
      <span className="text-5xl animate-pop-in motion-safe:animate-bounce" aria-hidden="true">
        🎄
      </span>
      <p className="text-sm text-cream/60">Preparando la mesa…</p>
    </div>
  );
}
