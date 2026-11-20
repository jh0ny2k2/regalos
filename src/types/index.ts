export type Role = 'USER' | 'ADMIN';
export type MemberRole = 'ADMIN' | 'MEMBER';
export type Priority = 1 | 2 | 3;

/** Estado visible de un regalo para quien lo consulta. Nunca incluye al comprador. */
export type Availability = 'AVAILABLE' | 'RESERVED' | 'PURCHASED';

export const AVATAR_KEYS = [
  'santa',
  'reindeer',
  'tree',
  'gift',
  'star',
  'snowman',
  'bell',
  'candle',
  'mitten',
  'penguin',
  'fox',
  'bear',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const AVATAR_EMOJI: Record<AvatarKey, string> = {
  santa: '🎅',
  reindeer: '🦌',
  tree: '🎄',
  gift: '🎁',
  star: '⭐',
  snowman: '⛄',
  bell: '🔔',
  candle: '🕯️',
  mitten: '🧤',
  penguin: '🐧',
  fox: '🦊',
  bear: '🐻',
};

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_key: AvatarKey;
  role: Role;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  deadline_at: string;
  christmas_at: string;
}

export interface FamilySummary extends Family {
  myRole: MemberRole;
}

/** Miembro tal como lo devuelve get_family_members (sin email ni datos de compra). */
export interface Member {
  user_id: string;
  display_name: string;
  avatar_key: AvatarKey;
  role: MemberRole;
  is_me: boolean;
  /** null si es mi carta y el plazo ya cerró */
  total_wishes: number | null;
  /** null para mi propia carta */
  reserved_wishes: number | null;
  joined_at: string;
}

export interface Wish {
  id: string;
  family_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  approx_price_cents: number | null;
  priority: Priority;
  is_surprise: boolean;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  availability: Availability;
  /** true solo si el llamante es quien hizo la reserva */
  is_mine: boolean;
}

export interface WishInput {
  name: string;
  description: string | null;
  product_url: string | null;
  image_url: string | null;
  approx_price_cents: number | null;
  priority: Priority;
  is_surprise: boolean;
  category: string | null;
  notes: string | null;
}

/** Reserva propia. Solo la ve el comprador. */
export interface MyReservation {
  wish_id: string;
  family_id: string;
  family_name: string;
  owner_id: string;
  owner_name: string;
  wish_name: string;
  priority: Priority;
  approx_price_cents: number | null;
  product_url: string | null;
  category: string | null;
  status: 'RESERVED' | 'PURCHASED';
  reserved_at: string;
  purchased_at: string | null;
}
