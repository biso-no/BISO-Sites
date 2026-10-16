import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { FeedSearch } from "@/components/ui/feed-search";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatRow } from "@/components/ui/stat-row";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { campusIdToSlug } from "@/lib/campus-scope";
import type { PublicUnit } from "@/lib/data/units";
import { UnitCard } from "./unit-card";

/**
 * The units directory.
 *
 * Data is main's: `cachedPublicUnits` reads `departments` (never the empty
 * department translation table), applies the public-visibility rule once for
 * every surface, and projects the display name. The page around it is the
 * redesign's: a navy header, real-count stats, and filters that are links, so
 * a filtered directory is a URL that survives a reload and can be shared.
 *
 * Every control is derived from the loaded units rather than from a static
 * list: a campus with no public unit, or a category nothing is tagged with,
 * would otherwise offer a chip that can only ever return an empty grid —
 * `<FilterChips>` then drops a row left with only "All". `departments.type` is
 * still empty on most rows, so the category row appears as units are triaged.
 *
 * "Read failed" and "nothing matched" are different states (#77): a failed
 * read renders the unavailable panel, never "0 units".
 */
export interface UnitsV2Props {
  /** The campus to show, or `null` for every campus. */
  campusId: string | null;
  /** The current query, with the legacy `campus_id` already folded in. */
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
  /** `null` when the directory could not be read. */
  units: PublicUnit[] | null;
}

const ALL = "all";

/**
 * Campus order for grouping and for the campus chips: `CAMPUS_SEGMENTS`
 * order, so National lands last instead of between Bergen and Oslo — the four
 * physical campuses are what a student is scanning for.
 */
const CAMPUS_ORDER = Object.keys(CAMPUS_SEGMENTS);

const byCampusThenName = (a: PublicUnit, b: PublicUnit) => {
  const campusDelta =
    CAMPUS_ORDER.indexOf(a.campusId) - CAMPUS_ORDER.indexOf(b.campusId);
  return campusDelta === 0 ? a.name.localeCompare(b.name, "nb") : campusDelta;
};

function matchesSearch(unit: PublicUnit, needle: string): boolean {
  if (!needle) {
    return true;
  }
  return `${unit.name} ${unit.campusLabel ?? ""} ${unit.summary ?? ""}`
    .toLowerCase()
    .includes(needle);
}

