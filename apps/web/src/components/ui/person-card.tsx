import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";
import { Mail } from "lucide-react";

/**
 * The "Who to contact" card from the reference — avatar, name, role, campus.
 *
 * **`email` is optional on purpose (PLACEHOLDER-007).** The reference shows a
 * mail icon on every card, but `DepartmentBoard` carries only `name`, `role`
 * and `imageUrl` — there is no email column. Rather than render a dead icon or
 * invent an address, the action is omitted when absent. Adding `email` to
 * `department_board`, or falling back to `Campus.email`, is the smallest fix;
 * until then these cards are honest about what they know.
 */
export interface PersonCardProps {
  campus?: string | null;
  className?: string;
  email?: string | null;
  imageUrl?: string | null;
  name: string;
  /**
   * Job title. Deliberately NOT named `role` — that shadows the ARIA `role`
   * attribute, and both linters and readers trip on `role="Campus Director"`.
   */
  position?: string | null;
}

export function PersonCard({
  name,
  position,
  campus,
  imageUrl,
  email,
  className,
}: PersonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-biso-md border border-edge p-5 text-center",
        className
      )}
    >
      <span className="size-16 overflow-hidden rounded-biso-pill bg-ink-muted/10">
        {imageUrl ? (
          <ImageWithFallback
            alt=""
            className="size-16 object-cover"
            height={64}
            src={imageUrl}
            width={64}
          />
        ) : null}
      </span>

      <span className="min-w-0">
        <span className="type-heading-card block text-ink">{name}</span>
        {position ? (
          <span className="type-body-sm block text-ink-muted">{position}</span>
        ) : null}
        {campus ? (
          <span className="type-body-sm block text-ink-muted">{campus}</span>
        ) : null}
      </span>

      {email ? (
        <a
          aria-label={`Email ${name}`}
          className="rounded-biso-sm p-1 text-ink-accent transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
          href={`mailto:${email}`}
        >
          <Mail aria-hidden="true" className="size-5" />
        </a>
      ) : null}
    </div>
  );
}
