import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { AVATAR_EMOJI, AVATAR_KEYS, type AvatarKey } from '@/types';
import { Avatar } from '@/components/ui/Avatar';

export function ProfilePage() {
  const { profile, refreshProfile, signOut, session } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarKey>('santa');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setAvatar(profile.avatar_key);
    }
  }, [profile]);

  if (!profile || !session) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) {
      toast.show('Tu nombre debe tener entre 2 y 60 caracteres.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.updateProfile(profile.id, { display_name: trimmed, avatar_key: avatar });
      await refreshProfile();
      toast.show('Perfil actualizado.', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section className="animate-fade-up text-center">
        <Avatar avatarKey={avatar} name={name || profile.display_name} size="lg" highlight />
        <h1 className="mt-4 text-4xl">Mi perfil</h1>
        <p className="mt-1 text-sm text-cream/50">{profile.email}</p>
      </section>

      <form onSubmit={save} className="glass space-y-5 p-6">
        <div>
          <label htmlFor="pf-name" className="label">Nombre</label>
          <input id="pf-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>

        <fieldset>
          <legend className="label">Avatar</legend>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAvatar(k)}
                aria-pressed={avatar === k}
                aria-label={k}
                className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition ${
                  avatar === k ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {AVATAR_EMOJI[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
