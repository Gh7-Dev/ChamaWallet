import { ROLES } from "../stellar";
import { t } from "../translations";

/** icon + bilingual label for a role, given a translation table (t[lang]). */
export function roleMeta(tr, role) {
  switch (role) {
    case ROLES.CHAIRPERSON:
      return { icon: "👑", label: tr.roleChairperson };
    case ROLES.SECRETARY:
      return { icon: "📝", label: tr.roleSecretary };
    case ROLES.TREASURER:
      return { icon: "💰", label: tr.roleTreasurer };
    case ROLES.MEMBER:
      return { icon: "👤", label: tr.roleMember };
    default:
      return { icon: "👤", label: "" };
  }
}

function RoleBadge({ role, lang }) {
  if (!role) return null;
  const tr = t[lang || "en"];
  const { icon, label } = roleMeta(tr, role);
  return (
    <span className="role-badge" data-role={role}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  );
}

export default RoleBadge;
