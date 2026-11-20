import { useMemo } from 'react';
import { api } from '@/services/api';
import { useAsync } from '@/hooks/useAsync';
import { isPast } from '@/lib/dates';
import type { Family, Member } from '@/types';

/** Datos de una familia: ficha, miembros y si el plazo sigue abierto. */
export function useFamily(familyId: string) {
  const family = useAsync<Family>(() => api.getFamily(familyId), [familyId]);
  const members = useAsync<Member[]>(() => api.listMembers(familyId), [familyId]);

  const deadlineOpen = useMemo(
    () => (family.data ? !isPast(family.data.deadline_at) : false),
    [family.data],
  );

  return {
    family: family.data,
    members: members.data ?? [],
    deadlineOpen,
    loading: family.loading || members.loading,
    error: family.error ?? members.error,
    reload: () => {
      family.reload();
      members.reload();
    },
  };
}
