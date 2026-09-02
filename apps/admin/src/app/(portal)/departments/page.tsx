import type { Departments } from "@repo/api/types/appwrite";
import {
  parseUnitCategory,
  UNIT_CATEGORIES,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { resolveDepartmentsLanding } from "@/lib/departments";
import { ROLES } from "@/lib/roles";
import { listDepartments } from "../_actions/departments";
import { listCampuses } from "../_actions/lookups";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { STUDIO } from "../_components/studio";
import { UnitListCard } from "./_components/unit-list-card";
import { SyncDepartmentsButton } from "./sync-button";

/**
 * Filter values that are not a unit category. Every one of the 280 synced rows
 * currently has `type = null` and `logo = ""`, so triaging *what is missing* is
 * the primary job of this listing, not browsing an already-tidy taxonomy.
 */
const TRIAGE_FILTERS = ["uncategorised", "missing_logo"] as const;
type TriageFilter = (typeof TRIAGE_FILTERS)[number];
type DepartmentFilter = UnitCategory | TriageFilter | "all";

const isDepartmentFilter = (value: unknown): value is DepartmentFilter =>
  value === "all" ||
  (typeof value === "string" &&
    (UNIT_CATEGORIES.includes(value as UnitCategory) ||
      TRIAGE_FILTERS.includes(value as TriageFilter)));

const hasLogo = (department: Departments) => Boolean(department.logo?.trim());

function matchesFilter(
  department: Departments,
  filter: DepartmentFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "missing_logo") {
    return !hasLogo(department);
  }
  const category = parseUnitCategory(department.type);
  if (filter === "uncategorised") {
    return category === null;
  }
  return category === filter;
}

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const ctx = await requireNavAccess("portal.departments");
  const landing = resolveDepartmentsLanding(ctx);

  if (landing.kind === "forbidden") {
    notFound();
  }
  if (landing.kind === "redirect") {
    redirect(`/departments/${landing.departmentId}`);
  }

  const t = await getTranslations("adminPortal.departments");
  const { type: requestedFilter } = await searchParams;
  const filter: DepartmentFilter = isDepartmentFilter(requestedFilter)
    ? requestedFilter
    : "all";

  const [departments, campuses] = await Promise.all([
    listDepartments({ includeInactive: true, ids: landing.scopeIds }),
    listCampuses(),
  ]);

  const campusMap = new Map(campuses.map((c) => [c.$id, c.name]));
  const isGlobalAdmin = ctx.roles.includes(ROLES.GLOBAL_ADMIN);

  // Counts come from the FULL scoped set, not the filtered view, so the chips
  // keep reporting how much triage is left while one of them is active.
  const counts = new Map<DepartmentFilter, number>();
  counts.set("all", departments.length);
  for (const category of UNIT_CATEGORIES) {
    counts.set(category, 0);
  }
  counts.set("uncategorised", 0);
  counts.set("missing_logo", 0);
  for (const department of departments) {
    const category = parseUnitCategory(department.type);
    const key: DepartmentFilter = category ?? "uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!hasLogo(department)) {
      counts.set("missing_logo", (counts.get("missing_logo") ?? 0) + 1);
    }
  }

  const visible = departments.filter((department) =>
    matchesFilter(department, filter)
  );

  const chips: { key: DepartmentFilter; label: string }[] = [
    { key: "all", label: t("filters.all") },
    ...UNIT_CATEGORIES.map((category) => ({
      key: category as DepartmentFilter,
      label: t(`categories.${category}`),
    })),
    { key: "uncategorised", label: t("filters.uncategorised") },
    { key: "missing_logo", label: t("filters.missingLogo") },
  ];

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: STUDIO.ink3 }}>
          {t("filters.triageSummary", {
            missingLogo: counts.get("missing_logo") ?? 0,
            total: departments.length,
            uncategorised: counts.get("uncategorised") ?? 0,
          })}
        </p>
        {isGlobalAdmin && <SyncDepartmentsButton />}
      </div>

      <nav
        aria-label={t("filters.label")}
        className="mb-6 flex flex-wrap gap-2"
      >
        {chips.map((chip) => {
          const isActive = chip.key === filter;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-xs transition"
              href={
                chip.key === "all"
                  ? "/departments"
                  : `/departments?type=${chip.key}`
              }
              key={chip.key}
              style={{
                background: isActive ? STUDIO.ink : "rgba(255,255,255,0.55)",
                border: `0.5px solid ${isActive ? STUDIO.ink : STUDIO.rule2}`,
                color: isActive ? STUDIO.paper : STUDIO.ink2,
              }}
            >
              {chip.label}
              <span style={{ opacity: 0.7 }}>{counts.get(chip.key) ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<Building2 size={28} />}
          title={t("empty")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((dept) => {
            const category = parseUnitCategory(dept.type);
            return (
              <UnitListCard
                campusName={campusMap.get(dept.campus_id) ?? dept.campus_id}
                department={dept}
                key={dept.$id}
                labels={{
                  category: category ? t(`categories.${category}`) : null,
                  inactive: t("badges.inactive"),
                  members: t("fields.members"),
                  noCategory: t("badges.noCategory"),
                  noLogo: t("badges.noLogo"),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
