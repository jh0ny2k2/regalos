import { useMemo } from 'react';

const COLORS = ['#9b1c1f', '#c9a24a', '#fbf6ee', '#2f7a55', '#e5484d'];

/** Confeti puntual (se monta al completar la carta y se desmonta al terminar). */
export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        color: COLORS[i % COLORS.length],
        delay: `${(i % 10) * 0.08}s`,
        duration: `${2.6 + (i % 5) * 0.4}s`,
        drift: `${((i * 53) % 120) - 60}px`,
        w: 6 + (i % 4) * 2,
        h: 10 + (i % 3) * 4,
      })),
    [pieces],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden">
      {items.map((c) => (
        <span
          key={c.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: c.left,
            width: c.w,
            height: c.h,
            background: c.color,
            animation: `confetti-fall ${c.duration} ease-in ${c.delay} forwards`,
            ['--drift' as string]: c.drift,
          }}
        />
      ))}
    </div>
  );
}
