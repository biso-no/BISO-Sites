import type { Locale } from "@repo/i18n/config";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

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
 * The board fetch and the sibling-unit count are independent, so they run
 * together, and each carries its own fallback so neither can fail the render.
 */
export async function UnitView({
  unit,
  locale,
}: {
  unit: UnitDetail;
  locale: Locale;
}) {
  const t = await getTranslations("units");

  // Every reader below throws rather than resolving empty on failure, so an
  // outage is never written into a cache entry as a genuine absence. The
  // fallbacks belong HERE, at the call site, where an empty result lives only
  // for this render: the page still comes up, and each section has a real
  // empty state. See the readers' own doc comments.
  const [board, siblings, news, products] = await Promise.all([
    cachedUnitBoard(unit.campusId, unit.id).catch(() => []),
    cachedPublicUnits(locale).catch(() => []),
    cachedUnitNews(unit.id, locale).catch(() => []),
    cachedUnitProducts(unit.id, locale).catch(() => []),
  ]);

  const campusUnitCount = siblings.filter(
    (sibling) => sibling.campusId === unit.campusId
  ).length;

  return (
    <>
      <UnitHero unit={unit} />

      <div className={`${SECTION_SHELL} space-y-16 py-12`}>
        <UnitStory
          boardCount={board.length}
          campusUnitCount={campusUnitCount}
          unit={unit}
        />

        <UnitBoardSection members={board} unitName={unit.name} />

        <UnitNews news={news} unitName={unit.name} />

        <UnitShop products={products} />

        <Card className="border-border/50 bg-linear-to-br from-brand-muted to-card p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-bold text-2xl text-foreground">
                {t("detail.join.title", { name: unit.name })}
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {t("detail.join.body")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button
                asChild
                className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white"
              >
                <Link href="/jobs">
                  {t("detail.join.primary")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/units?campus_id=${unit.campusId}`}>
                  {t("detail.join.secondary")}
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
