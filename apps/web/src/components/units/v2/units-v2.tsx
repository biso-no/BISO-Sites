import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  UNIT_CATEGORY_MESSAGE_KEYS,
} from "@repo/shared/utils/unit-categories";
import {
  CAMPUS_SEGMENTS,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatRow } from "@/components/ui/stat-row";
import { CAMPUS_SLUGS, campusIdToSlug } from "@/lib/campus-scope";
import type { CampusUnit } from "@/lib/data/campus-landing";
import { UnitSearch } from "./unit-search";

/**
 * The units index, rebuilt on the data that exists.
 *
 * **The page was empty.** It rendered "0 Enheter — Fant ingen enheter" and
 * `--` for all three stats, on a top-level nav destination, because
 * `getDepartments()` reads `content_translations` filtered to
 * `content_type = "department"` and **that table holds zero department rows**
 * — while `departments` holds 280, 141 of them active. Names, abbreviations
 * and slugs need no translation, so they are read from the department row.
 *
 * **PLACEHOLDER-010.** `logo`, `hero` and the per-unit description are null on
 * all 280 rows, and `department_board` is empty — so there is no unit imagery,
 * no descriptions and no member count. The old page offered an "Active members"
 * tile anyway; it was furniture. Everything here has a source.
 *
 * `type` was in that list until the admin unit-profile editor gave the column a
 * writer, so the category filter is back — but derived, never static: options
 * come from the values the loaded units actually carry, and `<FilterChips>`
 * renders nothing while that leaves only "All". A filter appears as the 280
 * rows are triaged and never shows a chip that returns an empty list.
 */
export interface UnitsV2Props {
  campusId: string | null;
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
  units: CampusUnit[];
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

  const needle = searchQuery.trim().toLowerCase();
  const searched = needle
    ? units.filter((unit) =>
        `${unit.name} ${unit.abbreviation ?? ""}`.toLowerCase().includes(needle)
      )
    : units;

  const rawCategory =
    typeof searchParams.category === "string" ? searchParams.category : "all";
  const activeCategory = parseUnitCategory(rawCategory) ?? "all";
  const visible =
    activeCategory === "all"
      ? searched
      : searched.filter(
          (unit) => parseUnitCategory(unit.type) === activeCategory
        );

  // Only the categories the loaded units carry, in the canonical order.
  const presentCategories = new Set(
    units.map((unit) => parseUnitCategory(unit.type)).filter(Boolean)
  );
  const categoryOptions: FilterOption[] = [
    { value: "all", label: t("list.categoryAll") },
    ...UNIT_CATEGORIES.filter((value) => presentCategories.has(value)).map(
      (value) => ({
        value,
        label: tCategory(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`),
      })
    ),
  ];

  const campusOptions: FilterOption[] = [
    { value: "all", label: tNav("allCampuses") },
    ...CAMPUS_SLUGS.map((slug) => ({
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
    })),
  ];

  const activeCampus = campusIdToSlug(campusId) ?? "all";
  // A search must not silently drop the filters already applied.
  const hidden: Record<string, string> = {};
  if (activeCampus !== "all") {
    hidden.campus = activeCampus;
  }
  if (activeCategory !== "all") {
    hidden.category = activeCategory;
  }

  // Two figures, both countable. The old page's third tile was "Active
  // members", and `department_board` has no rows at all.
  const stats = [
    { label: t("list.stats.units"), value: String(units.length) },
    {
      label: t("list.stats.campuses"),
      value: String(new Set(units.map((unit) => unit.campusId)).size),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("links.units") },
        ]}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />

      <Section rhythm="none" tone="paper">
        <div className="border-edge border-b py-8">
          <StatRow stats={stats} />
        </div>
      </Section>

      <Section tone="paper">
        <div className="mb-8 space-y-4">
          <UnitSearch
            defaultValue={searchQuery}
            hidden={hidden}
            label={t("list.searchLabel")}
            placeholder={t("list.searchPlaceholder")}
            submitLabel={t("list.searchSubmit")}
          />
          <FilterChips
            active={activeCampus}
            basePath="/units"
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

        <p className="type-body-sm mb-6 text-ink-muted">
          {t("list.results", { count: visible.length })}
        </p>

        {visible.length > 0 ? (
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((unit) => {
              const href = unit.slug
                ? unitCanonicalPath({
                    campusId: unit.campusId,
                    slug: unit.slug,
                  })
                : null;
              const campus = CAMPUS_SEGMENTS[unit.campusId]?.label;
              return (
                // `min-w-0` on the grid item too: a grid track defaults to
                // `min-width: auto`, so the longest unit name sets the track's
                // width no matter what the contents are allowed to do.
                <li
                  className="min-w-0 border-edge border-b py-2.5"
                  key={unit.id}
                >
                  {href ? (
                    <Link
                      className="group flex items-baseline justify-between gap-3 text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      href={href}
                    >
                      {/* Norwegian unit names are long unbroken compounds
                          ("DIGI-KOMM - Digital kommunikasjon og markedsf."),
                          and `min-w-0` alone only permits shrinking — without
                          a break opportunity the row still pushed the page 2px
                          wide at 320px. */}
                      <span className="type-body-sm min-w-0 break-words">
                        {unit.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {campus && activeCampus === "all" ? (
                          <span className="type-label text-ink-muted">
                            {campus}
                          </span>
                        ) : null}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70"
                        />
                      </span>
                    </Link>
                  ) : (
                    // No slug means no detail URL; a link here would 404.
                    <span className="type-body-sm text-ink">{unit.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div>
            <p className="type-heading-card text-ink">{t("list.emptyTitle")}</p>
            <Link
              className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/units"
            >
              {t("list.clear")}
            </Link>
          </div>
        )}
      </Section>
    </>
  );
}
