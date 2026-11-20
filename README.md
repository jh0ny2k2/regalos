# 🎄 Carta de Navidad

Aplicación para que una familia organice sus regalos de Navidad de forma privada. Cada miembro escribe su carta de deseos antes de una fecha límite; después, el resto de la familia puede reservar regalos sin que nadie —ni el propietario, ni el administrador— sepa quién los ha reservado.

- **Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router
- **Backend:** Supabase (Auth, PostgreSQL, Row Level Security, funciones RPC)
- **Despliegue:** Netlify (SPA)

---

## Índice

1. [Instalación](#instalación)
2. [Configuración de Supabase](#configuración-de-supabase)
3. [Variables de entorno](#variables-de-entorno)
4. [Ejecución local](#ejecución-local)
5. [Aplicación de migraciones](#aplicación-de-migraciones)
6. [Creación del primer administrador](#creación-del-primer-administrador)
7. [Despliegue en Netlify](#despliegue-en-netlify)
8. [Arquitectura](#arquitectura)
9. [Seguridad y RLS](#seguridad-y-rls)
10. [Tests de base de datos](#tests-de-base-de-datos)

---

## Instalación

Requisitos: Node.js 22 o superior y npm.

```bash
npm install
```

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **Authentication → Providers → Email**, deja el proveedor email activo y **desactiva *Confirm email***. La app no usa confirmación por email: tras registrarse, la cuenta entra directamente. Si la dejas activa, el registro fallará con "Email not confirmed".
3. En **Authentication → URL Configuration** añade:
   - *Site URL*: la URL de Netlify (o `http://localhost:5173` en local).
   - *Redirect URLs*: la misma URL con `/**`.
4. Aplica las migraciones (ver [Aplicación de migraciones](#aplicación-de-migraciones)).

## Variables de entorno

Copia el ejemplo y rellena los valores de **Project Settings → API**:

```bash
cp .env.example .env
```

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave **anon / public**. Es pública por diseño: la seguridad la aplica RLS. |

> ⚠️ **Nunca** pongas la clave `service_role` en el frontend ni en ningún archivo versionado. Tampoco subas `.env`: el `.gitignore` ya lo excluye.

## Ejecución local

```bash
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/ para comprobarlo en local
npm run typecheck  # solo TypeScript
```

## Aplicación de migraciones

Las migraciones están en `supabase/migrations/` y se aplican **en orden**:

| Archivo | Contenido |
| --- | --- |
| `20260101000000_schema.sql` | Tablas, constraints, índices, FK compuestas, triggers de integridad |
| `20260101000001_rls.sql` | Revocación de privilegios por defecto y políticas RLS |
| `20260101000002_rpc.sql` | Funciones RPC `SECURITY DEFINER` y permisos de ejecución |
| `20260101000003_reservations_open.sql` | Reservas abiertas desde ya (sin esperar al plazo) |

**Opción A · Supabase CLI (recomendada)**

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

**Opción B · SQL Editor del dashboard**

Pega cada archivo, en el orden indicado, en *SQL Editor* y ejecútalo.

## Creación del primer administrador

No hace falta tocar la base de datos. El administrador de una familia es **quien la crea**:

1. Regístrate en la app (*Crear cuenta*).
2. Pulsa **Crear familia** y rellena nombre, fecha límite y fecha de Navidad.
3. Serás `ADMIN` automáticamente y verás el código de invitación en *Administrar familia*.

Comparte ese código (o el enlace de invitación) con el resto de la familia.

Existe además un rol de plataforma (`profiles.role`: `USER` | `ADMIN`) reservado para futuras funciones de operación. Para asignarlo manualmente, desde el SQL Editor y con permisos de propietario:

```sql
update public.profiles set role = 'ADMIN' where email = 'tu@email.com';
```

Este rol no concede acceso a datos de otras familias: las políticas RLS dependen de la pertenencia a la familia, no de este campo.

## Despliegue en Netlify

El repositorio incluye `netlify.toml` con:

- Comando `npm run build` y directorio `dist`.
- Redirección `/* → /index.html` para que el enrutado SPA funcione al recargar.
- Cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy`, etc.).

Pasos:

1. Importa el repositorio en Netlify (*Add new site → Import an existing project*).
2. En **Site configuration → Environment variables** define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Despliega. Después, actualiza la *Site URL* en Supabase con la URL final de Netlify.

> La CSP de `netlify.toml` permite conexiones solo a `*.supabase.co` y a Google Fonts. Si cambias de proveedor o añades un CDN, actualiza esa cabecera.

---

## Arquitectura

```
src/
  components/
    ui/          Piezas genéricas (Modal, Avatar, Countdown, Toaster, ConfirmDialog…)
    wishes/      WishCard, GiftStatusBadge, WishFormModal, ClaimGiftModal
    family/      FamilyMemberCard, CreateFamilyModal, JoinFamilyModal
    layout/      Navbar, RouteGuards
  pages/         Una página por ruta
  layouts/       AppLayout (autenticado) y PublicLayout
  hooks/         useAuth, useToast, useAsync, useFamily, useWishes, useNow…
  services/      api.ts: única capa que habla con Supabase
  lib/           supabase client, errores traducidos, fechas, validación, formato
  types/         Tipos del dominio

supabase/
  migrations/    Esquema, RLS y RPC (fuente de verdad de la seguridad)
  tests/         Suite de RLS/RPC ejecutable contra Postgres
```

### Modelo de datos

```
auth.users ──1:1── profiles
families ──1:1── family_invites         (código, visible solo al ADMIN)
families ──1:N── family_members ──N:1── profiles      (N:M usuario ↔ familia)
family_members ──1:N── wishes           (FK compuesta: el dueño DEBE ser miembro)
wishes ──1:0..1── gift_reservations     (UNIQUE(wish_id) → una sola reserva)
```

**Separación de datos públicos y privados.** `wishes` contiene solo lo que describe el regalo. Todo lo relativo a la compra vive en `gift_reservations`, cuya política de lectura es exclusivamente `buyer_id = auth.uid()`. Así, ninguna consulta sobre regalos puede filtrar al comprador por accidente.

**Multifamilia.** Todo cuelga de `families`. Un usuario puede pertenecer a varias familias; cada consulta está acotada por `family_id` y por la pertenencia verificada en BD.

### Flujo de reserva concurrente

1. El cliente llama a `reserve_wish(wish_id)`. No envía `user_id`.
2. La función toma la identidad de `auth.uid()`, comprueba pertenencia, que no sea su regalo y que el plazo haya cerrado.
3. `INSERT … ON CONFLICT (wish_id) DO NOTHING RETURNING id`. Si otra transacción ya ha insertado, esta no devuelve fila y se lanza `ALREADY_RESERVED`.
4. La unicidad la garantiza la constraint `UNIQUE` de PostgreSQL, no el frontend.

### Flujo de la fecha límite

- **Antes del plazo:** el propietario puede crear, editar y borrar sus regalos. El resto de la familia ya puede reservar regalos (no se puede reservar el propio).
- **Después del plazo:** el propietario deja de poder leer su propia carta (RLS y RPC devuelven vacío). Los demás miembros siguen pudiendo reservar y consultar.
- La condición `now() < families.deadline_at` vive en las políticas RLS y en las funciones, no en React.
- Un trigger impide cambiar la fecha límite una vez existen reservas.

### Estados de un regalo

| Estado | Quién lo ve | Significado |
| --- | --- | --- |
| `AVAILABLE` | Todos | Disponible |
| `RESERVED` | Todos (sin comprador) | Reservado. Para terceros solo aparece como «Ya reservado» |
| `PURCHASED` | Solo el comprador | Marcado como comprado. Para terceros aparece como reservado |

---

## Seguridad y RLS

### Principios

1. **Denegar por defecto.** Se revocan todos los privilegios de `anon` y `authenticated`; después se conceden solo los necesarios.
2. **Las escrituras sensibles pasan por RPC.** Reservas, compras, creación de familias, unirse y regenerar código son funciones `SECURITY DEFINER` con `search_path = ''`. La tabla `gift_reservations` no tiene ningún permiso de escritura para el cliente.
3. **Nunca confiar en el cliente para la identidad.** `owner_id` tiene `DEFAULT auth.uid()` y no se concede en `INSERT`. Ninguna función acepta `user_id` del llamante para decidir permisos.
4. **Mismo error para lo que no existe y lo que no está permitido.** Un regalo ajeno de otra familia devuelve `WISH_NOT_FOUND`, igual que uno inexistente. Esto evita enumerar regalos.

### Tabla de amenazas revisadas

| Amenaza | Mitigación |
| --- | --- |
| **IDOR** en cartas o regalos | Pertenencia a familia verificada en RLS y en cada RPC |
| **Acceso entre familias** | Todas las políticas exigen `is_family_member(family_id)` |
| **Manipulación de `user_id`** | El cliente no envía `user_id`; `owner_id` viene de `auth.uid()` y no es escribible |
| **Manipulación de `gift_id`** | Cada RPC recalcula `family_id` y `owner_id` desde la BD |
| **Bypass de fecha límite** | Política RLS, comprobación en RPC y trigger de `gift_reservations` |
| **Consulta de reservas ajenas** | `gift_reservations` solo tiene `SELECT` para `buyer_id = auth.uid()` |
| **Doble reserva** | `UNIQUE(wish_id)` + `ON CONFLICT DO NOTHING`. Verificado con 12 sesiones simultáneas |
| **Modificación de regalos ajenos** | `UPDATE`/`DELETE` solo para `owner_id = auth.uid()` y plazo abierto |
| **Cambio de propietario o familia de un regalo** | Trigger `wishes_protect_identity` + columnas no concedidas |
| **Exposición del comprador** | Ninguna vista ni RPC devuelve `buyer_id` a terceros; `get_member_wishes` solo devuelve `is_mine` |
| **Exposición de emails** | `profiles` solo es legible por su propio dueño; los miembros se leen por RPC sin email |
| **Exposición de secretos** | Solo se usa la clave `anon`. Se comprueba que el bundle no contiene `service_role` |
| **Permisos de administrador** | `is_family_admin()` en RLS y RPC; el último administrador no puede quitarse |
| **Admin viendo compradores** | El administrador no tiene acceso a `gift_reservations`, igual que cualquier miembro |
| **Secuestro por `search_path`** | Todas las funciones usan `set search_path = ''` y nombres cualificados |
| **Llamadas directas a funciones trigger** | Revocado `EXECUTE` a `anon` y `authenticated` |
| **Invitación enumerable** | El código tiene 8 caracteres de un alfabeto de 32 (≈ 10¹² combinaciones) y `join_family` devuelve el mismo error para cualquier código inválido |
| **Clickjacking / XSS vía URL** | CSP y `X-Frame-Options: DENY`; las URLs de producto solo aceptan `http(s)` |

### Qué ve cada uno

| Dato | Propietario (antes del plazo) | Propietario (después) | Otro miembro | Comprador | Administrador |
| --- | :---: | :---: | :---: | :---: | :---: |
| Su carta | ✅ | ❌ | ✅ (sin quién reservó) | ✅ | ✅ (sin quién reservó) |
| Quién reservó/compró | ❌ | ❌ | ❌ | ✅ (solo lo suyo) | ❌ |
| Si un regalo está reservado | ❌ | ❌ | ✅ | ✅ | ✅ |
| Email de otros | ❌ | ❌ | ❌ | ❌ | ❌ |
| Código de invitación | ❌ | ❌ | ❌ | ❌ | ✅ |

Nota de diseño: mientras la carta está abierta, el propietario **sí** ve que un regalo aparece como reservado, porque sus propios regalos se consultan con `get_member_wishes`. Lo que nunca ve es quién lo reservó: la RPC no devuelve el comprador ni `is_mine` al propietario. Si quieres que el propietario no vea ni siquiera la reserva, habría que ocultar el estado en su carta mientras está abierta.

---

## Tests de base de datos

La suite (`supabase/tests/rls.test.sql`) ejecuta cada comprobación con `role authenticated` y un `auth.uid()` simulado, igual que PostgREST. Cubre 81 aserciones: visibilidad por familia, bloqueo tras el plazo, suplantación de `owner_id`, reservas propias, doble reserva, privacidad del comprador, administración y último administrador.

**Requisito:** una base de datos PostgreSQL **desechable**. El script borra el esquema `public`.

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carta_test"
export CONFIRM_DESTRUCTIVE=yes
npm run test:db
```

Con Supabase CLI local (`npx supabase start`), usa `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. En ese caso el stub de `auth` no se aplica, porque el esquema ya existe.

> No apuntes `TEST_DATABASE_URL` a producción.

---

## Limitaciones conocidas

- **Sin Realtime todavía.** Las cartas se actualizan al recargar o al volver a la pestaña. Añadir suscripciones sobre `wishes` es sencillo, pero no envía el estado de reservas, así que habría que filtrarlo igual que `get_member_wishes`.
- **Sin subida de imágenes.** El campo `image_url` existe en BD y en el modelo, pero el formulario no lo expone todavía.
- **Sin modo oscuro alternativo.** La aplicación ya es oscura por diseño.
- **Sin modo offline.**
