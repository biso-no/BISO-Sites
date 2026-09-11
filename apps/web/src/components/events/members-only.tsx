import { Badge } from "@repo/ui/components/ui/badge";
import { BadgeCheck, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * `member_only` limits who can JOIN an event, never who can SEE it. Every
 * public surface lists members-only events like any other and marks them with
 * these components instead of filtering them out.
 */

interface MembersOnlyBadgeProps {
  className?: string;
}

export function MembersOnlyBadge({ className = "" }: MembersOnlyBadgeProps) {
  const t = useTranslations("events");

  return (
    <Badge
      className={`flex w-fit items-center gap-1 border-0 bg-orange-500 text-white ${className}`}
    >
      <Users aria-hidden className="h-3 w-3" />
      {t("card.membersOnly")}
    </Badge>
  );
}

const NOTICE_TONES = {
  default:
    "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-50",
  onBrand: "border-white/25 bg-white/10 text-white",
} as const;

interface MembersOnlyNoticeProps {
  isMember: boolean;
  /** Offer a sign-in link — only meaningful to visitors who are signed out. */
  showSignIn?: boolean;
  /** `onBrand` for placement on the brand gradient, where text is white. */
  tone?: keyof typeof NOTICE_TONES;
}

export function MembersOnlyNotice({
  isMember,
  showSignIn = false,
  tone = "default",
}: MembersOnlyNoticeProps) {
  const t = useTranslations("events");
  const toneClass = NOTICE_TONES[tone];

  if (isMember) {
    return (
      <div
        className={`mb-4 flex items-start gap-2 rounded-lg border p-4 text-sm ${toneClass}`}
      >
        <BadgeCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t("membersOnly.memberConfirmed")}</span>
      </div>
    );
  }

  return (
    <div
      className={`mb-4 space-y-3 rounded-lg border p-4 text-sm ${toneClass}`}
    >
      <div className="flex items-start gap-2">
        <Users aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{t("membersOnly.title")}</p>
          <p>{t("membersOnly.description")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          className="inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 font-medium text-white transition-colors hover:bg-orange-600"
          href="/membership"
        >
          {t("membersOnly.becomeMember")}
        </Link>
        {showSignIn && (
          <Link
            className="font-medium underline underline-offset-4"
            href="/auth/login"
          >
            {t("membersOnly.signIn")}
          </Link>
        )}
      </div>
    </div>
  );
}
