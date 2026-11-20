import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass animate-fade-up flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden="true">
        {icon}
      </span>
      <p className="max-w-sm text-balance text-lg font-display text-cream">{title}</p>
      {description && <p className="max-w-sm text-sm text-cream/60">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
