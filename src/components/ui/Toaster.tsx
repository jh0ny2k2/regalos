import { useToast } from '@/hooks/useToast';
import type { ToastTone } from '@/hooks/useToast';

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-emerald-400/40 bg-emerald-900/80',
  error: 'border-red-400/50 bg-red-950/85',
  info: 'border-gold/40 bg-pine-deep/90',
};

const TONE_ICON: Record<ToastTone, string> = {
  success: '✨',
  error: '⚠️',
  info: '🎄',
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm text-cream shadow-2xl backdrop-blur-md ${TONE_CLASS[t.tone]}`}
        >
          <span aria-hidden="true">{TONE_ICON[t.tone]}</span>
          <span className="flex-1">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
