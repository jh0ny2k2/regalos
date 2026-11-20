import { api } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import type { FamilySummary } from '@/types';

export function useMyFamilies() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const result = useAsync<FamilySummary[]>(
    () => (userId ? api.listMyFamilies(userId) : Promise.resolve([])),
    [userId],
  );
  return {
    families: result.data ?? [],
    loading: result.loading,
    error: result.error,
    reload: result.reload,
  };
}
