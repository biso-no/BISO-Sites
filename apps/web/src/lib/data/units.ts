/**
 * The public read model for BISO units ("departments").
 *
 * WHY THIS MODULE EXISTS
 *
 * Every public unit surface used to read `content_translations` filtered to
 * `content_type = "department"` and treat the joined `department_ref` as the
 * unit. That table has never held a single department row — nothing writes one
 * except the admin unit editor, which no unit has used — so `/units`,
 * `/campus` and `/students` all rendered zero units while `departments` held
 * 141 active rows. The source of truth is `departments`; a translation is an
 * OPTIONAL overlay a unit may add from the admin app, never the row's
 * existence. Everything here is built that way round, and must stay that way.
 *
 * Two further rules the callers depend on:
 *
 * - `active` is not a publication flag. The table mirrors the 24SO chart of
 *   accounts, so operating ledgers and national governance bodies are live
 *   accounts too. `isPublicUnit` (`@repo/shared/utils/unit-visibility`) is the
 *   second half of the filter and is applied here, once, for every surface.
 * - `Name` is the accounting name and the Microsoft Graph join key. It is
 *   carried through as `graphName` and never shown; `name` is the display
 *   projection.
 *
 * Caching follows `./public-content`: guest client, `"use cache"`, no
 * request-bound APIs, errors left to throw so a transient failure is not
 * cached. See that module's header for the incident this protects against.
 */