export async function UnitsV2({
  campusId,
  searchParams,
  searchQuery,
  units,
}: UnitsV2Props) {
  const [t, tCommon, tNav, tCategory] = await Promise.all([
    getTranslations("units"),
    getTranslations("common"),
    getTranslations("common.navigation"),
    // Shared with the jobs filter so a category is named the same everywhere.
    getTranslations("jobs"),
  ]);

  const header = (
    <PageHeader
      actions={
        <Link className={statusPanelPrimaryAction} href="/jobs">
          {t("hero.ctaPrimary")}
        </Link>
      }
      breadcrumbs={[
        { label: tCommon("breadcrumbs.home"), href: "/" },
        { label: tNav("links.units") },
      ]}
      eyebrow={t("hero.badge")}
      lede={t("hero.subtitle")}
      title={t("hero.title")}
    />
  );

  if (units === null) {
    return (
      <>
        {header}
        <Section tone="paper">
          <div className="max-w-(--measure) rounded-biso-md border border-edge p-8">
            <h2 className="type-heading-card text-ink">
              {t("list.unavailableTitle")}
            </h2>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t("list.unavailableBody")}
            </p>
          </div>
        </Section>
        <DirectoryCta />
      </>
    );
  }

  const all = units.slice().sort(byCampusThenName);
  const activeCampus = campusIdToSlug(campusId) ?? ALL;
  const categoryLabel = (category: UnitCategory | null) =>
    category
      ? tCategory(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[category]}`)
      : null;

  // Only the campuses and categories the loaded units actually carry.
  const presentCampuses = CAMPUS_ORDER.filter((id) =>
    all.some((unit) => unit.campusId === id)
  );
  const presentCategories = new Set(all.map((unit) => unit.category));

  const rawCategory =
    typeof searchParams.category === "string" ? searchParams.category : ALL;
  const activeCategory = parseUnitCategory(rawCategory) ?? ALL;

  const needle = searchQuery.trim().toLowerCase();
  const visible = all.filter(
    (unit) =>
      (campusId === null || unit.campusId === campusId) &&
      (activeCategory === ALL || unit.category === activeCategory) &&
      matchesSearch(unit, needle)
  );

  const campusOptions: FilterOption[] = [
    { value: ALL, label: tNav("allCampuses") },
    ...presentCampuses.map((id) => ({
      value: campusIdToSlug(id) ?? id,
      label: CAMPUS_SEGMENTS[id]?.label ?? id,
    })),
  ];
  const categoryOptions: FilterOption[] = [
    { value: ALL, label: t("list.categoryAll") },
    ...UNIT_CATEGORIES.filter((value) => presentCategories.has(value)).map(
      (value) => ({ value, label: categoryLabel(value) ?? value })
    ),
  ];

  // "All campuses" is written out as `?campus=all` rather than by dropping
  // the parameter: without it, the visitor's remembered campus would come
  // back (URL > cookie > all). `resolveRequestCampus` reads `all` as "every
  // campus", so the URL says what it shows on its own — the same rule the
  // header's switcher follows (`campusSwitchHref`). FilterChips drops the
  // parameter only for its `defaultValue`, which no option here uses.
  const campusDefault = "";

  // A search must not silently drop the filters already applied — the campus
  // scope included, for the same reason as the chips.
  const hidden: Record<string, string> = { campus: activeCampus };
  if (activeCategory !== ALL) {
    hidden.category = activeCategory;
  }

  const filtered =
    Boolean(needle) || campusId !== null || activeCategory !== ALL;
  const clearHref = `/units?campus=${ALL}`;

  // Group by campus only while the campus filter is off: with one campus
  // picked, every card would share one heading and the header becomes noise.
  const groups =
    campusId === null
      ? presentCampuses
          .map((id) => ({
            id,
            label: CAMPUS_SEGMENTS[id]?.label ?? id,
            units: visible.filter((unit) => unit.campusId === id),
          }))
          .filter((group) => group.units.length > 0)
      : [{ id: campusId, label: null, units: visible }];

  const cardLabels = (unit: PublicUnit) => ({
    category: categoryLabel(unit.category),
    noSummary: t("card.noSummary"),
  });

  // Both figures describe the whole directory, as the old page's stats did;
  // the result line below carries the filtered count.
  const stats = [
    { label: t("list.stats.units"), value: String(all.length) },
    { label: t("list.stats.campuses"), value: String(presentCampuses.length) },
  ];

  return (
    <>
      {header}

      <Section rhythm="none" tone="paper">
        <div className="border-edge border-b py-8">
          <StatRow stats={stats} />
        </div>
      </Section>

      <Section tone="paper">
        <div className="mb-8 space-y-4">
          <FeedSearch
            action="/units"
            defaultValue={searchQuery}
            hidden={hidden}
            label={t("list.searchLabel")}
            name="q"
            placeholder={t("list.searchPlaceholder")}
            submitLabel={t("list.searchSubmit")}
            surface="units"
          />
          <FilterChips
            active={activeCampus}
            basePath="/units"
            defaultValue={campusDefault}
            label={t("list.campusLabel")}
            options={campusOptions}
            param="campus"
            searchParams={searchParams}
          />
          <FilterChips
            active={activeCategory}
            basePath="/units"
            label={t("list.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={searchParams}
          />
        </div>

        <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <p className="type-body-sm text-ink-muted">
            {filtered
              ? t("list.headingFiltered", {
                  count: visible.length,
                  total: all.length,
                })
              : t("list.results", { count: visible.length })}
          </p>
          {filtered ? (
            <Link
              className="type-label text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={clearHref}
            >
              {t("list.clear")}
            </Link>
          ) : null}
        </div>

        {visible.length > 0 ? (
          <div className="space-y-12">
            {groups.map((group) => (
              <section
                aria-labelledby={group.label ? `units-${group.id}` : undefined}
                key={group.id}
              >
                {group.label ? (
                  <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2
                      className="type-heading-section text-ink"
                      id={`units-${group.id}`}
                    >
                      {group.label}
                    </h2>
                    <span className="type-data text-ink-muted">
                      {t("list.heading", { count: group.units.length })}
                    </span>
                  </div>
                ) : null}
                <CardGrid>
                  {group.units.map((unit) => (
                    <li className="min-w-0" key={unit.id}>
                      <UnitCard
                        // Under a campus heading the card is an h3; alone
                        // under the page's h1 it is the next level down.
                        headingLevel={group.label ? "h3" : "h2"}
                        labels={cardLabels(unit)}
                        // The campus is already the group heading, or the
                        // filter the visitor picked.
                        showCampus={false}
                        unit={unit}
                      />
                    </li>
                  ))}
                </CardGrid>
              </section>
            ))}
          </div>
        ) : (
          <div className="max-w-(--measure) rounded-biso-md border border-edge p-8">
            <h2 className="type-heading-card text-ink">
              {t("list.emptyTitle")}
            </h2>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t("list.emptyBody")}
            </p>
            <Link
              className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={clearHref}
            >
              {t("list.clear")}
            </Link>
          </div>
        )}
      </Section>

      <DirectoryCta />
    </>
  );
}

/** "Can't find your thing?" — main's closing call to action. */
async function DirectoryCta() {
  const t = await getTranslations("units");
  return (
    <Section className="border-edge border-t" tone="paper">
      <div className="flex flex-col gap-6 rounded-biso-md border border-edge p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-(--measure)">
          <h2 className="type-display-sm text-ink">{t("cta.title")}</h2>
          <p className="type-body mt-3 text-ink-muted">{t("cta.body")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Link className={statusPanelSecondaryAction} href="/contact">
            {t("cta.primary")}
          </Link>
          <Link className={statusPanelPrimaryAction} href="/jobs">
            {t("cta.secondary")}
          </Link>
        </div>
      </div>
    </Section>
  );
}
