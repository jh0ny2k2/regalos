import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoader } from '@/components/ui/LoadingState';

/** Solo accesible con sesión. La seguridad real está en RLS; esto solo mejora la UX. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/bienvenida" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Solo accesible sin sesión (login, registro). */
export function RequireGuest() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
