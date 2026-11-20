import { timeLeft } from '@/lib/dates';
import { useNow } from '@/hooks/useNow';

interface CountdownProps {
  to: string;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ to, label }: CountdownProps) {
  const now = useNow(1000);
  const left = timeLeft(to, now);

  if (left.total === 0) {
    return <p className="text-lg font-display text-gold">{label} ya ha llegado 🎄</p>;
  }

  const units = [
    { value: left.days, unit: 'días' },
    { value: left.hours, unit: 'horas' },
    { value: left.minutes, unit: 'min' },
    { value: left.seconds, unit: 'seg' },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm uppercase tracking-[0.2em] text-gold">{label}</p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
        {units.map((u) => (
          <div key={u.unit} className="glass flex min-w-[4.5rem] flex-col items-center px-3 py-3">
            <span className="font-display text-3xl tabular-nums sm:text-4xl">
              {u.unit === 'días' ? u.value : pad(u.value)}
            </span>
            <span className="text-xs text-cream/60">{u.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
