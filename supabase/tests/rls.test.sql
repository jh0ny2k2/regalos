-- =============================================================================
-- Tests de RLS, RPC y privacidad. Se ejecutan como `authenticated` con el
-- auth.uid() simulado. Cualquier fallo aborta la ejecución (ON_ERROR_STOP).
-- =============================================================================

-- Mensajes de error en inglés para que las comprobaciones sean independientes del locale
set lc_messages = 'C';

create schema test;

create table test.ctx (key text primary key, val uuid not null);

create function test.id(p text) returns uuid
language sql stable as $$ select val from test.ctx where key = p $$;

-- Ejecuta p_sql (que debe devolver una sola columna de texto) como el usuario p_uid.
-- Devuelve el resultado o 'ERR:<mensaje>' si falla.
create function test.q(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  execute 'set role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
exception when others then
  execute 'reset role';
  return 'ERR:' || sqlerrm;
end;
$$;

create function test.check(p_label text, p_actual text, p_expected text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL [%]: esperado % , obtenido %', p_label, p_expected, p_actual;
  end if;
  raise notice 'PASS %', p_label;
end;
$$;

create function test.check_err(p_label text, p_actual text, p_pattern text) returns void
language plpgsql as $$
begin
  if p_actual is null or p_actual not like 'ERR:%' or p_actual not like '%' || p_pattern || '%' then
    raise exception 'FAIL [%]: se esperaba error ~ "%", obtenido %', p_label, p_pattern, p_actual;
  end if;
  raise notice 'PASS % (%)', p_label, p_pattern;
end;
$$;

-- -----------------------------------------------------------------------------
-- Datos base: 4 usuarios, familia F1 (a=admin, b, d) y familia F2 (c)
-- -----------------------------------------------------------------------------
do $$
declare v uuid;
begin
  insert into auth.users (email, raw_user_meta_data) values ('ana@test.local', '{"display_name":"Ana"}') returning id into v;
  insert into test.ctx values ('a', v);
  insert into auth.users (email, raw_user_meta_data) values ('beto@test.local', '{"display_name":"Beto"}') returning id into v;
  insert into test.ctx values ('b', v);
  insert into auth.users (email, raw_user_meta_data) values ('carla@test.local', '{"display_name":"Carla"}') returning id into v;
  insert into test.ctx values ('c', v);
  insert into auth.users (email, raw_user_meta_data) values ('dani@test.local', '{"display_name":"Dani"}') returning id into v;
  insert into test.ctx values ('d', v);
end $$;

select test.check('perfil creado por trigger', (select display_name from public.profiles where id = test.id('a')), 'Ana');

insert into test.ctx values ('f1', test.q(test.id('a'),
  'select public.create_family(''Familia Pérez'', now() + interval ''10 days'', now() + interval ''20 days'')::text')::uuid);
insert into test.ctx values ('f2', test.q(test.id('c'),
  'select public.create_family(''Otra Familia'', now() + interval ''10 days'', now() + interval ''20 days'')::text')::uuid);

select test.check('admin es ADMIN de F1',
  (select role from public.family_members where family_id = test.id('f1') and user_id = test.id('a')), 'ADMIN');

select test.check('join b a F1', test.q(test.id('b'), format(
  'select public.join_family(%L)::text', (select code from public.family_invites where family_id = test.id('f1')))),
  test.id('f1')::text);
select test.check('join d a F1', test.q(test.id('d'), format(
  'select public.join_family(%L)::text', (select code from public.family_invites where family_id = test.id('f1')))),
  test.id('f1')::text);

-- -----------------------------------------------------------------------------
-- FASE 1: carta ABIERTA
-- -----------------------------------------------------------------------------
insert into test.ctx values ('w1', test.q(test.id('a'), format(
  'with w as (insert into public.wishes (family_id, name, priority) values (%L,''Balón de baloncesto'',3) returning id) select id::text from w',
  test.id('f1')))::uuid);
insert into test.ctx values ('w2', test.q(test.id('b'), format(
  'with w as (insert into public.wishes (family_id, name, priority) values (%L,''Zapatillas'',2) returning id) select id::text from w',
  test.id('f1')))::uuid);
insert into test.ctx values ('w3', test.q(test.id('d'), format(
  'with w as (insert into public.wishes (family_id, name, priority) values (%L,''Perfume'',1) returning id) select id::text from w',
  test.id('f1')))::uuid);

-- Visibilidad de cartas de otros miembros
select test.check('b ve los 3 regalos de F1 abierta',
  test.q(test.id('b'), format('select count(*)::text from public.wishes where family_id = %L', test.id('f1'))), '3');
select test.check('c (otra familia) no ve regalos de F1',
  test.q(test.id('c'), format('select count(*)::text from public.wishes where family_id = %L', test.id('f1'))), '0');
select test.check('get_member_wishes de a para b: AVAILABLE y no es mio',
  test.q(test.id('b'), format('select count(*)::text from public.get_member_wishes(%L,%L) where availability = ''AVAILABLE'' and not is_mine', test.id('f1'), test.id('a'))), '1');
select test.check_err('c no puede leer carta de a (no miembro)',
  test.q(test.id('c'), format('select count(*)::text from public.get_member_wishes(%L,%L)', test.id('f1'), test.id('a'))), 'NOT_A_MEMBER');
select test.check('a ve su propia carta abierta',
  test.q(test.id('a'), format('select count(*)::text from public.get_member_wishes(%L,%L)', test.id('f1'), test.id('a'))), '1');

-- Escrituras indebidas
-- owner_id no es escribible: el regalo siempre queda a nombre de auth.uid()
select test.check('b inserta en F1 y el regalo queda a su nombre (default auth.uid())',
  test.q(test.id('b'), format('with w as (insert into public.wishes (family_id, name) values (%L,''Extra b'') returning owner_id) select owner_id::text from w', test.id('f1'))),
  test.id('b')::text);
delete from public.wishes where name = 'Extra b';
select test.check_err('c no puede insertar en familia ajena',
  test.q(test.id('c'), format('with w as (insert into public.wishes (family_id, name) values (%L,''Hack'') returning id) select id::text from w', test.id('f1'))),
  'row-level security');
select test.check_err('no se puede suplantar owner_id al insertar',
  test.q(test.id('b'), format('with w as (insert into public.wishes (family_id, owner_id, name) values (%L,%L,''Hack'') returning id) select id::text from w', test.id('f1'), test.id('a'))),
  'permission denied');
select test.check('b no puede modificar regalo de a (0 filas)',
  test.q(test.id('b'), format('with u as (update public.wishes set name = ''Hack'' where id = %L returning 1) select count(*)::text from u', test.id('w1'))), '0');
select test.check('nombre del regalo de a sigue intacto',
  (select name from public.wishes where id = test.id('w1')), 'Balón de baloncesto');
select test.check_err('a no puede cambiar owner_id de su regalo (columna no concedida)',
  test.q(test.id('a'), format('with u as (update public.wishes set owner_id = %L where id = %L returning 1) select count(*)::text from u', test.id('b'), test.id('w1'))),
  'permission denied');
select test.check('a actualiza nombre de su regalo',
  test.q(test.id('a'), format('with u as (update public.wishes set name = ''Balón de baloncesto Wilson'' where id = %L returning 1) select count(*)::text from u', test.id('w1'))), '1');

-- Reservas abiertas antes del plazo (migración 20260101000003)
select test.check('b puede reservar el regalo de a antes del plazo', test.q(test.id('b'),
  format('select ''ok'' from (select public.reserve_wish(%L)) s', test.id('w1'))), 'ok');
select test.check('b libera esa reserva de prueba', test.q(test.id('b'),
  format('select ''ok'' from (select public.release_reservation(%L)) s', test.id('w1'))), 'ok');

-- Perfiles y códigos: solo lo propio / solo admin
select test.check('b no puede leer perfil de a', test.q(test.id('b'),
  format('select count(*)::text from public.profiles where id = %L', test.id('a'))), '0');
select test.check('b puede leer su propio perfil', test.q(test.id('b'),
  format('select count(*)::text from public.profiles where id = %L', test.id('b'))), '1');
select test.check('b no puede ver invitación de F1', test.q(test.id('b'),
  format('select count(*)::text from public.family_invites where family_id = %L', test.id('f1'))), '0');
select test.check('a sí puede ver invitación de F1', test.q(test.id('a'),
  format('select count(*)::text from public.family_invites where family_id = %L', test.id('f1'))), '1');

-- Miembros: sin email, sin datos de compra
select test.check('get_family_members devuelve 3 miembros', test.q(test.id('a'),
  format('select count(*)::text from public.get_family_members(%L)', test.id('f1'))), '3');
select test.check('mi propio total_wishes visible en carta abierta', test.q(test.id('a'),
  format('select total_wishes::text from public.get_family_members(%L) where is_me', test.id('f1'))), '1');
select test.check('mi propio reserved_wishes oculto', test.q(test.id('a'),
  format('select count(*)::text from public.get_family_members(%L) where is_me and reserved_wishes is null', test.id('f1'))), '1');
select test.check_err('c no ve miembros de F1', test.q(test.id('c'),
  format('select count(*)::text from public.get_family_members(%L)', test.id('f1'))), 'NOT_A_MEMBER');

-- Invitaciones
select test.check_err('código inválido no une a nadie', test.q(test.id('c'),
  'select public.join_family(''NAVIDAD-AAAA-BBBB'')::text'), 'INVALID_INVITE_CODE');
select test.check_err('b no puede regenerar código', test.q(test.id('b'),
  format('select public.regenerate_invite_code(%L)', test.id('f1')))::text, 'NOT_ADMIN');

create table test.codes (k text primary key, v text);
insert into test.codes select 'old', code from public.family_invites where family_id = test.id('f1');

-- NAVIDAD- (8) + 4 + '-' + 4 = 17 caracteres
select test.check('a regenera código (formato 17 chars)', (select length(test.q(test.id('a'),
  format('select public.regenerate_invite_code(%L)', test.id('f1'))))::text), '17');
select test.check_err('el código antiguo deja de funcionar', test.q(test.id('c'),
  format('select public.join_family(%L)::text', (select v from test.codes where k = 'old'))), 'INVALID_INVITE_CODE');

-- Administración: promoción, último admin y avatar
select test.check('a promueve a b a ADMIN', test.q(test.id('a'), format(
  'with u as (update public.family_members set role = ''ADMIN'' where family_id = %L and user_id = %L returning 1) select count(*)::text from u',
  test.id('f1'), test.id('b'))), '1');
select test.check('b (admin ahora) puede regenerar código', (select length(test.q(test.id('b'),
  format('select public.regenerate_invite_code(%L)', test.id('f1'))))::text), '17');
select test.check('a degrada a b a MEMBER', test.q(test.id('a'), format(
  'with u as (update public.family_members set role = ''MEMBER'' where family_id = %L and user_id = %L returning 1) select count(*)::text from u',
  test.id('f1'), test.id('b'))), '1');
select test.check_err('no se puede quitar el último admin', test.q(test.id('a'), format(
  'with u as (update public.family_members set role = ''MEMBER'' where family_id = %L and user_id = %L returning 1) select count(*)::text from u',
  test.id('f1'), test.id('a'))), 'LAST_ADMIN');
select test.q(test.id('a'), format(
  'select public.admin_set_member_avatar(%L,%L,''fox'')::text', test.id('f1'), test.id('b')));
select test.check('a asigna avatar a b (efecto en profiles)',
  (select avatar_key from public.profiles where id = test.id('b')), 'fox');
select test.check_err('b no puede asignar avatares', test.q(test.id('b'), format(
  'select public.admin_set_member_avatar(%L,%L,''bear'')::text', test.id('f1'), test.id('a'))), 'NOT_ADMIN');
select test.check_err('c no puede cambiar rol de la plataforma', test.q(test.id('c'),
  format('with u as (update public.profiles set role = ''ADMIN'' where id = %L returning 1) select count(*)::text from u', test.id('c'))),
  'permission denied');
select test.check('b no puede modificar perfil ajeno', test.q(test.id('b'),
  format('with u as (update public.profiles set display_name = ''X'' where id = %L returning 1) select count(*)::text from u', test.id('a'))), '0');
select test.check('b no puede expulsar a a', test.q(test.id('b'), format(
  'with u as (delete from public.family_members where family_id = %L and user_id = %L returning 1) select count(*)::text from u',
  test.id('f1'), test.id('a'))), '0');

-- -----------------------------------------------------------------------------
-- FASE 2: plazo CERRADO (simulado retrasando la fecha límite)
-- -----------------------------------------------------------------------------
update public.families set deadline_at = now() - interval '1 minute' where id = test.id('f1');

select test.check('a ya no puede consultar su propia carta (RPC)', test.q(test.id('a'),
  format('select count(*)::text from public.get_member_wishes(%L,%L)', test.id('f1'), test.id('a'))), '0');
select test.check('a ya no puede consultar su propia carta (tabla)', test.q(test.id('a'),
  format('select count(*)::text from public.wishes where owner_id = %L', test.id('a'))), '0');
select test.check('a no puede editar su carta cerrada', test.q(test.id('a'),
  format('with u as (update public.wishes set name = ''X'' where id = %L returning 1) select count(*)::text from u', test.id('w1'))), '0');
select test.check('a no puede borrar su regalo cerrado', test.q(test.id('a'),
  format('with u as (delete from public.wishes where id = %L returning 1) select count(*)::text from u', test.id('w1'))), '0');
select test.check_err('a no puede añadir regalo cerrado', test.q(test.id('a'), format(
  'with w as (insert into public.wishes (family_id, name) values (%L,''Nuevo'') returning id) select id::text from w',
  test.id('f1'), test.id('a'))), 'row-level security');
select test.check('a sin carta propia en get_family_members', test.q(test.id('a'),
  format('select count(*)::text from public.get_family_members(%L) where is_me and total_wishes is null', test.id('f1'))), '1');
select test.check('b sí ve la carta de a cerrada para a', test.q(test.id('b'),
  format('select count(*)::text from public.get_member_wishes(%L,%L)', test.id('f1'), test.id('a'))), '1');
select test.check('b no ve su propia carta cerrada', test.q(test.id('b'),
  format('select count(*)::text from public.get_member_wishes(%L,%L)', test.id('f1'), test.id('b'))), '0');

-- Reservas
select test.check_err('a no puede reservar su propio regalo', test.q(test.id('a'),
  format('select public.reserve_wish(%L)::text', test.id('w1'))), 'OWN_WISH_FORBIDDEN');
select test.check('a reserva el regalo de b', test.q(test.id('a'),
  format('select ''ok'' from (select public.reserve_wish(%L)) s', test.id('w2'))), 'ok');
select test.check_err('d no puede reservar lo ya reservado', test.q(test.id('d'),
  format('select public.reserve_wish(%L)::text', test.id('w2'))), 'ALREADY_RESERVED');
select test.check('d reserva regalo de a', test.q(test.id('d'),
  format('select ''ok'' from (select public.reserve_wish(%L)) s', test.id('w1'))), 'ok');
select test.check_err('b no puede reservar el regalo que ya tiene d', test.q(test.id('b'),
  format('select public.reserve_wish(%L)::text', test.id('w1'))), 'ALREADY_RESERVED');
select test.check_err('usuario fuera de la familia no reserva', test.q(test.id('c'),
  format('select public.reserve_wish(%L)::text', test.id('w2'))), 'WISH_NOT_FOUND');
select test.check_err('no se puede insertar reserva directamente', test.q(test.id('d'), format(
  'with r as (insert into public.gift_reservations (wish_id, family_id, buyer_id) values (%L,%L,%L) returning id) select id::text from r',
  test.id('w3'), test.id('f1'), test.id('d'))), 'permission denied');
select test.check_err('no se puede marcar comprado directamente', test.q(test.id('a'), format(
  'with u as (update public.gift_reservations set status = ''PURCHASED'', purchased_at = now() where wish_id = %L returning 1) select count(*)::text from u',
  test.id('w2'))), 'permission denied');

-- Privacidad de compradores
select test.check('el propietario b NO ve reservas', test.q(test.id('b'),
  'select count(*)::text from public.gift_reservations'), '0');
select test.check('el comprador a ve SOLO su reserva', test.q(test.id('a'),
  'select count(*)::text from public.gift_reservations'), '1');
select test.check('c no ve reservas', test.q(test.id('c'),
  'select count(*)::text from public.gift_reservations'), '0');
select test.check('hay 2 reservas en total (superusuario)', (select count(*)::text from public.gift_reservations), '2');

select test.check('a ve su regalo reservado como is_mine', test.q(test.id('a'), format(
  'select count(*)::text from public.get_member_wishes(%L,%L) where availability = ''RESERVED'' and is_mine', test.id('f1'), test.id('b'))), '1');
select test.check('d ve regalo de b como RESERVED sin is_mine', test.q(test.id('d'), format(
  'select count(*)::text from public.get_member_wishes(%L,%L) where availability = ''RESERVED'' and not is_mine', test.id('f1'), test.id('b'))), '1');
select test.check('d ve su propia reserva en carta de a', test.q(test.id('d'), format(
  'select count(*)::text from public.get_member_wishes(%L,%L) where is_mine', test.id('f1'), test.id('a'))), '1');
select test.check('b no sabe que d reservó su regalo w1 (ve RESERVED sin is_mine)', test.q(test.id('b'), format(
  'select count(*)::text from public.get_member_wishes(%L,%L) where availability = ''RESERVED'' and not is_mine', test.id('f1'), test.id('a'))), '1');

select test.check('get_my_reservations de a: 1 fila RESERVED', test.q(test.id('a'),
  'select count(*)::text || status from public.get_my_reservations() group by status'), '1RESERVED');
select test.check('get_my_reservations de b: vacío', test.q(test.id('b'),
  'select count(*)::text from public.get_my_reservations()'), '0');

-- Compra y liberación
select test.check_err('quien no compró no puede marcar comprado', test.q(test.id('a'),
  format('select (public.mark_reservation_purchased(%L) is null)::text', test.id('w1'))), 'RESERVATION_NOT_FOUND');
select test.check('d marca comprado su regalo de a', test.q(test.id('d'),
  format('select ''ok'' from (select public.mark_reservation_purchased(%L)) s', test.id('w1'))), 'ok');
select test.check('d ve PURCHASED en su lista', test.q(test.id('d'),
  'select status from public.get_my_reservations()'), 'PURCHASED');
select test.check('b NO ve PURCHASED: solo RESERVED', test.q(test.id('b'), format(
  'select count(*)::text from public.get_member_wishes(%L,%L) where availability = ''PURCHASED''', test.id('f1'), test.id('a'))), '0');
select test.check_err('no se puede liberar una compra ya hecha', test.q(test.id('d'),
  format('select public.release_reservation(%L)::text', test.id('w1'))), 'RESERVATION_NOT_FOUND');
select test.check('a libera su reserva de b', test.q(test.id('a'),
  format('select ''ok'' from (select public.release_reservation(%L)) s', test.id('w2'))), 'ok');
select test.check('tras liberar, w2 vuelve a AVAILABLE para d', test.q(test.id('d'), format(
  'select availability from public.get_member_wishes(%L,%L) where id = %L', test.id('f1'), test.id('b'), test.id('w2'))), 'AVAILABLE');

-- Bloqueo del plazo con reservas existentes (trigger)
select test.check_err('a no puede retrasar el plazo con reservas', test.q(test.id('a'), format(
  'with u as (update public.families set deadline_at = now() + interval ''5 days'' where id = %L returning 1) select count(*)::text from u',
  test.id('f1'))), 'DEADLINE_LOCKED_BY_RESERVATIONS');

-- Otra familia aislada
select test.check('c solo ve su propia familia', test.q(test.id('c'),
  'select count(*)::text from public.families'), '1');
select test.check('c sin acceso a F1 en tabla families', test.q(test.id('c'), format(
  'select count(*)::text from public.families where id = %L', test.id('f1'))), '0');
select test.check('c puede ver miembros de F2', test.q(test.id('c'), format(
  'select count(*)::text from public.get_family_members(%L)', test.id('f2'))), '1');
select test.check_err('c no puede regenerar código de F1', test.q(test.id('c'),
  format('select public.regenerate_invite_code(%L)::text', test.id('f1'))), 'NOT_ADMIN');
select test.check_err('c no puede asignar avatar en F1', test.q(test.id('c'),
  format('select public.admin_set_member_avatar(%L,%L,''bear'')::text', test.id('f1'), test.id('b'))), 'NOT_ADMIN');

-- Salida de la familia: borrar su propia membresía elimina sus regalos (cascada)
select test.check('d sale de F1', test.q(test.id('d'), format(
  'with u as (delete from public.family_members where family_id = %L and user_id = %L returning 1) select count(*)::text from u',
  test.id('f1'), test.id('d'))), '1');
select test.check('tras salir d, su regalo w3 desaparece', (select count(*)::text from public.wishes where id = test.id('w3')), '0');

-- Integridad: no se puede cambiar el plazo a una fecha posterior a Navidad
select test.check_err('plazo posterior a Navidad rechazado', test.q(test.id('a'), format(
  'with u as (update public.families set deadline_at = christmas_at + interval ''1 day'' where id = %L returning 1) select count(*)::text from u',
  test.id('f1'))), 'families_deadline_before_christmas');

drop schema test cascade;