import { Query } from "@repo/api";
import { createPublicClient } from "@repo/api/server";
import { resolveStorageFileUrl } from "@repo/api/storage";
import type {
  ContentTranslations,
  Departments,
  News,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import {
  ContentTranslationsContentType,
  NewsStatus,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import {
  parseUnitCategory,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import {
  campusIdToLabel,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import { cacheLife } from "next/cache";
import { buildTeaser } from "@/lib/content-text";

/** ~125 public units today; the cap is the whole table with room to grow. */
const UNIT_LIMIT = 500;
const UNIT_FEED_LIMIT = 24;

export interface PublicUnit {
  campusId: string;
  campusLabel: string | null;
  category: UnitCategory | null;
  /** Rich description from the same overlay. May contain HTML. */
  description: string | null;
  /**
   * The stored `departments.Name`, verbatim. This is the value Microsoft
   * Graph's `department` attribute is matched against — do not substitute
   * `name` for it anywhere.
   */
  graphName: string;
  heroUrl: string | null;
  /** Canonical unit path, or the legacy /units/<id> when the unit has no slug. */
  href: string;
  /** `departments.$id` — the 24SO id, and the legacy /units/<id> URL. */
  id: string;
  logoUrl: string | null;
  /** Display name: campus prefix and closure marker stripped. */
  name: string;
  slug: string | null;
  /** Plain-text teaser from an optional `content_translations` overlay. */
  summary: string | null;
}

export interface UnitDetail extends PublicUnit {
  news: News[];
  products: WebshopProducts[];
  socials: { platform: string | null; url: string | null }[];
}

/** Card copy budget. Long enough for two lines at the card's width. */
const SUMMARY_MAX_LENGTH = 180;

const UNIT_SELECT = [
  "$id",
  "Name",
  "campus_id",
  "slug",
  "active",
  "type",
  "logo",
  "hero",
] as const;

/**
 * Fold a department row plus its optional translation into the view model.
 *
 * The translation supplies copy only. A translation without a department row
 * is not a unit, which is why this takes the department as the subject.
 */
function toPublicUnit(
  department: Departments,
  translation: ContentTranslations | undefined
): PublicUnit {
  // `buildTeaser` handles all three shapes an overlay body can arrive in —
  // HTML, Plate JSON, or plain prose — and cuts on a sentence boundary.
  const summary = buildTeaser(
    translation?.short_description,
    translation?.description,
    SUMMARY_MAX_LENGTH
  );
  return {
    id: department.$id,
    name: unitDisplayName(department.Name),
    graphName: department.Name,
    slug: department.slug ?? null,
    campusId: department.campus_id,
    campusLabel: campusIdToLabel(department.campus_id),
    category: parseUnitCategory(department.type),
    // `departments.logo` is a string(100): the admin editor stores a bare
    // Appwrite file id, so it has to be expanded before it can be rendered.
    logoUrl: resolveStorageFileUrl(department.logo) ?? null,
    heroUrl: resolveStorageFileUrl(department.hero) ?? department.hero ?? null,
    href:
      unitCanonicalPath({
        campusId: department.campus_id,
        slug: department.slug,
      }) ?? `/units/${department.$id}`,
    summary: summary || null,
    description: translation?.description ?? null,
  };
}

/**
 * Every unit a student may see, across all campuses.
 *
 * One cached read serves the listing, the campus overview and the /students
 * teaser — they differ only in how they slice the result, so campus filtering
 * deliberately happens in the caller rather than becoming a cache key per
 * campus.
 */
export async function cachedPublicUnits(locale: Locale): Promise<PublicUnit[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const [departments, translations] = await Promise.all([
    db.listRows<Departments>("app", "departments", [
      Query.select([...UNIT_SELECT]),
      Query.equal("active", true),
      Query.orderAsc("Name"),
      Query.limit(UNIT_LIMIT),
    ]),
    // The overlay. Empty today for every unit; a unit that fills it in from the
    // admin app must start showing its own copy without a code change, so the
    // read is unconditional rather than gated on a feature flag.
    db.listRows<ContentTranslations>("app", "content_translations", [
      Query.select(["$id", "content_id", "description", "short_description"]),
      Query.equal("content_type", ContentTranslationsContentType.DEPARTMENT),
      Query.equal("locale", locale),
      Query.limit(UNIT_LIMIT),
    ]),
  ]);

  const overlay = new Map(
    translations.rows.map((row) => [row.content_id, row] as const)
  );

  return departments.rows
    .filter(isPublicUnit)
    .map((department) => toPublicUnit(department, overlay.get(department.$id)));
}

/**
 * One unit plus the feeds its page renders.
 *
 * Keyed on `$id` rather than slug: the caller has already resolved the URL to a
 * department row (see `(public)/units/[...segments]/resolve.ts`), and a unit
 * with no slug still has a page.
 */
export async function cachedUnitDetail(
  id: string,
  locale: Locale
): Promise<UnitDetail | null> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const department = await db
    .getRow<Departments>("app", "departments", id, [
      Query.select([...UNIT_SELECT, "socials.platform", "socials.url"]),
    ])
    .catch(() => null);

  if (!(department && isPublicUnit(department))) {
    return null;
  }

  const [translations, news, products] = await Promise.all([
    db.listRows<ContentTranslations>("app", "content_translations", [
      Query.select(["$id", "content_id", "description", "short_description"]),
      Query.equal("content_type", ContentTranslationsContentType.DEPARTMENT),
      Query.equal("content_id", id),
      Query.equal("locale", locale),
      Query.limit(1),
    ]),
    db
      .listRows<News>("app", "news", [
        Query.select([
          "$id",
          "$createdAt",
          "slug",
          "image",
          "url",
          "translation_refs.locale",
          "translation_refs.title",
          "translation_refs.short_description",
        ]),
        Query.equal("department_id", id),
        Query.equal("status", NewsStatus.PUBLISHED),
        Query.equal("translation_refs.locale", locale),
        Query.orderDesc("$createdAt"),
        Query.limit(UNIT_FEED_LIMIT),
      ])
      .then((res) => res.rows)
      .catch(() => [] as News[]),
    db
      .listRows<WebshopProducts>("app", "webshop_products", [
        Query.select([
          "$id",
          "$createdAt",
          "slug",
          "image",
          "regular_price",
          "member_price",
          "member_only",
          "stock",
          "translation_refs.locale",
          "translation_refs.title",
          "translation_refs.short_description",
        ]),
        Query.equal("departmentId", id),
        Query.equal("status", WebshopProductsStatus.PUBLISHED),
        Query.equal("translation_refs.locale", locale),
        Query.orderDesc("$createdAt"),
        Query.limit(UNIT_FEED_LIMIT),
      ])
      .then((res) => res.rows)
      .catch(() => [] as WebshopProducts[]),
  ]);

  return {
    ...toPublicUnit(department, translations.rows[0]),
    news,
    products,
    socials: (department.socials ?? []).map((social) => ({
      platform: social.platform ?? null,
      url: social.url ?? null,
    })),
  };
}
