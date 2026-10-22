import type { MembershipTextItem } from "@repo/shared/utils/membership-texts";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/section";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { JoinLink } from "./join-link";

/**
 * The membership call to action, as a navy band.
 *
 * v1's "Join us" block, restyled: the same heading, pitch and member benefits,
 * and one action into `/membership`. Two things are deliberately not carried
 * over. The price cards printed fixed durations and prices from the message
 * bundle, while `/membership` now sells the live catalogue (current and next
 * season, read from the `memberships` table) — a static price here would be
 * the one on the site that can be wrong. And the benefit list appeared twice.
 * No icon tiles, no gradients, no scroll reveals.
 *
 * The page renders this for non-members only: the CTA is shown to someone who
 * can act on it, the same rule the header and the mobile drawer follow.
 *
 * The benefit lines are the «Bli med» spot editors manage in admin
 * (`membership_texts`); without saved lines they fall back to the bundle.
 */
export async function MembershipBand({
  items,
}: {
  /** Saved text from admin; null or missing keeps the built-in i18n text. */
  items?: MembershipTextItem[] | null;
}) {
  const t = await getTranslations("membership");
  const benefits = items?.length
    ? items.map((item) => item.title)
    : [
        t("benefits.categories.social.global"),
        t("benefits.categories.career.global"),
        t("benefits.categories.student.global"),
        t("benefits.categories.safety.global"),
        t("benefits.categories.business.global"),
      ];

  return (
    <Section className="border-edge border-t" id="join" tone="deep">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="type-label mb-3 text-ink-accent">{t("membership")}</p>
          <h2 className="type-display-sm break-words text-ink">
            {t("joinUs.join")} {t("joinUs.biso")}
          </h2>
          <p className="type-body mt-5 max-w-(--measure) text-ink-muted">
            {t("joinUs.subtitle")}
          </p>
          <div className="mt-8">
            <JoinLink className={statusPanelPrimaryAction}>
              {t("hero.ctas.join")}
            </JoinLink>
          </div>
        </div>
        <ul className="space-y-4">
          {benefits.map((benefit) => (
            <li
              className="type-body border-ink-accent border-l-2 pl-4 text-ink"
              key={benefit}
            >
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
