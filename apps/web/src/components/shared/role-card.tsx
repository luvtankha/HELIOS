import { ButtonLink } from "../ui/button-link";

interface RoleCardProps {
  role: "Patient" | "Doctor";
  description: string;
  icon: string;
  href: string;
  variant?: "primary" | "secondary";
}

export function RoleCard({
  role,
  description,
  icon,
  href,
  variant,
}: RoleCardProps) {
  return (
    <ButtonLink href={href} ariaLabel={`${role} experience`} variant={variant}>
      <span className="flex items-center gap-4">
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
        <span>
          <span className="block">I am a {role}</span>
          <span className="block text-xs font-normal opacity-75">
            {description}
          </span>
        </span>
      </span>
    </ButtonLink>
  );
}
