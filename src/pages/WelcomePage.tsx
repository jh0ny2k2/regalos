import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function WelcomePage() {
  const { session } = useAuth();
  if (session) return <Navigate to="/" replace />;

  return (
    <div className="animate-fade-up text-center">
      <div className="glass relative overflow-hidden px-6 py-12 sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="relative">
          <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12 animate-fade-up" aria-hidden="true">
            <defs>
              <linearGradient id="star-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f3dc9a" />
                <stop offset="1" stopColor="#a8842f" />
              </linearGradient>
            </defs>
            <path d="M24 4 L28.5 17.5 L43 17.5 L31.3 26 L35.8 39.5 L24 31.2 L12.2 39.5 L16.7 26 L5 17.5 L19.5 17.5 Z" fill="url(#star-g)" />
          </svg>
          <p className="mt-5 text-[0.7rem] font-medium uppercase tracking-[0.35em] text-gold/90">Navidad 2026</p>
          <h1 className="mt-3 text-5xl leading-[1.05] sm:text-6xl">
            <span className="text-gold-gradient">Carta de</span>
            <br />
            <span className="italic text-cream">Navidad</span>
          </h1>
          <div className="mx-auto mt-6 flex items-center justify-center gap-3" aria-hidden="true">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold/70" />
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold/70" />
          </div>
          <p className="mx-auto mt-6 max-w-xs text-balance text-cream/75">
            Porque Papá Noel también necesita organización.
          </p>
        </div>
        <div className="relative">

        <div className="mt-10 flex flex-col gap-3">
          <Link to="/acceder" className="btn-primary w-full py-3.5 text-base">
            Iniciar sesión
          </Link>
          <Link to="/registro" className="btn-ghost w-full py-3.5 text-base">
            Crear cuenta
          </Link>
        </div>

        <p className="mx-auto mt-8 max-w-xs text-xs leading-relaxed text-cream/45">
          Tus regalos son privados: tu familia ve lo que quieres, y nadie sabe quién compra qué.
        </p>
        </div>
      </div>
    </div>
  );
}
