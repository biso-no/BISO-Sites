"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Departments,
  Events,
  Jobs,
  News,
  Orders,
  Pages,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import { applyContentRelationshipScopeQueries } from "@/lib/content-authorization";
import {
  buildHitHref,
  canSearchDepartments,
  departmentScopeQueries,
  jobScopeQueries,
  type PaletteSearchHit,
  pickTitle,
} from "@/lib/palette-search-model";
import { canViewShopOperations, hasNavAccess } from "@/lib/roles";
import { applyScopeQueries } from "@/lib/utils/authorization";

const LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function searchJobs(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  // jobs' translation relationship key is `translations` (not translation_refs)
  const rows = await db.listRows<Jobs>("app", "jobs", [
    Query.select(["*", "translations.*"]),
    Query.search("translations.title", q),
    Query.limit(LIMIT),
    ...jobScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "jobs" as const,
    href: buildHitHref("jobs", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translations, row.$id),
  }));
}

async function searchEvents(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Events>("app", "events", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyContentRelationshipScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "events" as const,
    href: buildHitHref("events", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchNews(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<News>("app", "news", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyContentRelationshipScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "news" as const,
    href: buildHitHref("news", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchPages(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  // page_translations has no fulltext index — contains() does substring match
  const rows = await db.listRows<Pages>("app", "pages", [
    Query.select(["*", "translation_refs.*"]),
    Query.contains("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyContentRelationshipScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "pages" as const,
    href: buildHitHref("pages", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.$id),
  }));
}

async function searchDepartments(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Departments>("app", "departments", [
    Query.search("Name", q),
    Query.limit(LIMIT),
    ...departmentScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "departments" as const,
    href: buildHitHref("departments", row.$id),
    id: row.$id,
    subtitle: row.campus_id ?? null,
    title: row.Name,
  }));
}

async function searchProducts(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<WebshopProducts>("app", "webshop_products", [
    Query.select(["*", "translation_refs.*"]),
    Query.search("translation_refs.title", q),
    Query.limit(LIMIT),
    ...applyContentRelationshipScopeQueries(ctx),
  ]);
  return rows.rows.map((row) => ({
    group: "products" as const,
    href: buildHitHref("products", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: pickTitle(row.translation_refs, row.slug),
  }));
}

async function searchOrders(
  db: Db,
  ctx: UserAuthContext,
  q: string
): Promise<PaletteSearchHit[]> {
  const rows = await db.listRows<Orders>("app", "orders", [
    Query.or([
      Query.contains("buyer_name", q),
      Query.contains("buyer_email", q),
    ]),
    Query.limit(LIMIT),
    // orders is campus-scoped only (no department column)
    ...applyScopeQueries(ctx, { departmentField: null }),
  ]);
  return rows.rows.map((row) => ({
    group: "orders" as const,
    href: buildHitHref("orders", row.$id),
    id: row.$id,
    subtitle: row.status ?? null,
    title: row.buyer_name ?? row.buyer_email ?? row.$id,
  }));
}

export async function searchEverything(
  rawQuery: string
): Promise<PaletteSearchHit[]> {
  const ctx = await requireAuth();
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }
  // Private admin reads: the relationship scope filters inside each search
  // are the authorization boundary.
  const { db } = await createAdminClient();
  const hasDepartmentMembership = ctx.departmentTeamIds.length > 0;
  const hasDepartmentSearchAccess = canSearchDepartments(ctx);
  const canJobs = hasNavAccess(
    "portal.jobs",
    ctx.roles,
    hasDepartmentMembership
  );
  const canShop = hasNavAccess(
    "portal.shop",
    ctx.roles,
    hasDepartmentMembership
  );
  // Orders are an operational commerce surface — never shown to department
  // product authors.
  const canOrders = canViewShopOperations(ctx.roles);

  const tasks = [
    ...(canJobs ? [searchJobs(db, ctx, q)] : []),
    searchEvents(db, ctx, q),
    searchNews(db, ctx, q),
    searchPages(db, ctx, q),
    ...(hasDepartmentSearchAccess ? [searchDepartments(db, ctx, q)] : []),
    ...(canShop ? [searchProducts(db, ctx, q)] : []),
    ...(canOrders ? [searchOrders(db, ctx, q)] : []),
  ];
  const settled = await Promise.allSettled(tasks);
  // Failures degrade silently — search is additive, never blocking.
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
}
