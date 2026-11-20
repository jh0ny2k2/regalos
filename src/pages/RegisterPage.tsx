import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

export function RegisterPage() {
  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (displayName.trim().length < 2) return setError('Tu nombre debe tener al menos 2 letras.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');

    setBusy(true);
    setError(null);
    try {
      await signUp(email.trim(), password, displayName.trim());
      toast.show('Cuenta creada. ¡Bienvenido!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="glass p-6 sm:p-8">
        <h1 className="text-center text-3xl">Crear cuenta</h1>
        <p className="mt-2 text-center text-sm text-cream/60">Después podrás unirte a tu familia con un código</p>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">Tu nombre</label>
            <input
              id="name"
              autoComplete="given-name"
              maxLength={60}
              required
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="mt-1 text-xs text-cream/50">Mínimo 8 caracteres.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-cream/60">
          ¿Ya tienes cuenta?{' '}
          <Link to="/acceder" className="text-gold underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
