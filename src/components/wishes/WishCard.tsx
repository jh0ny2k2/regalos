import { formatPrice, PRIORITY_LABEL, priorityStars, safeHttpUrl } from '@/lib/format';
import type { Wish } from '@/types';
import { GiftStatusBadge } from '@/components/wishes/GiftStatusBadge';

interface WishCardProps {
  wish: Wish;
  /** Acciones opcionales: mostradas en la carta propia. */
  actions?: React.ReactNode;
  /** Acción principal para regalar, mostrada en la carta de otros. */
  giftAction?: React.ReactNode;
  index?: number;
}

export function WishCard({ wish, actions, giftAction, index = 0 }: WishCardProps) {
  const url = safeHttpUrl(wish.product_url);
  const price = formatPrice(wish.approx_price_cents);
  const reserved = wish.availability !== 'AVAILABLE';

  return (
    <article
      className={`glass animate-fade-up flex flex-col gap-4 p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl ${
        reserved && !wish.is_mine ? 'opacity-70' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug text-balance">{wish.name}</h3>
          {wish.category && <p className="text-xs uppercase tracking-wider text-cream/50">{wish.category}</p>}
        </div>
        <GiftStatusBadge availability={wish.availability} isMine={wish.is_mine} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cream/75">
        <span title={PRIORITY_LABEL[wish.priority]} aria-label={PRIORITY_LABEL[wish.priority]}>
          {priorityStars(wish.priority)}
          <span className="sr-only">{PRIORITY_LABEL[wish.priority]}</span>
        </span>
        {price && <span className="tabular-nums">{price}</span>}
        {wish.is_surprise && <span className="text-gold">🎁 Sorpresa: acepta ideas parecidas</span>}
      </div>

      {wish.description && <p className="text-sm text-cream/70 text-balance">{wish.description}</p>}
      {wish.notes && (
        <p className="rounded-lg bg-black/20 px-3 py-2 text-sm italic text-cream/65">“{wish.notes}”</p>
      )}

      {(url || actions || giftAction) && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn-ghost !px-3 !py-2 text-xs"
            >
              Ver producto ↗
            </a>
          )}
          {actions}
          {giftAction}
        </div>
      )}
    </article>
  );
}
