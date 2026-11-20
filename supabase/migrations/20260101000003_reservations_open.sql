-- =============================================================================
-- Carta de Navidad · Reservas abiertas desde ya
--
-- Cambio: se pueden reservar regalos ANTES de que termine el plazo de las
-- cartas. Sigue sin poder reservarse el propio regalo.
--
-- Esta migración sustituye solo lo necesario:
--   * reserve_wish            (quita la comprobación del plazo)
--   * gift_reservations_guard (quita la comprobación del plazo)
-- =============================================================================

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

  insert into public.gift_reservations (wish_id, family_id, buyer_id)
  values (p_wish_id, v_family, v_uid)
  on conflict (wish_id) do nothing
  returning id into v_reservation;

  if v_reservation is null then
    raise exception 'ALREADY_RESERVED' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.gift_reservations_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    select w.owner_id into v_owner from public.wishes w where w.id = new.wish_id;
    if v_owner = new.buyer_id then
      raise exception 'SELF_RESERVATION_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.wish_id is distinct from old.wish_id
       or new.buyer_id is distinct from old.buyer_id
       or new.family_id is distinct from old.family_id
       or new.reserved_at is distinct from old.reserved_at then
      raise exception 'RESERVATION_IDENTITY_IMMUTABLE' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
