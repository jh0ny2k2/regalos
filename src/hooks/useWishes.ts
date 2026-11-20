import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import type { Wish } from '@/types';

/**
 * Carta de un miembro con acciones de escritura. Las operaciones delegan en
 * la base de datos (RLS/RPC); el hook solo mantiene el estado de la UI.
 */
export function useWishes(familyId: string, ownerId: string) {
  const list = useAsync<Wish[]>(() => api.listWishes(familyId, ownerId), [familyId, ownerId]);
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setPending(key);
      try {
        await action();
        list.reload();
      } finally {
        setPending(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.reload],
  );

  return {
    wishes: list.data ?? [],
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    pending,
    run,
  };
}
