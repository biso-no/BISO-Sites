import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill } from "@/components/ui/pill";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

/**
 * `member_only` limits who can JOIN an event, never who can SEE it. Every
 * public surface lists members-only events like any other and marks them with
 * these components instead of filtering them out.
 *
 * Drawn on the design system's tokens, so the same markup reads on a paper
 * section and inside a deep band (`data-surface="deep"` flips every alias).
 * Neither component holds state: `useTranslations` works in a Server Component
 * as well as a Client one, so both render wherever they are imported.
 */

interface MembersOnlyBadgeProps {
  className?: string;
}

export function MembersOnlyBadge({ className }: MembersOnlyBadgeProps) {
  const t = useTranslations("events");

  return (
    <Pill className={className} tone="warning">
      {t("card.membersOnly")}
    </Pill>
  );
}

interface MembersOnlyNoticeProps {
  isMember: boolean;
  /** Offer a sign-in link — only meaningful to visitors who are signed out. */
  showSignIn?: boolean;
}

export function MembersOnlyNotice({
  isMember,
  showSignIn = false,
}: MembersOnlyNoticeProps) {
  const t = useTranslations("events");

  if (isMember) {
    return (
      <p className="type-body-sm flex items-start gap-2 rounded-biso-sm border border-success/30 bg-success/10 p-4 text-ink">
        <BadgeCheck
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-success"
        />
        <span>{t("membersOnly.memberConfirmed")}</span>
      </p>
    );
  }

  return (
    <div className="rounded-biso-sm border border-warning/30 bg-warning/10 p-4">
      <p className="type-body-sm font-semibold text-ink">
        {t("membersOnly.title")}
      </p>
      <p className="type-body-sm mt-1 text-ink">
        {t("membersOnly.description")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link className={statusPanelPrimaryAction} href="/membership">
          {t("membersOnly.becomeMember")}
        </Link>
        {showSignIn ? (
          <Link
            className="type-body-sm text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/auth/login"
          >
            {t("membersOnly.signIn")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
