import { getDynamicContent } from "../get-dynamic-content";
import type { DataSourceValue, EditorMetadata } from "./types";

export const resolvedDepartmentIdCache = new Map<string, string>();

export async function resolveDepartmentId(
  rawDepartmentId: string
): Promise<string> {
  const cached = resolvedDepartmentIdCache.get(rawDepartmentId);
  if (cached) {
    return cached;
  }

  try {
    // Prefer matching the "Id" (code) field, then fall back to "Name"
    const byCode = await getDynamicContent({
      table: "departments",
      limit: 1,
      filters: [{ field: "Id", operator: "equal", value: rawDepartmentId }],
    });
    const resolvedByCode = byCode[0]?.id;
    if (resolvedByCode) {
      resolvedDepartmentIdCache.set(rawDepartmentId, resolvedByCode);
      return resolvedByCode;
    }

    const byName = await getDynamicContent({
      table: "departments",
      limit: 1,
      filters: [{ field: "Name", operator: "equal", value: rawDepartmentId }],
    });
    const resolvedByName = byName[0]?.id;
    if (resolvedByName) {
      resolvedDepartmentIdCache.set(rawDepartmentId, resolvedByName);
      return resolvedByName;
    }
  } catch {
    // Ignore and fall back to raw ID
  }

  resolvedDepartmentIdCache.set(rawDepartmentId, rawDepartmentId);
  return rawDepartmentId;
}

export function mergeFilters(
  base: DataSourceValue["filters"] | undefined,
  extra: DataSourceValue["filters"] | undefined
): DataSourceValue["filters"] {
  const baseFilters = base ?? [];
  const extraFilters = extra ?? [];

  if (baseFilters.length === 0 && extraFilters.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const merged: DataSourceValue["filters"] = [];

  for (const filter of [...baseFilters, ...extraFilters]) {
    const key = `${filter.field}:${filter.operator}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(filter);
  }

  return merged;
}

export async function buildPageScopeFilters(
  table: "events" | "news" | "jobs" | "products",
  scope: "page" | "all" | undefined,
  metadata: EditorMetadata | undefined
): Promise<DataSourceValue["filters"]> {
  if (scope !== "page") {
    return [];
  }

  const campusId = metadata?.page?.campusId ?? null;
  const rawDepartmentId = metadata?.page?.departmentId ?? null;

  if (rawDepartmentId) {
    const departmentId = await resolveDepartmentId(rawDepartmentId);
    const departmentField =
      table === "products" ? "departmentId" : "department_id";
    return [{ field: departmentField, operator: "equal", value: departmentId }];
  }

  if (campusId) {
    return [{ field: "campus_id", operator: "equal", value: campusId }];
  }

  return [];
}

export const nokFormatter = new Intl.NumberFormat("no-NO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNokPrice(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${nokFormatter.format(value)} NOK`;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return `${nokFormatter.format(parsed)} NOK`;
    }
    return value;
  }

  return;
}

export function getMetaString(
  meta: Record<string, unknown>,
  key: string
): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

export function getMetaBoolean(
  meta: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = meta[key];
  return typeof value === "boolean" ? value : undefined;
}

export function normalizeSubtitle(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }

  if (value === "[object Object]") {
    return;
  }

  return value;
}

export function deriveJobSlug(
  meta: Record<string, unknown>,
  href: string
): string | undefined {
  const explicit = getMetaString(meta, "slug");
  if (explicit) {
    return explicit;
  }

  if (href.startsWith("/jobs/")) {
    return href.replace("/jobs/", "");
  }

  return;
}
