import { useMemo } from 'react';

/** Copos de nieve discretos. Decorativos: se ocultan para usuarios con reducción de movimiento. */
export function Snowfall({ count = 16 }: { count?: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = (i * 9301 + 49297) % 233280;
        const rand = (n: number) => ((seed * (n + 1)) % 1000) / 1000;
        return {
          id: i,
          left: `${Math.round(rand(1) * 100)}%`,
          size: 2 + Math.round(rand(2) * 4),
          duration: 12 + Math.round(rand(3) * 14),
          delay: -Math.round(rand(4) * 20),
          drift: `${Math.round(rand(5) * 60) - 30}px`,
          opacity: 0.12 + rand(6) * 0.25,
        };
      }),
    [count],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden motion-reduce:hidden">
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute top-0 rounded-full bg-white"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            filter: 'blur(0.3px)',
            animation: `snow-fall ${f.duration}s linear ${f.delay}s infinite`,
            ['--drift' as string]: f.drift,
          }}
        />
      ))}
    </div>
  );
}
