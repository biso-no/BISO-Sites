import type { Locale } from "@repo/i18n/config";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/ui/section";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { campusIdToSlug } from "@/lib/campus-scope";
import { cachedUnitBoard } from "@/lib/data/unit-board";
import {
  cachedPublicUnits,
  cachedUnitNews,
  cachedUnitProducts,
  type UnitDetail,
} from "@/lib/data/units";
import { UnitBoardSection } from "./unit-board-section";
import { UnitNews, UnitShop } from "./unit-feeds";
import { UnitHero } from "./unit-hero";
import { UnitStory } from "./unit-story";

/**
 * The default unit page — what a student sees when the unit has NOT built its
 * own page in the block editor.
 *
 * A published custom page still wins; the caller checks that first. This is
 * the page for the other ~124 units, so it is built to stand on its own rather
 * than to look like a placeholder: one scrolling document, server-rendered, no
 * tabs. Tabs hid the board (the single thing students come here for) behind a
 * click and kept it out of the crawlable HTML, and three of the four tabs were
 * empty for nearly every unit.
 *
 * Header → about and facts → board → news → shop → how to join. News and shop
 * render only when the unit has published something.
 */
export async function UnitView({
  unit,
  locale,
}: {
  unit: UnitDetail;
  locale: Locale;
}) {
  // Every reader below throws rather than resolving empty on failure, so an
  // outage is never written into a cache entry as a genuine absence. The
  // fallbacks belong HERE, at the call site, where an empty result lives only
  // for this render: the page still comes up, and each section has a real
  // empty state. See the readers' own doc comments.
  const [t, board, siblings, news, products] = await Promise.all([
    getTranslations("units"),
    cachedUnitBoard(unit.campusId, unit.id).catch(() => []),
    cachedPublicUnits(locale).catch(() => []),
    cachedUnitNews(unit.id, locale).catch(() => []),
    cachedUnitProducts(unit.id, locale).catch(() => []),
  ]);

  const campusUnitCount = siblings.filter(
    (sibling) => sibling.campusId === unit.campusId
  ).length;
  const campusSlug = campusIdToSlug(unit.campusId);

  return (
    <>
      <UnitHero unit={unit} />

      <UnitStory
        boardCount={board.length}
        campusUnitCount={campusUnitCount}
        unit={unit}
      />

      <UnitBoardSection members={board} unitName={unit.name} />

      <UnitNews locale={locale} news={news} unitName={unit.name} />

      <UnitShop products={products} />

      {/* How to join. A bordered panel on paper rather than a navy band: the
          footer directly below is navy, and the two would read as one block. */}
      <Section className="border-edge border-t" tone="paper">
        <div className="flex flex-col gap-6 rounded-biso-md border border-edge p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-(--measure)">
            <h2 className="type-display-sm break-words text-ink">
              {t("detail.join.title", { name: unit.name })}
            </h2>
            <p className="type-body mt-3 text-ink-muted">
              {t("detail.join.body")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link className={statusPanelPrimaryAction} href="/jobs">
              {t("detail.join.primary")}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              className={statusPanelSecondaryAction}
              href={campusSlug ? `/units?campus=${campusSlug}` : "/units"}
            >
              {t("detail.join.secondary")}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
