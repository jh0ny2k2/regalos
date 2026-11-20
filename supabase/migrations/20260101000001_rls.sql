-- =============================================================================
-- Carta de Navidad · Row Level Security
--
-- Principios:
--  * Por defecto NADA es accesible: se revocan todos los privilegios a anon y
--    authenticated y después se conceden solo los necesarios.
--  * Las escrituras sensibles (reservas, compras, creación de familias,
--    unirse con código) se hacen SOLO mediante funciones SECURITY DEFINER
--    (ver 20260101000002_rpc.sql). Las tablas no tienen privilegios de
--    INSERT/UPDATE/DELETE sensibles para authenticated.
--  * Las funciones auxiliares de pertenencia usan auth.uid(), nunca datos
--    enviados por el cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Revocación de privilegios por defecto
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Funciones auxiliares (SECURITY DEFINER evita recursión de RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and m.role = 'ADMIN'
  );
$$;

-- TRUE mientras la carta todavía puede editarse
create or replace function public.family_deadline_open(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    where f.id = p_family_id and now() < f.deadline_at
  );
$$;

-- Los nuevos objetos reciben EXECUTE para PUBLIC por defecto: se revoca explícitamente
revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.is_family_admin(uuid) from public, anon;
revoke all on function public.family_deadline_open(uuid) from public, anon;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.family_deadline_open(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- Cada usuario ve SOLO su propio perfil (incluido email). Los datos de otros
-- miembros se obtienen mediante get_family_members(), que omite el email.
-- El rol de plataforma no puede modificarse por el usuario (grant por columnas).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select on public.profiles to authenticated;
grant update (display_name, avatar_key) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- families
-- -----------------------------------------------------------------------------
alter table public.families enable row level security;

create policy families_select_member on public.families
  for select to authenticated
  using (public.is_family_member(id));

create policy families_update_admin on public.families
  for update to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

grant select on public.families to authenticated;
grant update (name, deadline_at, christmas_at) on public.families to authenticated;

-- -----------------------------------------------------------------------------
-- family_invites · el código solo lo ve el administrador
-- -----------------------------------------------------------------------------
alter table public.family_invites enable row level security;

create policy family_invites_select_admin on public.family_invites
  for select to authenticated
  using (public.is_family_admin(family_id));

grant select on public.family_invites to authenticated;

-- -----------------------------------------------------------------------------
-- family_members
-- -----------------------------------------------------------------------------
alter table public.family_members enable row level security;

create policy family_members_select_member on public.family_members
  for select to authenticated
  using (public.is_family_member(family_id));

create policy family_members_update_admin on public.family_members
  for update to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

-- Un miembro puede salir de la familia; el admin puede eliminar a cualquiera.
create policy family_members_delete_self_or_admin on public.family_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_family_admin(family_id));

grant select on public.family_members to authenticated;
grant update (role) on public.family_members to authenticated;
grant delete on public.family_members to authenticated;

-- -----------------------------------------------------------------------------
-- wishes · datos públicos del regalo
--
-- SELECT:
--   * El propietario ve SUS regalos solo mientras la carta está abierta.
--   * Los demás miembros de la familia ven los regalos de cada persona.
-- INSERT / UPDATE / DELETE:
--   * Solo el propietario, solo miembro de la familia y solo antes del plazo.
-- -----------------------------------------------------------------------------
alter table public.wishes enable row level security;

create policy wishes_select_visibility on public.wishes
  for select to authenticated
  using (
    (
      owner_id = auth.uid()
      and public.is_family_member(family_id)
      and public.family_deadline_open(family_id)
    )
    or (
      owner_id <> auth.uid()
      and public.is_family_member(family_id)
    )
  );

create policy wishes_insert_owner_open on public.wishes
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.is_family_member(family_id)
    and public.family_deadline_open(family_id)
  );

create policy wishes_update_owner_open on public.wishes
  for update to authenticated
  using (
    owner_id = auth.uid()
    and public.is_family_member(family_id)
    and public.family_deadline_open(family_id)
  )
  with check (
    owner_id = auth.uid()
    and public.is_family_member(family_id)
    and public.family_deadline_open(family_id)
  );

create policy wishes_delete_owner_open on public.wishes
  for delete to authenticated
  using (
    owner_id = auth.uid()
    and public.is_family_member(family_id)
    and public.family_deadline_open(family_id)
  );

grant select on public.wishes to authenticated;
-- owner_id no se concede: se asigna desde auth.uid() por DEFAULT
grant insert (family_id, name, description, product_url, image_url,
              approx_price_cents, priority, is_surprise, category, notes)
  on public.wishes to authenticated;
grant update (name, description, product_url, image_url, approx_price_cents,
              priority, is_surprise, category, notes)
  on public.wishes to authenticated;
grant delete on public.wishes to authenticated;

-- -----------------------------------------------------------------------------
-- gift_reservations · datos PRIVADOS
-- Solo el comprador puede leer sus propias reservas. NO hay políticas de
-- escritura ni grants de escritura: todo pasa por RPC SECURITY DEFINER.
-- El propietario, la familia y el administrador NO tienen acceso.
-- -----------------------------------------------------------------------------
alter table public.gift_reservations enable row level security;

create policy gift_reservations_select_buyer on public.gift_reservations
  for select to authenticated
  using (buyer_id = auth.uid() and public.is_family_member(family_id));

grant select on public.gift_reservations to authenticated;
