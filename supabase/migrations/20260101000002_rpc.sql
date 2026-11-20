-- =============================================================================
-- Carta de Navidad · Funciones RPC (SECURITY DEFINER)
--
-- Todas las operaciones sensibles pasan por aquí. Cada función:
--   * obtiene la identidad de auth.uid(), nunca de parámetros del cliente;
--   * valida pertenencia a la familia y reglas de negocio;
--   * fija search_path = '' para evitar secuestro por search_path;
--   * tiene EXECUTE solo para `authenticated`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Generación de código de invitación: NAVIDAD-XXXX-XXXX (sin I, O, 0, 1)
-- -----------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 símbolos
  v_bytes    bytea := extensions.gen_random_bytes(8);
  v_code     text := 'NAVIDAD-';
  i          int;
begin
  for i in 0..7 loop
    if i = 4 then
      v_code := v_code || '-';
    end if;
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_family · crea una familia y convierte al creador en ADMIN
-- -----------------------------------------------------------------------------
create or replace function public.create_family(
  p_name       text,
  p_deadline   timestamptz,
  p_christmas  timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_deadline is null or p_christmas is null or p_deadline >= p_christmas then
    raise exception 'INVALID_DATES' using errcode = '22023';
  end if;

  insert into public.families (name, deadline_at, christmas_at, created_by)
  values (btrim(p_name), p_deadline, p_christmas, v_uid)
  returning id into v_family;

  insert into public.family_members (family_id, user_id, role)
  values (v_family, v_uid, 'ADMIN');

  insert into public.family_invites (family_id, code)
  values (v_family, public.generate_invite_code());

  return v_family;
end;
$$;

-- -----------------------------------------------------------------------------
-- join_family · unirse mediante código de invitación
-- SECURITY DEFINER porque los miembros normales no pueden leer family_invites.
-- -----------------------------------------------------------------------------
create or replace function public.join_family(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select i.family_id into v_family
  from public.family_invites i
  where i.code = upper(btrim(coalesce(p_code, '')));

  if not found then
    -- Mismo mensaje para cualquier código inválido: no permite enumerar familias
    raise exception 'INVALID_INVITE_CODE' using errcode = '22023';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (v_family, v_uid, 'MEMBER')
  on conflict (family_id, user_id) do nothing;

  return v_family;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_family_members · resumen de miembros SIN email y SIN datos de compra
--
-- total_wishes:    propia carta -> solo antes del plazo (después: NULL = cerrada)
--                  otros        -> número de regalos
-- reserved_wishes: propia carta -> NULL (nunca se muestra)
--                  otros        -> número de regalos reservados/comprados
--                                  (sin distinguir ni revelar comprador)
-- -----------------------------------------------------------------------------
create or replace function public.get_family_members(p_family_id uuid)
returns table (
  user_id        uuid,
  display_name   text,
  avatar_key     text,
  role           text,
  is_me          boolean,
  total_wishes   integer,
  reserved_wishes integer,
  joined_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_open boolean;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  v_open := public.family_deadline_open(p_family_id);

  return query
  select
    fm.user_id,
    p.display_name,
    p.avatar_key,
    fm.role,
    (fm.user_id = v_uid),
    case
      when fm.user_id = v_uid then (case when v_open then wc.total else null end)
      else wc.total
    end,
    case
      when fm.user_id = v_uid then null
      else wc.reserved
    end,
    fm.joined_at
  from public.family_members fm
  join public.profiles p on p.id = fm.user_id
  left join lateral (
    select
      count(*)::int                    as total,
      count(r.id)::int                 as reserved
    from public.wishes w
    left join public.gift_reservations r on r.wish_id = w.id
    where w.family_id = fm.family_id
      and w.owner_id = fm.user_id
  ) wc on true
  where fm.family_id = p_family_id
  order by fm.joined_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_member_wishes · carta de una persona
--
-- Propietario:  regalos solo mientras el plazo esté abierto. Nunca ve reservas.
-- Otro miembro: regalos con availability AVAILABLE | RESERVED.
--               RESERVED no distingue si está comprado; is_mine = true solo
--               si el llamante es quien reservó.
-- -----------------------------------------------------------------------------
create or replace function public.get_member_wishes(p_family_id uuid, p_owner_id uuid)
returns table (
  id                 uuid,
  family_id          uuid,
  owner_id           uuid,
  name               text,
  description        text,
  product_url        text,
  image_url          text,
  approx_price_cents integer,
  priority           smallint,
  is_surprise        boolean,
  category           text,
  notes              text,
  created_at         timestamptz,
  updated_at         timestamptz,
  availability       text,
  is_mine            boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if not public.is_family_member(p_family_id) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = p_owner_id
  ) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  -- Caso 1: el propietario consulta su propia carta
  if p_owner_id = v_uid then
    if not public.family_deadline_open(p_family_id) then
      return; -- carta cerrada: no devuelve nada
    end if;
    return query
      select w.id, w.family_id, w.owner_id, w.name, w.description, w.product_url,
             w.image_url, w.approx_price_cents, w.priority, w.is_surprise,
             w.category, w.notes, w.created_at, w.updated_at,
             'AVAILABLE'::text, false
      from public.wishes w
      where w.family_id = p_family_id and w.owner_id = v_uid
      order by w.priority desc, w.created_at;
    return;
  end if;

  -- Caso 2: otro miembro consulta la carta
  return query
    select w.id, w.family_id, w.owner_id, w.name, w.description, w.product_url,
           w.image_url, w.approx_price_cents, w.priority, w.is_surprise,
           w.category, w.notes, w.created_at, w.updated_at,
           (case
              when r.id is null then 'AVAILABLE'
              when r.buyer_id = v_uid then r.status
              else 'RESERVED'
            end)::text,
           coalesce(r.buyer_id = v_uid, false)
    from public.wishes w
    left join public.gift_reservations r on r.wish_id = w.id
    where w.family_id = p_family_id and w.owner_id = p_owner_id
    order by w.priority desc, w.created_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- reserve_wish · reserva atómica y sin condiciones de carrera
--
-- La unicidad la garantiza UNIQUE(wish_id) en BD. INSERT ... ON CONFLICT DO
-- NOTHING espera a la transacción concurrente y, si ya existe, no inserta:
-- exactamente una de las peticiones simultáneas obtiene la fila.
-- -----------------------------------------------------------------------------
create or replace function public.reserve_wish(p_wish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_family      uuid;
  v_owner       uuid;
  v_reservation uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  select w.family_id, w.owner_id into v_family, v_owner
  from public.wishes w
  where w.id = p_wish_id;

  -- Mismo error si no existe o si el llamante no pertenece a la familia
  if not found or not public.is_family_member(v_family) then
    raise exception 'WISH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_owner = v_uid then
    raise exception 'OWN_WISH_FORBIDDEN' using errcode = '42501';
  end if;

  if public.family_deadline_open(v_family) then
    raise exception 'RESERVATIONS_NOT_OPEN' using errcode = '42501';
  end if;

  insert into public.gift_reservations (wish_id, family_id, buyer_id)
  values (p_wish_id, v_family, v_uid)
  on conflict (wish_id) do nothing
  returning id into v_reservation;

  if v_reservation is null then
    raise exception 'ALREADY_RESERVED' using errcode = '23505';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- mark_reservation_purchased · solo el comprador
-- -----------------------------------------------------------------------------
create or replace function public.mark_reservation_purchased(p_wish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  update public.gift_reservations
  set status = 'PURCHASED', purchased_at = now()
  where wish_id = p_wish_id
    and buyer_id = auth.uid()
    and status = 'RESERVED';

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- release_reservation · liberar una reserva aún no comprada (solo el comprador)
-- -----------------------------------------------------------------------------
create or replace function public.release_reservation(p_wish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  delete from public.gift_reservations
  where wish_id = p_wish_id
    and buyer_id = auth.uid()
    and status = 'RESERVED';

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- get_my_reservations · ÚNICA vista de reservas. Solo las del llamante.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_reservations()
returns table (
  wish_id            uuid,
  family_id          uuid,
  family_name        text,
  owner_id           uuid,
  owner_name         text,
  wish_name          text,
  priority           smallint,
  approx_price_cents integer,
  product_url        text,
  category           text,
  status             text,
  reserved_at        timestamptz,
  purchased_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  return query
    select r.wish_id, r.family_id, f.name, w.owner_id, p.display_name,
           w.name, w.priority, w.approx_price_cents, w.product_url, w.category,
           r.status::text, r.reserved_at, r.purchased_at
    from public.gift_reservations r
    join public.wishes w   on w.id = r.wish_id
    join public.families f on f.id = r.family_id
    join public.profiles p on p.id = w.owner_id
    where r.buyer_id = v_uid
      and public.is_family_member(r.family_id)
    order by r.reserved_at desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- regenerate_invite_code · solo ADMIN
-- -----------------------------------------------------------------------------
create or replace function public.regenerate_invite_code(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  i      int;
begin
  if not public.is_family_admin(p_family_id) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- Reintenta ante colisión improbable de código único
  for i in 1..5 loop
    v_code := public.generate_invite_code();
    begin
      update public.family_invites
      set code = v_code, rotated_at = now()
      where family_id = p_family_id;
      if found then
        return v_code;
      end if;
      -- Familia sin fila de invitación: la creamos
      insert into public.family_invites (family_id, code) values (p_family_id, v_code);
      return v_code;
    exception when unique_violation then
      null; -- reintentar con otro código
    end;
  end loop;

  raise exception 'CODE_GENERATION_FAILED';
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_set_member_avatar · el administrador gestiona avatares de la familia
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_member_avatar(
  p_family_id  uuid,
  p_user_id    uuid,
  p_avatar_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_family_admin(p_family_id) then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = p_user_id
  ) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  update public.profiles set avatar_key = p_avatar_key where id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución: solo `authenticated`
-- -----------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.generate_invite_code()',
    'public.create_family(text, timestamptz, timestamptz)',
    'public.join_family(text)',
    'public.get_family_members(uuid)',
    'public.get_member_wishes(uuid, uuid)',
    'public.reserve_wish(uuid)',
    'public.mark_reservation_purchased(uuid)',
    'public.release_reservation(uuid)',
    'public.get_my_reservations()',
    'public.regenerate_invite_code(uuid)',
    'public.admin_set_member_avatar(uuid, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- generate_invite_code es interna: no debe ser llamable desde el cliente
revoke all on function public.generate_invite_code() from authenticated;

-- -----------------------------------------------------------------------------
-- Las funciones trigger no deben ser invocables por la API. Supabase concede
-- EXECUTE a anon/authenticated por defecto sobre funciones nuevas.
-- -----------------------------------------------------------------------------
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.handle_auth_user_email_change() from public, anon, authenticated;
revoke all on function public.wishes_protect_identity() from public, anon, authenticated;
revoke all on function public.gift_reservations_guard() from public, anon, authenticated;
revoke all on function public.families_guard_deadline() from public, anon, authenticated;
revoke all on function public.family_members_keep_admin() from public, anon, authenticated;
