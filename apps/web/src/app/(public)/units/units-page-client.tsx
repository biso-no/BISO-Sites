"use client";

import {
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { CAMPUS_SEGMENTS } from "@repo/shared/utils/unit-urls";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  ArrowRight,
  Building2,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";
import { AboutHero } from "@/components/about/about-hero";
import type { PublicUnit } from "@/lib/data/units";
import { UnitCard } from "./unit-card";

interface UnitsPageClientProps {
  initialCampusId: string | null;
  /** `null` means the read failed — distinct from "no units matched". */
  units: PublicUnit[] | null;
}

const SECTION_SHELL = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  transition: { duration: 0.5 },
  viewport: { once: true },
  whileInView: { opacity: 1, y: 0 },
} as const;

const ALL = "all";

/**
 * Campus order for the grouped listing.
 *
 * Taken from `CAMPUS_SEGMENTS` rather than sorted alphabetically, so National
 * lands last instead of between Bergen and Oslo — the four physical campuses
 * are what a student is scanning for.
 */
const CAMPUS_ORDER = Object.keys(CAMPUS_SEGMENTS);

const byCampusThenName = (a: PublicUnit, b: PublicUnit) => {
  const campusDelta =
    CAMPUS_ORDER.indexOf(a.campusId) - CAMPUS_ORDER.indexOf(b.campusId);
  return campusDelta === 0 ? a.name.localeCompare(b.name, "nb") : campusDelta;
};

