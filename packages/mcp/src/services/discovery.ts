/**
 * Public discovery.
 *
 * Everything here runs on the **anonymous** client, never the caller's. That is
 * the point: "would a signed-out visitor see this?" is then answered by
 * Appwrite applying `read("any")`, not by this package remembering to add a
 * status filter. A draft cannot leak through a public tool even if a filter
 * here were wrong, because the credential used has no way to read it.
 *
 * `pages` is the exception and is handled explicitly. That table has
 * `rowSecurity: false` and a table-level `read("any")` grant, so the anonymous
 * client *can* read an unpublished page document. Page discovery therefore
 * filters on `status` and `is_published` in code, and says so.
 *
 * Member-only material is never returned here. A benefit's redemption code, in
 * particular, is the thing a membership buys; public discovery returns the
 * description and whether it is member-only, never the code.
 */

import { Query } from "@repo/api";
import type {
  CampusBenefits,
  ContentTranslations,
  Events,
  News,
  Pages,
} from "@repo/api/types/appwrite";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel } from "../identity/campus";
import { fromAppwriteError, notFound } from "../runtime/errors";
import type { Projected } from "./row";

export type PublicLocale = "no" | "en";

export const PUBLIC_KINDS = [
  "events",
  "news",
  "jobs",
  "pages",
  "units",
  "benefits",
  "documents",
] as const;

export type PublicKind = (typeof PUBLIC_KINDS)[number];

export interface PublicItem {
  campusId: string | null;
  campusLabel: string;
  /** Domain-specific dates: event start, deadline, publication. */
  dates: Record<string, string | null>;
  id: string;
  kind: PublicKind;
  /** True when the item requires membership to use, not to see. */
  memberOnly: boolean;
  slug: string | null;
  summary: string | null;
  title: string | null;
  url: string | null;
}

export interface DiscoveryService {
  getPublicPage(input: { slug: string; locale: PublicLocale }): Promise<{
    slug: string;
    title: string;
    description: string | null;
    blocks: Array<{ id: string; type: string }>;
    publishedAt: string | null;
    url: string;
  }>;
  search(input: {
    kind: PublicKind;
    query?: string;
    campusId?: string;
    locale?: PublicLocale;
    /** Events only: restrict to events starting on or after this ISO date. */
    from?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: PublicItem[]; total: number; notes: string[] }>;
}

const SEARCH_SCAN = 100;

function pickTranslation(
  refs: unknown,
  locale: PublicLocale
): ContentTranslations | null {
  if (!Array.isArray(refs)) {
    return null;
  }
  const list = refs as ContentTranslations[];
  return (
    list.find((item) => item.locale === locale) ??
    list.find((item) => item.locale === "no") ??
    list[0] ??
    null
  );
}

function plainSummary(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return null;
  }
  const MAX = 240;
  return text.length > MAX ? `${text.slice(0, MAX)}…` : text;
}

