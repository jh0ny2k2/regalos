import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import type { Member } from '@/types';

interface Props {
  member: Member;
  familyId: string;
  deadlineOpen: boolean;
  index?: number;
}

/** Estado de la carta de un miembro, con lenguaje que nunca revela compradores. */
function letterStatus(member: Member, deadlineOpen: boolean): string {
  if (member.is_me) {
    if (!deadlineOpen) return '🔒 Tu carta está cerrada';
    const n = member.total_wishes ?? 0;
    return n === 0 ? 'Aún no has escrito tu carta' : `${n} ${n === 1 ? 'deseo' : 'deseos'} en tu carta`;
  }
  const total = member.total_wishes ?? 0;
  if (total === 0) return 'Sin deseos todavía';
  const reserved = member.reserved_wishes ?? 0;
  const free = total - reserved;
  return `${free} ${free === 1 ? 'regalo disponible' : 'regalos disponibles'}`;
}

export function FamilyMemberCard({ member, familyId, deadlineOpen, index = 0 }: Props) {
  const to = member.is_me
    ? `/familia/${familyId}/mi-carta`
    : `/familia/${familyId}/cartas/${member.user_id}`;

  return (
    <article
      className="glass animate-fade-up flex flex-col items-center gap-3 p-5 text-center transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <Avatar avatarKey={member.avatar_key} name={member.display_name} size="lg" highlight={member.is_me} />
      <div>
        <h3 className="text-lg">
          {member.display_name}
          {member.is_me && <span className="ml-2 text-xs text-gold">(tú)</span>}
        </h3>
        {member.role === 'ADMIN' && <p className="text-xs uppercase tracking-wider text-cream/50">Administrador</p>}
      </div>
      <p className="text-sm text-cream/70">{letterStatus(member, deadlineOpen)}</p>
      <Link
        to={to}
        className={`${member.is_me ? 'btn-primary' : 'btn-ghost'} mt-auto w-full`}
        aria-label={member.is_me ? 'Abrir mi carta' : `Ver la carta de ${member.display_name}`}
      >
        {member.is_me ? (deadlineOpen ? 'Editar mi carta' : 'Mi carta') : 'Ver carta'}
      </Link>
    </article>
  );
}
