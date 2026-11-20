import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';

export function Navbar() {
  const { profile, signOut } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm transition ${
      isActive ? 'bg-white/10 text-cream' : 'text-cream/60 hover:text-cream'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-pine-deep/60 shadow-lg shadow-black/20 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#b52226] to-christmas text-sm shadow-md shadow-christmas/30 ring-1 ring-inset ring-white/15" aria-hidden="true">
            🎄
          </span>
          <span className="text-gold-gradient">Carta de Navidad</span>
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Inicio
          </NavLink>
          <NavLink to="/reservas" className={linkClass}>
            <span className="sm:hidden" aria-hidden="true">🎁</span>
            <span className="hidden sm:inline">Mis regalos</span>
          </NavLink>
          {profile && (
            <Link
              to="/perfil"
              className="ml-2 flex items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-white/10"
              aria-label="Mi perfil"
            >
              <Avatar avatarKey={profile.avatar_key} name={profile.display_name} size="sm" />
              <span className="hidden text-sm md:inline">{profile.display_name}</span>
            </Link>
          )}
          <button type="button" onClick={() => void signOut()} className="btn-ghost !px-3 !py-2 text-xs">
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