export function UnitsPageClient({
  units,
  initialCampusId,
}: UnitsPageClientProps) {
  const t = useTranslations("units");
  const tCategory = useTranslations("jobs");

  const [search, setSearch] = useState("");
  const [campusId, setCampusId] = useState(initialCampusId ?? ALL);
  const [category, setCategory] = useState<string>(ALL);

  // 125 cards re-filter on every keystroke; deferring keeps the input itself
  // responsive without debouncing away the result.
  const deferredSearch = useDeferredValue(search);

  const all = useMemo(
    () => (units ?? []).slice().sort(byCampusThenName),
    [units]
  );

  /**
   * Campus options come from the loaded units, not from the campus table: a
   * campus with no public unit would otherwise offer a filter that can only
   * ever produce an empty grid.
   */
  const campusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const unit of all) {
      if (unit.campusLabel && !seen.has(unit.campusId)) {
        seen.set(unit.campusId, unit.campusLabel);
      }
    }
    return [...seen.entries()].sort(
      ([a], [b]) => CAMPUS_ORDER.indexOf(a) - CAMPUS_ORDER.indexOf(b)
    );
  }, [all]);

  /**
   * Same rule for types. `departments.type` is free text and currently null on
   * every row, so this list is empty and the control hides itself — showing a
   * taxonomy nothing is tagged with was the old page's worst filter.
   */
  const categoryOptions = useMemo(() => {
    const seen = new Set<UnitCategory>();
    for (const unit of all) {
      if (unit.category) {
        seen.add(unit.category);
      }
    }
    return [...seen];
  }, [all]);

  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return all.filter((unit) => {
      if (campusId !== ALL && unit.campusId !== campusId) {
        return false;
      }
      if (category !== ALL && unit.category !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return `${unit.name} ${unit.campusLabel ?? ""} ${unit.summary ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [all, campusId, category, deferredSearch]);

  /**
   * Group only when the campus filter is off. With a campus picked, every card
   * shares one heading and the group header becomes noise.
   */
  const groups = useMemo(() => {
    if (campusId !== ALL) {
      return [{ id: campusId, label: null, units: filtered }];
    }
    const buckets = new Map<string, PublicUnit[]>();
    for (const unit of filtered) {
      const bucket = buckets.get(unit.campusId) ?? [];
      bucket.push(unit);
      buckets.set(unit.campusId, bucket);
    }
    return [...buckets.entries()].map(([id, groupUnits]) => ({
      id,
      label: groupUnits[0]?.campusLabel ?? null,
      units: groupUnits,
    }));
  }, [campusId, filtered]);

  const hasFilters = Boolean(search) || campusId !== ALL || category !== ALL;
  const boardCampuses = campusOptions.length;

  const clearFilters = () => {
    setSearch("");
    setCampusId(ALL);
    setCategory(ALL);
  };

  return (
    <>
      <AboutHero
        breadcrumbs={[{ href: "/", label: "BISO" }, { label: t("hero.badge") }]}
        compact
        icon={<Building2 className="h-8 w-8 text-white" />}
        subtitle={t("hero.subtitle")}
        title={t("hero.title")}
      />

      <section className="py-10" id="about-content">
        <div className={SECTION_SHELL}>
          {units === null ? (
            <EmptyState
              body={t("list.unavailableBody")}
              title={t("list.unavailableTitle")}
            />
          ) : (
            <>
              <motion.div {...FADE_UP} className="mb-8 flex flex-wrap gap-3">
                <Stat
                  icon={Building2}
                  label={t("stats.units", { count: all.length })}
                />
                <Stat
                  icon={MapPin}
                  label={t("stats.campuses", { count: boardCampuses })}
                />
                <Button
                  asChild
                  className="ml-auto bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white shadow-md transition-transform hover:scale-[1.02]"
                >
                  <Link href="/jobs">
                    {t("hero.ctaPrimary")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>

              <Card className="sticky top-2 z-30 border-border/50 bg-card/95 p-4 shadow-sm backdrop-blur-md">
                <div
                  className={
                    categoryOptions.length > 0
                      ? "grid gap-3 md:grid-cols-3"
                      : "grid gap-3 md:grid-cols-2"
                  }
                >
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label={t("filters.searchLabel")}
                      className="pl-9"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("filters.searchPlaceholder")}
                      value={search}
                    />
                  </div>

                  <Select onValueChange={setCampusId} value={campusId}>
                    <SelectTrigger aria-label={t("filters.campusLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>
                        {t("filters.allCampuses")}
                      </SelectItem>
                      {campusOptions.map(([id, label]) => (
                        <SelectItem key={id} value={id}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {categoryOptions.length > 0 && (
                    <Select onValueChange={setCategory} value={category}>
                      <SelectTrigger aria-label={t("filters.categoryLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>
                          {t("filters.allCategories")}
                        </SelectItem>
                        {categoryOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {tCategory(
                              `filters.${UNIT_CATEGORY_MESSAGE_KEYS[value]}`
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {hasFilters && (
                  <div className="mt-3 flex items-center gap-2 border-border/60 border-t pt-3">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <Badge variant="secondary">
                      {t("list.headingFiltered", {
                        count: filtered.length,
                        total: all.length,
                      })}
                    </Badge>
                    <Button
                      className="ml-auto"
                      onClick={clearFilters}
                      size="sm"
                      variant="ghost"
                    >
                      {t("filters.clear")}
                    </Button>
                  </div>
                )}
              </Card>

              {filtered.length === 0 ? (
                <EmptyState
                  body={t("list.emptyBody")}
                  title={t("list.emptyTitle")}
                />
              ) : (
                <div className="mt-10 space-y-12">
                  {groups.map((group) => (
                    <section key={group.id}>
                      {group.label && (
                        <div className="mb-5 flex items-baseline gap-3">
                          <h2 className="font-bold text-foreground text-xl">
                            {group.label}
                          </h2>
                          <span className="text-muted-foreground text-sm">
                            {t("list.heading", { count: group.units.length })}
                          </span>
                        </div>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {group.units.map((unit, index) => (
                          <UnitCard index={index} key={unit.id} unit={unit} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="pb-20">
        <div className={SECTION_SHELL}>
          <motion.div {...FADE_UP}>
            <Card className="overflow-hidden border-border/50 bg-linear-to-br from-brand-muted to-card p-8 sm:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <h2 className="flex items-center gap-2 font-bold text-2xl text-foreground">
                    <Users className="h-6 w-6 text-brand" />
                    {t("cta.title")}
                  </h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {t("cta.body")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link href="/contact">{t("cta.primary")}</Link>
                  </Button>
                  <Button
                    asChild
                    className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white"
                  >
                    <Link href="/jobs">{t("cta.secondary")}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="mt-8 border-border/50 border-dashed bg-card/60 p-12 text-center">
      <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
      <h2 className="font-semibold text-foreground text-lg">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        {body}
      </p>
    </Card>
  );
}
