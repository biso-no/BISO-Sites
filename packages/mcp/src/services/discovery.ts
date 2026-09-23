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
import { parseRecruitmentVacancyMetadata } from "@repo/shared/types/recruitment";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel, NATIONAL_CAMPUS_ID } from "../identity/campus";
import { fromAppwriteError, notFound } from "../runtime/errors";
import { scanForward } from "../runtime/scan";
import { resolveDateFilter } from "./event-time";
import { releasedHeadline } from "./pages";
import type { Projected } from "./row";

export type PublicLocale = "no" | "en";

type UnitRow = Projected<{
  Name: string;
  campus_id: string;
  slug: string | null;
  type: string | null;
  active: boolean;
}>;

/** Rows fetched per round trip while scanning for publishable pages. */
const PAGE_SCAN_BATCH = 100;
/** Most rows one public page search will examine. */
const PAGE_SCAN_CEILING = 1000;
/** Most department rows one public unit search will examine. */
const UNIT_SCAN_CEILING = 1000;

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

/**
 * What happens to a free-text term, per kind.
 *
 * `biso_public_search` promises that `notes` says when the term was not
 * applied. Only `pages` applies one at all, and only against the slug; the rest
 * have no public text index on this path. Keeping the answer in one table means
 * a new kind cannot quietly inherit "say nothing".
 */
const TEXT_SEARCH_NOTE: Record<PublicKind, string | null> = {
  events:
    "Events are listed by start date; the free-text term was not applied, because the public events listing has no text index on this path.",
  news: "News is listed newest-first; the free-text term was not applied because the public news listing has no text index in this path.",
  jobs: "Vacancies are listed most-recently-updated first; the free-text term was not applied in the public path.",
  benefits:
    "Benefits are listed most-recently-updated first; the free-text term was not applied.",
  units:
    "Units are listed alphabetically; the free-text term was not applied. Narrow with `campusId` instead.",
  documents:
    "Documents are listed in their configured order; the free-text term was not applied.",
  pages:
    "The free-text term was matched against the page slug only, not against title or body.",
};

/**
 * The `campus_id` values a public feed should return for a selected campus.
 *
 * A port of `campusScopeIds` in `apps/web/src/lib/campus-scope.ts`, which is
 * the canonical rule and states it plainly: picking Bergen means Oslo's
 * content is not that visitor's business, but National content "rides along
 * with whichever campus is selected rather than disappearing behind the
 * filter". A bare equality filter therefore hides every organisation-wide
 * event, article and vacancy from a campus-scoped search — the same answers
 * the signed-out site shows.
 *
 * Ported rather than imported because the original lives in an app. Its own
 * doc names the three tables it applies to (`campus_id` is a required column
 * on `events`, `news` and `jobs`), which is why `units` and `pages` keep a
 * plain campus filter: a department belongs to one campus, and a page is
 * addressed by slug.
 */
function publicCampusScope(campusId: string): string[] {
  return campusId === NATIONAL_CAMPUS_ID
    ? [NATIONAL_CAMPUS_ID]
    : [campusId, NATIONAL_CAMPUS_ID];
}

export interface PublicItem {
  campusId: string | null;
  campusLabel: string;
  /**
   * Domain-specific dates: event start, deadline, publication. Stored UTC
   * instants, passed through unchanged; BISO schedules in Oslo wall-clock
   * time, so the tools that return these say which zone to render them in.
   */
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
    /**
     * Events only: restrict to events starting on or after this ISO date.
     * A bare `YYYY-MM-DD` is resolved against Oslo — see `event-time.ts`.
     */
    from?: string;
    limit: number;
    offset: number;
  }): Promise<{
    rows: PublicItem[];
    /**
     * Null when the count is genuinely unknown. Page search decides per row,
     * after the query, whether a locale is actually published, so a filtered
     * window's size is not the result's size.
     */
    total: number | null;
    /** Raw scan position to resume from; only page search sets it. */
    nextOffset?: number | null;
    notes: string[];
  }>;
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

