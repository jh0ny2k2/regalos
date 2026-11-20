/**
 * Traduce los códigos de error de PostgreSQL/RPC a mensajes para el usuario.
 * Los códigos vienen de las funciones SQL (RAISE EXCEPTION 'CODIGO').
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  NOT_A_MEMBER: 'No tienes acceso a esta familia.',
  NOT_ADMIN: 'Solo el administrador puede hacer esto.',
  INVALID_INVITE_CODE: 'El código de invitación no es válido.',
  INVALID_DATES: 'Las fechas no son válidas: la fecha límite debe ser anterior a Navidad.',
  WISH_NOT_FOUND: 'Este regalo ya no existe.',
  OWN_WISH_FORBIDDEN: 'No puedes reservar tus propios regalos.',
  ALREADY_RESERVED: '🎁 ¡Vaya! Este regalo acaba de ser reservado por otra persona.',
  RESERVATION_NOT_FOUND: 'No tienes una reserva activa para este regalo.',
  DEADLINE_LOCKED_BY_RESERVATIONS:
    'No se puede cambiar la fecha límite porque ya hay regalos reservados.',
  LAST_ADMIN: 'Debe quedar al menos un administrador en la familia.',
  WISH_IDENTITY_IMMUTABLE: 'Este regalo no se puede mover a otra persona.',
  SELF_RESERVATION_FORBIDDEN: 'No puedes reservar tus propios regalos.',
};

export function translateError(message: string | undefined | null): string {
  if (!message) return 'Ha ocurrido un error inesperado.';

  const code = Object.keys(MESSAGES).find((key) => message.includes(key));
  if (code) return MESSAGES[code];

  // Violación de RLS: la operación no está permitida en este momento
  // (por ejemplo, editar una carta ya cerrada).
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'Esta acción no está disponible ahora mismo. Puede que la carta ya esté cerrada.';
  }

  if (message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (message.includes('User already registered')) {
    return 'Ya existe una cuenta con ese email.';
  }
  if (message.includes('Email not confirmed')) {
    // La app no usa confirmación: si aparece, Supabase tiene "Confirm email" activo
    return 'La cuenta no está activa todavía. Pide al administrador de la app que revise la configuración.';
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }

  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