export function createDiscoveryService(
  clients: BackendClients,
  links: { web(path: string): string }
): DiscoveryService {
  /** The anonymous client — never `clients.user`. */
  const db = clients.anonymous.db;

  async function searchEvents(input: {
    query?: string;
    campusId?: string;
    locale: PublicLocale;
    from?: string;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      Query.equal("status", "published"),
      Query.select([
        "$id",
        "slug",
        "campus_id",
        "start_date",
        "end_date",
        "location",
        "member_only",
        "registration_deadline",
        "translation_refs.*",
      ]),
      Query.orderAsc("start_date"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    if (input.from) {
      queries.push(Query.greaterThanEqual("start_date", input.from));
    }
    const result = await db.listRows<Events>("app", "events", queries);
    const rows = result.rows.map((row): PublicItem => {
      const translation = pickTranslation(row.translation_refs, input.locale);
      return {
        kind: "events",
        id: row.$id,
        title: translation?.title ?? null,
        summary:
          plainSummary(translation?.short_description) ??
          plainSummary(translation?.description),
        slug: row.slug ?? null,
        campusId: row.campus_id ?? null,
        campusLabel: campusLabel(row.campus_id),
        dates: {
          start: row.start_date ?? null,
          end: row.end_date ?? null,
          registrationDeadline: row.registration_deadline ?? null,
        },
        url: row.slug ? links.web(`/events/${row.slug}`) : null,
        memberOnly: row.member_only === true,
      };
    });
    return { rows, total: result.total };
  }

  async function searchNews(input: {
    campusId?: string;
    locale: PublicLocale;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      Query.equal("status", "published"),
      Query.select([
        "$id",
        "$createdAt",
        "slug",
        "campus_id",
        "author",
        "translation_refs.*",
      ]),
      Query.orderDesc("$createdAt"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    const result = await db.listRows<News>("app", "news", queries);
    const rows = result.rows.map((row): PublicItem => {
      const translation = pickTranslation(row.translation_refs, input.locale);
      return {
        kind: "news",
        id: row.$id,
        title: translation?.title ?? null,
        summary: plainSummary(translation?.description),
        slug: row.slug ?? null,
        campusId: row.campus_id ?? null,
        campusLabel: campusLabel(row.campus_id),
        dates: { published: row.$createdAt },
        url: row.slug ? links.web(`/news/${row.slug}`) : null,
        memberOnly: false,
      };
    });
    return { rows, total: result.total };
  }

  async function searchJobs(input: {
    campusId?: string;
    locale: PublicLocale;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      Query.equal("status", "published"),
      Query.select([
        "$id",
        "slug",
        "campus_id",
        "application_deadline",
        "translations.*",
      ]),
      Query.orderDesc("$updatedAt"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    const result = await db.listRows<
      Projected<{
        slug: string;
        campus_id: string;
        application_deadline: string | null;
        translations?: unknown;
      }>
    >("app", "jobs", queries);
    const rows = result.rows.map((row): PublicItem => {
      const translation = pickTranslation(row.translations, input.locale);
      return {
        kind: "jobs",
        id: row.$id,
        title: translation?.title ?? null,
        summary:
          plainSummary(translation?.short_description) ??
          plainSummary(translation?.description),
        slug: row.slug ?? null,
        campusId: row.campus_id ?? null,
        campusLabel: campusLabel(row.campus_id),
        dates: { applicationDeadline: row.application_deadline ?? null },
        url: row.slug ? links.web(`/jobs/${row.slug}`) : null,
        memberOnly: false,
      };
    });
    return { rows, total: result.total };
  }

  async function searchBenefits(input: {
    campusId?: string;
    locale: PublicLocale;
    limit: number;
    offset: number;
  }) {
    // National benefits apply everywhere, so a campus query must include
    // campus 5 alongside the requested campus — `resolveBenefitCampusIds`.
    const campusIds = resolveBenefitCampusIds(input.campusId ?? null);
    const result = await db.listRows<CampusBenefits>("app", "campus_benefits", [
      Query.equal("status", "published"),
      Query.equal("campus_id", campusIds),
      // Redemption columns are deliberately absent from the projection:
      // a code is what a membership buys and is never public.
      Query.select([
        "$id",
        "campus_id",
        "title_nb",
        "title_en",
        "teaser_nb",
        "teaser_en",
        "category",
        "partner_name",
        "is_member_only",
        "publish_start",
        "publish_end",
      ]),
      Query.orderDesc("$updatedAt"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ]);
    const rows = result.rows.map(
      (row): PublicItem => ({
        kind: "benefits",
        id: row.$id,
        title: input.locale === "en" ? row.title_en : row.title_nb,
        summary: plainSummary(
          input.locale === "en" ? row.teaser_en : row.teaser_nb
        ),
        slug: null,
        campusId: row.campus_id,
        campusLabel: campusLabel(row.campus_id),
        dates: {
          publishStart: row.publish_start ?? null,
          publishEnd: row.publish_end ?? null,
        },
        url: null,
        memberOnly: row.is_member_only !== false,
      })
    );
    return { rows, total: result.total };
  }

  async function searchUnits(input: {
    campusId?: string;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      Query.equal("active", true),
      Query.select(["$id", "Name", "campus_id", "slug", "type", "active"]),
      Query.orderAsc("Name"),
      // Over-fetch: `isPublicUnit` is a name rule that cannot be expressed as
      // an Appwrite filter, so the page is filtered afterwards.
      Query.limit(SEARCH_SCAN),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    const result = await db.listRows<
      Projected<{
        Name: string;
        campus_id: string;
        slug: string | null;
        type: string | null;
        active: boolean;
      }>
    >("app", "departments", queries);

    const visible = result.rows.filter((row) =>
      isPublicUnit({ Name: row.Name, active: row.active })
    );
    const page = visible.slice(input.offset, input.offset + input.limit);
    const rows = page.map(
      (row): PublicItem => ({
        kind: "units",
        id: row.$id,
        title: row.Name,
        summary: row.type,
        slug: row.slug,
        campusId: row.campus_id,
        campusLabel: campusLabel(row.campus_id),
        dates: {},
        url: row.slug ? links.web(`/units/${row.campus_id}/${row.slug}`) : null,
        memberOnly: false,
      })
    );
    return { rows, total: visible.length };
  }

  async function searchDocuments(input: {
    campusId?: string;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      Query.equal("status", "published"),
      Query.select([
        "$id",
        "title",
        "description",
        "category",
        "scope",
        "campus_id",
        "version",
        "language",
        "sharepoint_web_url",
      ]),
      Query.orderAsc("sort_order"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    const result = await db.listRows<
      Projected<{
        title: string;
        description: string | null;
        category: string;
        scope: string;
        campus_id: string | null;
        version: string | null;
        language: string | null;
        sharepoint_web_url: string;
      }>
    >("app", "documents", queries);
    const rows = result.rows.map(
      (row): PublicItem => ({
        kind: "documents",
        id: row.$id,
        title: row.title,
        summary: plainSummary(row.description),
        slug: null,
        campusId: row.campus_id,
        campusLabel: campusLabel(row.campus_id),
        dates: {},
        url: row.sharepoint_web_url,
        memberOnly: false,
      })
    );
    return { rows, total: result.total };
  }

  async function searchPages(input: {
    query?: string;
    campusId?: string;
    limit: number;
    offset: number;
  }) {
    const queries: string[] = [
      // Explicit, because `pages` has row security off and grants read("any"):
      // without this the anonymous client returns drafts too.
      Query.equal("status", "published"),
      Query.equal("visibility", "public"),
      Query.select(["$id", "slug", "campus_id", "translation_refs.*"]),
      Query.orderDesc("$updatedAt"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", [input.campusId]));
    }
    if (input.query?.trim()) {
      queries.push(Query.contains("slug", input.query.trim()));
    }
    const result = await db.listRows<Pages>("app", "pages", queries);
    const rows: PublicItem[] = [];
    for (const row of result.rows) {
      const refs = Array.isArray(row.translation_refs)
        ? row.translation_refs
        : [];
      // A page row can be published while a given locale's translation is not.
      const published = refs.find((item) => item.is_published);
      if (!published) {
        continue;
      }
      rows.push({
        kind: "pages",
        id: row.$id,
        title: published.title,
        summary: plainSummary(published.description),
        slug: row.slug ?? null,
        campusId: row.campus_id ?? null,
        campusLabel: campusLabel(row.campus_id),
        dates: { published: published.published_at },
        url: row.slug ? links.web(`/${row.slug}`) : null,
        memberOnly: false,
      });
    }
    return { rows, total: rows.length };
  }

  return {
    async search(input) {
      const locale = input.locale ?? "no";
      const notes: string[] = [];
      try {
        switch (input.kind) {
          case "events":
            return { ...(await searchEvents({ ...input, locale })), notes };
          case "news":
            if (input.query) {
              notes.push(
                "News is listed newest-first; the free-text term was not applied because the public news listing has no text index in this path."
              );
            }
            return { ...(await searchNews({ ...input, locale })), notes };
          case "jobs":
            if (input.query) {
              notes.push(
                "Vacancies are listed most-recently-updated first; the free-text term was not applied in the public path."
              );
            }
            return { ...(await searchJobs({ ...input, locale })), notes };
          case "benefits":
            notes.push(
              "Redemption codes and links are never included in public results."
            );
            return { ...(await searchBenefits({ ...input, locale })), notes };
          case "units":
            notes.push(
              "Operating ledgers and national governance rows are excluded: `departments` mirrors the accounting chart, so `active` is not a publication flag."
            );
            return { ...(await searchUnits(input)), notes };
          case "documents":
            return { ...(await searchDocuments(input)), notes };
          case "pages":
            notes.push(
              "Filtered to published pages with a published translation, in application code — the `pages` table grants read to anyone."
            );
            return { ...(await searchPages(input)), notes };
          default:
            return { rows: [], total: 0, notes };
        }
      } catch (error) {
        throw fromAppwriteError(error, {
          operation: `public search ${input.kind}`,
        });
      }
    },

    async getPublicPage(input) {
      let row: Pages | undefined;
      try {
        const result = await db.listRows<Pages>("app", "pages", [
          Query.equal("slug", input.slug),
          Query.equal("status", "published"),
          Query.select([
            "$id",
            "slug",
            "status",
            "visibility",
            "translation_refs.*",
          ]),
          Query.limit(1),
        ]);
        row = result.rows[0];
      } catch (error) {
        throw fromAppwriteError(error, { operation: "get public page" });
      }

      if (!row || row.visibility !== "public") {
        throw notFound(`No published public page at "${input.slug}".`, {
          slug: input.slug,
        });
      }

      const refs = Array.isArray(row.translation_refs)
        ? row.translation_refs
        : [];
      const translation =
        refs.find(
          (item) => item.locale === input.locale && item.is_published
        ) ?? refs.find((item) => item.is_published);

      if (!translation) {
        throw notFound(
          `Page "${input.slug}" exists but has no published translation.`,
          { slug: input.slug, locale: input.locale }
        );
      }

      // The PUBLISHED document (`puck_document`), never the draft.
      let blocks: Array<{ id: string; type: string }> = [];
      try {
        const parsed: unknown = JSON.parse(translation.puck_document ?? "null");
        const list = (parsed as { blocks?: unknown })?.blocks;
        if (Array.isArray(list)) {
          blocks = list.map((block) => {
            const record = block as Record<string, unknown>;
            return {
              id: typeof record.id === "string" ? record.id : "",
              type: typeof record.type === "string" ? record.type : "unknown",
            };
          });
        }
      } catch {
        blocks = [];
      }

      return {
        slug: row.slug ?? input.slug,
        title: translation.title,
        description: translation.description ?? null,
        blocks,
        publishedAt: translation.published_at,
        url: links.web(`/${row.slug ?? input.slug}`),
      };
    },
  };
}
