import { UNIT_CATEGORY_MESSAGE_KEYS } from "@repo/shared/utils/unit-categories";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { toPlainText } from "@/lib/content-text";
import type { UnitDetail } from "@/lib/data/units";

interface UnitStoryProps {
  boardCount: number;
  campusUnitCount: number;
  unit: UnitDetail;
}

/**
 * "About" plus the three facts that are actually known about every unit.
 *
 * No unit has written a description yet, so the fallback copy is not filler —
 * it is the copy this section ships with for nearly all of them. It says only
 * true, sourced things (campus, how many units share it, that the board below
 * runs this one) and points at the next action, rather than inventing the
 * "1000+ students reached" an older version rendered for every unit.
 *
 * The facts are a plain definition list on the page's own surface — no icon
 * tiles, which would only decorate three words.
 */
export async function UnitStory({
  unit,
  boardCount,
  campusUnitCount,
}: UnitStoryProps) {
  const [t, tCategory] = await Promise.all([
    getTranslations("units"),
    getTranslations("jobs"),
  ]);

  const body = toPlainText(unit.description);
  const hasOwnCopy = body.length > 0;

  const facts = [
    { label: t("detail.facts.campus"), value: unit.campusLabel ?? "—" },
    {
      label: t("detail.facts.category"),
      value: unit.category
        ? tCategory(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[unit.category]}`)
        : t("detail.facts.uncategorised"),
    },
    { label: t("detail.facts.board"), value: String(boardCount) },
  ];

  return (
    <Section tone="paper">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionHeading>
            {hasOwnCopy
              ? t("detail.about", { name: unit.name })
              : t("detail.aboutFallbackTitle")}
          </SectionHeading>
          <p className="type-body max-w-(--measure) text-ink">
            {hasOwnCopy
              ? body
              : t("detail.aboutFallback", {
                  campus: unit.campusLabel ?? "",
                  count: campusUnitCount,
                  name: unit.name,
                })}
          </p>
        </div>

        <dl className="divide-y divide-edge self-start rounded-biso-md border border-edge">
          {facts.map((fact) => (
            <div className="flex flex-col gap-1 px-5 py-4" key={fact.label}>
              <dt className="type-label text-ink-muted">{fact.label}</dt>
              <dd className="type-heading-card break-words text-ink">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
