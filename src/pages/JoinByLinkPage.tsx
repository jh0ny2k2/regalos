import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { FullPageLoader } from '@/components/ui/LoadingState';

/** Enlace de invitación: /unirse?code=NAVIDAD-XXXX-XXXX. Pide login si hace falta. */
export function JoinByLinkPage() {
  const [params] = useSearchParams();
  const { session, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const code = params.get('code') ?? '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    if (!code) {
      setError('El enlace no contiene ningún código.');
      return;
    }
    api
      .joinFamily(code.toUpperCase())
      .then((familyId) => {
        toast.show('¡Te has unido a la familia!', 'success');
        navigate(`/familia/${familyId}`, { replace: true });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudo unir.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, code]);

  if (loading) return <FullPageLoader />;
  if (!session) {
    return <Navigate to="/acceder" replace state={{ from: `/unirse?code=${encodeURIComponent(code)}` }} />;
  }
  if (error) {
    return (
      <div className="glass p-6 text-center">
        <p role="alert" className="text-red-200">{error}</p>
        <button type="button" className="btn-ghost mt-5" onClick={() => navigate('/', { replace: true })}>
          Volver al inicio
        </button>
      </div>
    );
  }
  return <FullPageLoader />;
}
