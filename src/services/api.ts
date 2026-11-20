import { supabase } from '@/lib/supabase';
import { translateError } from '@/lib/errors';
import type {
  Family,
  FamilySummary,
  Member,
  MemberRole,
  MyReservation,
  Profile,
  Wish,
  WishInput,
  AvatarKey,
} from '@/types';

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** Ejecuta una consulta de Supabase y lanza un Error con mensaje legible. */
async function run<T>(query: PromiseLike<SupabaseResult<T>>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(translateError(error.message));
  return data as T;
}

/** Ejecuta una RPC que no devuelve datos. */
async function runVoid(query: PromiseLike<SupabaseResult<unknown>>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(translateError(error.message));
}

/**
 * Capa de acceso a datos. Ningún método envía el user_id como confianza:
 * la identidad siempre se deduce de auth.uid() en el servidor.
 */
export const api = {
  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------
  getProfile(userId: string): Promise<Profile> {
    return run(
      supabase.from('profiles').select('*').eq('id', userId).single(),
    );
  },

  updateProfile(userId: string, patch: { display_name?: string; avatar_key?: AvatarKey }) {
    return runVoid(supabase.from('profiles').update(patch).eq('id', userId));
  },

  // -------------------------------------------------------------------------
  // Familias
  // -------------------------------------------------------------------------
  /**
   * La RLS de family_members devuelve las filas de TODOS los miembros de las
   * familias del usuario, así que el filtro por user_id es obligatorio aquí
   * para no duplicar familias ni leer el rol de otros.
   */
  async listMyFamilies(userId: string): Promise<FamilySummary[]> {
    // PostgREST puede tipar la relación many-to-one como array: lo normalizamos aquí.
    type Row = { role: MemberRole; families: Family | Family[] | null };
    const rows = await run<Row[]>(
      supabase
        .from('family_members')
        .select('role, families ( id, name, deadline_at, christmas_at )')
        .eq('user_id', userId) as unknown as PromiseLike<SupabaseResult<Row[]>>,
    );
    return rows
      .flatMap((row) => {
        const family = Array.isArray(row.families) ? row.families[0] : row.families;
        return family ? [{ ...family, myRole: row.role }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getFamily(familyId: string): Promise<Family> {
    return run(supabase.from('families').select('id, name, deadline_at, christmas_at').eq('id', familyId).single());
  },

  createFamily(name: string, deadline: Date, christmas: Date): Promise<string> {
    return run(
      supabase.rpc('create_family', {
        p_name: name,
        p_deadline: deadline.toISOString(),
        p_christmas: christmas.toISOString(),
      }),
    );
  },

  joinFamily(code: string): Promise<string> {
    return run(supabase.rpc('join_family', { p_code: code }));
  },

  updateFamily(familyId: string, patch: Partial<Pick<Family, 'name' | 'deadline_at' | 'christmas_at'>>) {
    return runVoid(supabase.from('families').update(patch).eq('id', familyId));
  },

  async getInviteCode(familyId: string): Promise<string> {
    const row = await run<{ code: string }>(
      supabase.from('family_invites').select('code').eq('family_id', familyId).single(),
    );
    return row.code;
  },

  regenerateInviteCode(familyId: string): Promise<string> {
    return run(supabase.rpc('regenerate_invite_code', { p_family_id: familyId }));
  },

  // -------------------------------------------------------------------------
  // Miembros
  // -------------------------------------------------------------------------
  listMembers(familyId: string): Promise<Member[]> {
    return run(supabase.rpc('get_family_members', { p_family_id: familyId }));
  },

  updateMemberRole(familyId: string, userId: string, role: MemberRole) {
    return runVoid(
      supabase.from('family_members').update({ role }).eq('family_id', familyId).eq('user_id', userId),
    );
  },

  removeMember(familyId: string, userId: string) {
    return runVoid(supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', userId));
  },

  setMemberAvatar(familyId: string, userId: string, avatarKey: AvatarKey) {
    return runVoid(
      supabase.rpc('admin_set_member_avatar', {
        p_family_id: familyId,
        p_user_id: userId,
        p_avatar_key: avatarKey,
      }),
    );
  },

  leaveFamily(familyId: string, userId: string) {
    return runVoid(supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', userId));
  },

  // -------------------------------------------------------------------------
  // Regalos (datos públicos)
  // -------------------------------------------------------------------------
  /** Carta de un miembro. Para la propia carta, RLS/RPC devuelve [] tras el plazo. */
  listWishes(familyId: string, ownerId: string): Promise<Wish[]> {
    return run(supabase.rpc('get_member_wishes', { p_family_id: familyId, p_owner_id: ownerId }));
  },

  createWish(familyId: string, input: WishInput): Promise<void> {
    // owner_id se asigna en BD con DEFAULT auth.uid(); el cliente no lo envía
    return runVoid(supabase.from('wishes').insert({ family_id: familyId, ...input }));
  },

  updateWish(wishId: string, input: WishInput): Promise<void> {
    return runVoid(supabase.from('wishes').update(input).eq('id', wishId));
  },

  deleteWish(wishId: string): Promise<void> {
    return runVoid(supabase.from('wishes').delete().eq('id', wishId));
  },

  // -------------------------------------------------------------------------
  // Reservas (datos privados del comprador)
  // -------------------------------------------------------------------------
  reserveWish(wishId: string): Promise<void> {
    return runVoid(supabase.rpc('reserve_wish', { p_wish_id: wishId }));
  },

  markPurchased(wishId: string): Promise<void> {
    return runVoid(supabase.rpc('mark_reservation_purchased', { p_wish_id: wishId }));
  },

  releaseReservation(wishId: string): Promise<void> {
    return runVoid(supabase.rpc('release_reservation', { p_wish_id: wishId }));
  },

  listMyReservations(): Promise<MyReservation[]> {
    return run(supabase.rpc('get_my_reservations'));
  },
};