/**
 * The published translation to present, preferring the requested locale.
 *
 * Distinct from `pickTranslation` because publication matters here: a page's
 * `no` translation can be published while its `en` one is not, and the fallback
 * must stay inside what is actually released. Falling straight back to "any
 * published" — rather than to "no" as `pickTranslation` does — keeps a page
 * that exists only in English discoverable.
 */
function pickPublishedTranslation<
  T extends { locale?: string | null; is_published?: boolean | null },
>(refs: readonly T[], locale: PublicLocale): T | undefined {
  return (
    refs.find((item) => item.locale === locale && item.is_published) ??
    refs.find((item) => item.is_published)
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
      // Collections and standalone events only — never an item inside a
      // collection. `buildEventQueries` in `apps/web/src/lib/data/queries.ts`
      // applies exactly this, including the defensive empty-string arm for
      // rows the admin editor may write as `""` rather than null. Without it a
      // collection's contents come back as independent results, duplicating
      // what the collection already represents and advertising links the
      // public listing does not have.
      Query.or([
        Query.equal("is_collection", true),
        Query.isNull("collection_id"),
        Query.equal("collection_id", ""),
      ]),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", publicCampusScope(input.campusId)));
    }
    if (input.from) {
      queries.push(
        Query.greaterThanEqual("start_date", resolveDateFilter(input.from))
      );
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
      queries.push(Query.equal("campus_id", publicCampusScope(input.campusId)));
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
    // A vacancy stays `published` after its deadline passes, so status alone is
    // not "open". `isRecruitmentVacancyOpen` in `@repo/shared` is the repo's
    // definition — published, and either deadline-less or not yet past — and
    // `apps/web` filters its signed-out vacancy list and sitemap by it. Public
    // discovery must agree, or an MCP client would offer visitors jobs they
    // cannot apply for and cannot find on the site.
    //
    // Expressed as a query rather than a post-filter so `total` and the cursor
    // stay truthful. The shared predicate also treats an unparseable deadline
    // as open; a datetime column cannot hold one, so the two agree in practice.
    const nowIso = new Date().toISOString();
    const queries: string[] = [
      Query.equal("status", "published"),
      Query.or([
        Query.isNull("application_deadline"),
        Query.greaterThanEqual("application_deadline", nowIso),
      ]),
      Query.select([
        "$id",
        "slug",
        "campus_id",
        "application_deadline",
        "metadata",
        "translations.*",
      ]),
      Query.orderDesc("$updatedAt"),
      Query.limit(input.limit),
      Query.offset(input.offset),
    ];
    if (input.campusId) {
      queries.push(Query.equal("campus_id", publicCampusScope(input.campusId)));
    }
    const result = await db.listRows<
      Projected<{
        slug: string;
        campus_id: string;
        application_deadline: string | null;
        metadata: string | null;
        translations?: unknown;
      }>
    >("app", "jobs", queries);
    // A members-only vacancy is advertised to everyone — `audience` does not
    // narrow the row read, deliberately, because seeing a role you could take
    // as a member is what sells the membership (`buildJobRowPermissions` in
    // `apps/admin` says so). The restriction is on *applying*, enforced at
    // submit time against live membership by `submitJobApplication` in
    // `apps/web`. That is `memberOnly`'s meaning here — required to use, not
    // to see — so a client can say so up front instead of letting a student
    // write an application that is refused on submit.
    //
    // `audience` lives in the `metadata` JSON column, parsed with the repo's
    // own schema; that parser falls back to defaults on a malformed blob
    // rather than throwing, so one bad row cannot take out public search.
    const rows = result.rows.map((row): PublicItem => {
      const translation = pickTranslation(row.translations, input.locale);
      const metadata = parseRecruitmentVacancyMetadata(row.metadata);
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
        memberOnly: metadata.audience === "members",
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
    //
    // Only when a campus was actually asked for, though. That helper answers
    // "which campuses does a member of campus X see", so it maps no campus to
    // national alone — correct for the member portal, which always has a campus
    // in hand, and wrong here: `campusId` is documented as an optional filter
    // and every other public kind lists across campuses without one.
    const campusFilter = input.campusId
      ? [Query.equal("campus_id", resolveBenefitCampusIds(input.campusId))]
      : [];
    const result = await db.listRows<CampusBenefits>("app", "campus_benefits", [
      Query.equal("status", "published"),
      ...campusFilter,
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
    const baseQueries: string[] = [
      Query.equal("active", true),
      Query.select(["$id", "Name", "campus_id", "slug", "type", "active"]),
      Query.orderAsc("Name"),
    ];
    if (input.campusId) {
      baseQueries.push(Query.equal("campus_id", [input.campusId]));
    }

    /**
     * `isPublicUnit` is a name rule — `departments` mirrors the accounting
     * chart, so `active` is not a publication flag — and no Appwrite filter can
     * express it. Reading one fixed window and filtering it locally made the
     * first 100 alphabetical rows the entire searchable universe: a unit after
     * them was unreachable at any offset, and `total` reported the size of that
     * one window as the whole result. Scan forward instead, so `limit` means
     * rows the caller actually gets and the cursor carries the raw position.
     */
    const scan = await scanForward<UnitRow, PublicItem>({
      ceiling: UNIT_SCAN_CEILING,
      batchSize: SEARCH_SCAN,
      limit: input.limit,
      offset: input.offset,
      read: (offset_, size) =>
        db.listRows<UnitRow>("app", "departments", [
          ...baseQueries,
          Query.limit(size),
          Query.offset(offset_),
        ]),
      accept: (row) => {
        if (!isPublicUnit({ Name: row.Name, active: row.active })) {
          return null;
        }
        return {
          kind: "units" as const,
          id: row.$id,
          title: row.Name,
          summary: row.type,
          slug: row.slug,
          campusId: row.campus_id,
          campusLabel: campusLabel(row.campus_id),
          dates: {},
          // `/units/<campus-segment>/<slug>`, never the campus id: the
          // public route resolves the segment with `campusSegmentToId`, which
          // answers null for "2" and 404s. `@repo/shared/utils/unit-urls` is
          // the repo's single definition of that convention and backs every
          // other producer of these links.
          url: (() => {
            const path = unitCanonicalPath({
              campusId: row.campus_id,
              slug: row.slug,
            });
            return path ? links.web(path) : null;
          })(),
          memberOnly: false,
        };
      },
    });

    // `total` is unknown rather than the window size, for the same reason as
    // the page search: publication is decided per row after the query.
    return { rows: scan.items, total: null, nextOffset: scan.nextOffset };
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
      // A campus filter must not hide the national documents — statutes and
      // organisation-wide policy — that the same signed-out visitor sees on
      // the public site. `listPublishedDocuments` in `apps/web` runs two
      // queries and merges them, and says why in its own comment: national
      // documents are "always shown regardless of campus filter", because
      // their visibility comes from `scope`, not from the campus selected.
      // Filtering on `campus_id` alone dropped every one of them.
      queries.push(
        Query.or([
          Query.equal("scope", ["national"]),
          Query.equal("campus_id", [input.campusId]),
        ])
      );
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

  /**
   * Title and description as the *published* document states them — and from
   * nowhere else.
   *
   * `page_translations.title` and `.description` are not safe to read on a
   * published page. `saveDraft` overwrites both from the draft's `meta` while
   * leaving `is_published` true (`services/pages.ts`), so on any published page
   * with edits in progress those columns hold unreleased copy. `puck_document`
   * is the released document by definition, and it carries the same `meta`, so
   * it is the only honest source for a public caller.
   *
   * There used to be a fallback to those columns for a page published before
   * `meta` was written, so it would not render with no title at all. That
   * fallback reopened the exact leak the rest of this function exists to
   * close, on precisely the rows where nobody would notice: a legacy page
   * whose released document has no `meta.title` served the *draft's* headline
   * to anonymous callers. An unreleased title is worse than no title, so a
   * document that does not state one is reported as not stating one. The
   * caller still gets the slug and the URL.
   *
   * Note that `apps/web` does the opposite and worse: `normalizeDoc` in
   * `@repo/api/page-builder` overlays `translation.title` **over** the
   * document's own meta for every page, so the live site shows unreleased
   * headlines on any published page with a saved draft. That is an app bug,
   * recorded as roadmap S10 — it is not a reason to copy it here, because
   * these tools are read by a model that will repeat what they say.
   */
  function publishedMeta(translation: {
    title?: string | null;
    description?: string | null;
    puck_document?: string | null;
  }): { title: string; description: string | null } {
    if (!translation.puck_document) {
      return releasedHeadline(undefined);
    }
    try {
      const parsed: unknown = JSON.parse(translation.puck_document);
      return releasedHeadline((parsed as { meta?: unknown })?.meta);
    } catch {
      return releasedHeadline(undefined);
    }
  }

  async function searchPages(input: {
    query?: string;
    campusId?: string;
    locale: PublicLocale;
    limit: number;
    offset: number;
  }) {
    const baseQueries: string[] = [
      // Explicit, because `pages` has row security off and grants read("any"):
      // without this the anonymous client returns drafts too.
      Query.equal("status", "published"),
      Query.equal("visibility", "public"),
      Query.select(["$id", "slug", "campus_id", "translation_refs.*"]),
      Query.orderDesc("$updatedAt"),
    ];
    if (input.campusId) {
      baseQueries.push(Query.equal("campus_id", [input.campusId]));
    }
    if (input.query?.trim()) {
      baseQueries.push(Query.contains("slug", input.query.trim()));
    }

    /**
     * A page row can be `published` while the locale's translation is not, and
     * that is decided per row after the query — so Appwrite's `limit`/`offset`
     * page over rows that may all drop out. Scan forward instead, exactly as
     * the staff `pages.list` does, so a window of parent-published-but-
     * translation-unpublished rows cannot hide the published pages behind it.
     */
    const scan = await scanForward<Pages, PublicItem>({
      ceiling: PAGE_SCAN_CEILING,
      batchSize: PAGE_SCAN_BATCH,
      limit: input.limit,
      offset: input.offset,
      read: (offset_, size) =>
        db.listRows<Pages>("app", "pages", [
          ...baseQueries,
          Query.limit(size),
          Query.offset(offset_),
        ]),
      accept: (row) => {
        const refs = Array.isArray(row.translation_refs)
          ? row.translation_refs
          : [];
        const published = pickPublishedTranslation(refs, input.locale);
        if (!published) {
          return null;
        }
        const meta = publishedMeta(published);
        return {
          kind: "pages" as const,
          id: row.$id,
          title: meta.title,
          summary: plainSummary(meta.description),
          slug: row.slug ?? null,
          campusId: row.campus_id ?? null,
          campusLabel: campusLabel(row.campus_id),
          dates: { published: published.published_at },
          url: row.slug ? links.web(`/${row.slug}`) : null,
          memberOnly: false,
        };
      },
    });
    const rows = scan.items;

    // `total` is unknown rather than `rows.length`: the latter reported the
    // size of one filtered window as if it were the whole result.
    return { rows, total: null, nextOffset: scan.nextOffset };
  }

  return {
    async search(input) {
      const locale = input.locale ?? "no";
      const notes: string[] = [];
      // Said once, for every kind. Two kinds used to warn and four dropped the
      // term in silence, under a summary that reads like the results match it.
      if (input.query?.trim()) {
        const note = TEXT_SEARCH_NOTE[input.kind];
        if (note) {
          notes.push(note);
        }
      }
      try {
        switch (input.kind) {
          case "events":
            return { ...(await searchEvents({ ...input, locale })), notes };
          case "news":
            return { ...(await searchNews({ ...input, locale })), notes };
          case "jobs":
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
            return { ...(await searchPages({ ...input, locale })), notes };
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
      const translation = pickPublishedTranslation(refs, input.locale);

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

      // Blocks already came from `puck_document`; the metadata has to as well,
      // or a published page with draft edits returns released blocks under an
      // unreleased title.
      const meta = publishedMeta(translation);

      return {
        slug: row.slug ?? input.slug,
        title: meta.title,
        description: meta.description,
        blocks,
        publishedAt: translation.published_at,
        url: links.web(`/${row.slug ?? input.slug}`),
      };
    },
  };
}
