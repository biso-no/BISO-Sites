import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";

/**
 * The "not a member yet?" note beside a product, for visitors who are not.
 *
 * No longer a Client Component: its only client code was a `router.push` to
 * `/shop?category=Membership`, a filter no product matches — memberships are
 * bought through `/membership/join` now, and `/shop/membership` 308s there. A
 * link to `/membership` is crawlable and goes where members-only events
 * already send the same reader. The name is kept so the product page's import
 * is unchanged.
 */
export function MemberCalloutClient() {
  const t = useTranslations("shop");

  return (
    <div className="rounded-biso-md border border-edge p-6">
      <h2 className="type-heading-card text-ink">{t("member.notMember")}</h2>
      <p className="type-body-sm mt-2 text-ink-muted">
        {t("member.joinIntro")}
      </p>
      <ul className="type-body-sm mt-3 list-disc space-y-1 ps-5 text-ink-muted">
        <li>{t("member.benefitDiscounts")}</li>
        <li>{t("member.benefitEvents")}</li>
        <li>{t("member.benefitPriority")}</li>
        <li>{t("member.benefitPartner")}</li>
      </ul>
      <p className="type-body-sm mt-3 text-ink-muted">
        {t("member.bestValue")}
      </p>
      <Link
        className={cn(statusPanelSecondaryAction, "mt-5 w-full justify-center")}
        href="/membership"
      >
        {t("member.becomeMember")}
      </Link>
    </div>
  );
}
