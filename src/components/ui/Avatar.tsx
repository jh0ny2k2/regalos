import { AVATAR_EMOJI, type AvatarKey } from '@/types';

interface AvatarProps {
  avatarKey: AvatarKey;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

const SIZES = {
  sm: 'h-9 w-9 text-lg',
  md: 'h-12 w-12 text-2xl',
  lg: 'h-20 w-20 text-4xl',
};

export function Avatar({ avatarKey, name, size = 'md', highlight = false }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={`Avatar de ${name}`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-christmas/80 to-pine shadow-inner ring-2 ${
        highlight ? 'ring-gold' : 'ring-white/15'
      } ${SIZES[size]}`}
    >
      {AVATAR_EMOJI[avatarKey] ?? '🎁'}
    </span>
  );
}
