-- =============================================================================
-- Carta de Navidad · Esquema base
-- Tablas, constraints, índices y triggers de integridad.
-- Las políticas RLS están en 20260101000001_rls.sql
-- Las funciones RPC están en 20260101000002_rpc.sql
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles · un registro por usuario de Supabase Auth
-- El email NO se expone a otros miembros (ver RPC list_family_members).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
               check (char_length(btrim(display_name)) between 1 and 60),
  email        text not null,
  avatar_key   text not null default 'santa'
               check (avatar_key in (
                 'santa', 'reindeer', 'tree', 'gift', 'star', 'snowman',
                 'bell', 'candle', 'mitten', 'penguin', 'fox', 'bear'
               )),
  role         text not null default 'USER'
               check (role in ('USER', 'ADMIN')),   -- rol de plataforma
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'Familiar'), '@', 1)
    ), 60),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Mantiene el email del perfil sincronizado con Auth
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_change();

-- -----------------------------------------------------------------------------
-- families · grupo familiar (diseñado para N familias)
-- -----------------------------------------------------------------------------
create table public.families (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  deadline_at  timestamptz not null,   -- fecha límite de edición de cartas
  christmas_at timestamptz not null,   -- fecha de Navidad / entrega
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint families_deadline_before_christmas check (deadline_at < christmas_at)
);

create trigger families_set_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

-- Código de invitación separado: solo el administrador puede leerlo
create table public.family_invites (
  family_id  uuid primary key references public.families (id) on delete cascade,
  code       text not null unique
             check (code ~ '^NAVIDAD-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- family_members · relación N:M usuario ↔ familia
-- -----------------------------------------------------------------------------
create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_idx on public.family_members (user_id);
create index family_members_admin_idx on public.family_members (family_id)
  where role = 'ADMIN';

-- -----------------------------------------------------------------------------
-- wishes · datos PÚBLICOS de cada regalo (no contienen información de compra)
-- -----------------------------------------------------------------------------
create table public.wishes (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null,
  -- Por defecto el propietario es el usuario autenticado; el cliente no lo envía
  owner_id          uuid not null default auth.uid(),
  name              text not null check (char_length(btrim(name)) between 1 and 120),
  description       text check (description is null or char_length(description) <= 1000),
  product_url       text check (product_url is null or (
                      char_length(product_url) <= 2048 and product_url ~* '^https?://')),
  image_url         text check (image_url is null or (
                      char_length(image_url) <= 2048 and image_url ~* '^https?://')),
  approx_price_cents integer check (approx_price_cents is null
                      or approx_price_cents between 0 and 10000000),
  priority          smallint not null default 1 check (priority between 1 and 3),
  is_surprise       boolean not null default false,
  category          text check (category is null or char_length(category) <= 40),
  notes             text check (notes is null or char_length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Un regalo solo puede pertenecer a una familia de la que su dueño es miembro
  constraint wishes_owner_membership_fk
    foreign key (family_id, owner_id)
    references public.family_members (family_id, user_id) on delete cascade,
  -- Clave compuesta usada por la FK de las reservas
  constraint wishes_id_family_unique unique (id, family_id)
);

create index wishes_family_owner_idx on public.wishes (family_id, owner_id);
create index wishes_family_priority_idx on public.wishes (family_id, priority desc);

create trigger wishes_set_updated_at
  before update on public.wishes
  for each row execute function public.set_updated_at();

-- family_id y owner_id son inmutables: un regalo no puede "trasladarse"
create or replace function public.wishes_protect_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.family_id is distinct from old.family_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'WISH_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger wishes_protect_identity
  before update on public.wishes
  for each row execute function public.wishes_protect_identity();

-- -----------------------------------------------------------------------------
-- gift_reservations · datos PRIVADOS de compra (solo visibles para el comprador)
-- Separada de wishes para que ningún SELECT sobre wishes exponga al comprador.
-- -----------------------------------------------------------------------------
create table public.gift_reservations (
  id           uuid primary key default gen_random_uuid(),
  wish_id      uuid not null,
  family_id    uuid not null,
  buyer_id     uuid not null,
  status       text not null default 'RESERVED'
               check (status in ('RESERVED', 'PURCHASED')),
  reserved_at  timestamptz not null default now(),
  purchased_at timestamptz,
  updated_at   timestamptz not null default now(),

  -- Doble reserva imposible a nivel de BD
  constraint gift_reservations_wish_unique unique (wish_id),
  constraint gift_reservations_wish_fk
    foreign key (wish_id, family_id)
    references public.wishes (id, family_id) on delete cascade,
  constraint gift_reservations_buyer_fk
    foreign key (family_id, buyer_id)
    references public.family_members (family_id, user_id) on delete cascade,
  constraint gift_reservations_status_consistency
    check ((status = 'PURCHASED') = (purchased_at is not null))
);

create index gift_reservations_buyer_idx on public.gift_reservations (buyer_id, family_id);

create trigger gift_reservations_set_updated_at
  before update on public.gift_reservations
  for each row execute function public.set_updated_at();

-- Defensa en profundidad: un usuario nunca puede reservar su propio regalo
-- y solo se puede reservar después de la fecha límite.
create or replace function public.gift_reservations_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_deadline timestamptz;
begin
  if tg_op = 'INSERT' then
    select w.owner_id into v_owner from public.wishes w where w.id = new.wish_id;
    if v_owner = new.buyer_id then
      raise exception 'SELF_RESERVATION_FORBIDDEN' using errcode = '42501';
    end if;

    select f.deadline_at into v_deadline from public.families f where f.id = new.family_id;
    if v_deadline is null or now() < v_deadline then
      raise exception 'RESERVATIONS_NOT_OPEN' using errcode = '42501';
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

create trigger gift_reservations_guard
  before insert or update on public.gift_reservations
  for each row execute function public.gift_reservations_guard();

-- Un administrador no puede cambiar la fecha límite una vez existen reservas.
-- Así nunca se reabre la edición de un regalo ya comprado.
create or replace function public.families_guard_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deadline_at is distinct from old.deadline_at
     and exists (
       select 1 from public.gift_reservations r where r.family_id = old.id
     ) then
    raise exception 'DEADLINE_LOCKED_BY_RESERVATIONS' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger families_guard_deadline
  before update on public.families
  for each row execute function public.families_guard_deadline();

-- Siempre debe existir al menos un administrador por familia
create or replace function public.family_members_keep_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Borrado en cascada de la propia familia: no aplica
    if not exists (select 1 from public.families f where f.id = old.family_id) then
      return old;
    end if;
    -- Borrado en cascada de la cuenta (auth.users → profiles → family_members):
    -- la cuenta ya no existe, así que no se puede exigir un administrador de relevo.
    if not exists (select 1 from public.profiles p where p.id = old.user_id) then
      return old;
    end if;
    if old.role = 'ADMIN' and not exists (
      select 1 from public.family_members m
      where m.family_id = old.family_id and m.role = 'ADMIN' and m.user_id <> old.user_id
    ) then
      raise exception 'LAST_ADMIN' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.role = 'ADMIN' and new.role <> 'ADMIN' and not exists (
    select 1 from public.family_members m
    where m.family_id = old.family_id and m.role = 'ADMIN' and m.user_id <> old.user_id
  ) then
    raise exception 'LAST_ADMIN' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger family_members_keep_admin
  before update or delete on public.family_members
  for each row execute function public.family_members_keep_admin();
