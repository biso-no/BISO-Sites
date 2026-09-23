/**
 * Content reads and lifecycle transitions.
 *
 * Search here fixes four semantics the admin assistant gets wrong:
 *
 * 1. **`limit` is honoured.** The assistant's schema declares one and its route
 *    adapter destructures `{ domain, query, status }`, dropping it. Every list
 *    below is bounded and paginated.
 * 2. **The search term is applied to every domain.** The adapter passes `query`
 *    for jobs/events/products, passes `q: ""` for benefits, and ignores it for
 *    news/pages/documents. Here it is applied uniformly — through
 *    `content_translations` for the domains whose text lives there, and against
 *    the row's own columns for the domains where it does not.
 * 3. **One result shape.** The adapter returns `.rows` for two domains and the
 *    raw action result for the rest.
 * 4. **Scope is reported.** Every result says what it was filtered to, so an
 *    empty list is never mistaken for an empty database.
 */

import type { Models } from "@repo/api";
import { ID, Query } from "@repo/api";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { BackendClients } from "../appwrite/clients";
import { campusLabel } from "../identity/campus";
import type { Principal } from "../identity/principal";
import { isAnonymous } from "../identity/principal";
import {
  assertPublishAccess,
  assertWriteAccess,
  canReadRow,
  describeScope,
  rowOwnership,
  scopeQueries,
} from "../identity/scope";
import {
  DomainError,
  forbidden,
  fromAppwriteError,
  notFound,
} from "../runtime/errors";
import { stripSensitive } from "../runtime/redact";
import {
  type AppliedScope,
  buildPagination,
  type Pagination,
} from "../runtime/result";
import {
  type ContentDomain,
  type ContentDomainSpec,
  domainSpec,
} from "./content-registry";
import { resolveDateFilter } from "./event-time";
import {
  buildContentRowPermissions,
  buildTranslationRowPermissions,
} from "./permissions";
import type { Projected } from "./row";

/** Appwrite's fulltext indexes cap what a search term can usefully be. */
/**
 * Ceiling on translation rows touched by one lifecycle change. A content row
 * has one translation per locale (`uniq_content_locale` enforces it), so this
 * is far above any real row and exists only to keep the write bounded.
 */
const TRANSLATION_SYNC_LIMIT = 25;

const MAX_SEARCH_TERM = 120;
/** How many translation rows to scan when resolving a text search. */
const TRANSLATION_SCAN_LIMIT = 200;
/** Appwrite rejects queries over ~4096 chars; keep id lists well under it. */
const MAX_ID_BATCH = 90;

export type ContentLocale = "no" | "en";

export interface ContentSearchInput {
  campusId?: string;
  departmentId?: string;
  domain: ContentDomain;
  limit: number;
  locale?: ContentLocale;
  offset: number;
  /**
   * Newest-first by default, by `$updatedAt`.
   *
   * `"oldest"` exists for the staleness probe in the campus briefing: with a
   * `limit`, newest-first discards precisely the rows a staleness check is
   * looking for. `"date"` orders by the domain's own date column ascending —
   * `start_date` for events — which is what a "what is coming up" probe needs:
   * ordering those by edit time takes the 25 most recently *touched* events,
   * not the 25 starting soonest, so an imminent event nobody has edited drops
   * out of the window entirely.
   */
  order?: "newest" | "oldest" | "date";
  /** Free-text term matched against the domain's title/description. */
  query?: string;
  status?: string;
  /**
   * ISO date; only rows whose primary date is on/after this. A bare
   * `YYYY-MM-DD` is resolved against Oslo — see `event-time.ts`.
   */
  updatedSince?: string;
}

export interface ContentSummary {
  campusId: string | null;
  campusLabel: string;
  createdAt: string;
  departmentId: string | null;
  domain: ContentDomain;
  /** Domain-specific columns from `summaryColumns`. */
  fields: Record<string, unknown>;
  id: string;
  links: Record<string, string>;
  /** Which locales have a translation row, for the domains that have them. */
  locales: ContentLocale[];
  slug: string | null;
  status: string | null;
  title: string | null;
  updatedAt: string;
}

export interface ContentSearchResult {
  pagination: Pagination;
  rows: ContentSummary[];
  scope: AppliedScope;
  warnings: string[];
}

export interface ContentDetail extends ContentSummary {
  /**
   * Every non-sensitive column on the row, or `null` when the caller does not
   * own it.
   *
   * A published row is readable by anyone, so this getter lets one through
   * without a campus check. That is right for *published content* and wrong
   * for the whole row: `stripSensitive` is a denylist, so everything not named
   * in it — an event's join link and contact address, a product's ledger
   * account, a sync id — comes back too. Those are operational columns the
   * public site never renders, and publication is not consent to expose them.
   *
   * So the raw row is for owners. A publication-authorized caller still gets
   * `fields`, which is the curated per-domain projection, plus the
   * translations, links and dates — everything a public reader would see.
   */
  raw: Record<string, unknown> | null;
  /** `$updatedAt`, for optimistic concurrency on a later write. */
  revision: string;
  translations: Array<{
    locale: string;
    title: string | null;
    description: string | null;
    shortDescription: string | null;
  }>;
  /** Non-fatal notes, e.g. that `raw` was withheld. */
  warnings: string[];
}

type Row = Models.Row & Record<string, unknown>;

export interface ContentService {
  /** Create a draft row plus its translation rows. */
  createDraft(
    principal: Principal,
    input: CreateDraftInput
  ): Promise<{ id: string; slug: string; revision: string }>;
  get(
    principal: Principal,
    domain: ContentDomain,
    id: string
  ): Promise<ContentDetail>;
  search(
    principal: Principal,
    input: ContentSearchInput
  ): Promise<ContentSearchResult>;
  /**
   * Change a row's publication status.
   *
   * Authorization has already run in the tool layer; this performs the write.
   * The row is re-read here regardless, so the status change is applied to the
   * ownership the backend currently reports rather than to whatever the caller
   * saw earlier.
   */
  setStatus(
    principal: Principal,
    domain: ContentDomain,
    id: string,
    status: string,
    expectedRevision: string | null
  ): Promise<{ id: string; status: string; revision: string }>;
}

export interface CreateDraftInput {
  campusId: string;
  departmentId: string | null;
  domain: ContentDomain;
  /** Domain-specific extra columns, already validated by the tool layer. */
  extra?: Record<string, unknown>;
  slug: string;
  translations: Array<{
    locale: ContentLocale;
    title: string;
    description: string;
    shortDescription?: string;
  }>;
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Pick the title for a row.
 *
 * The domains differ: `content_translations` children, inline `title_nb`
 * columns, or a plain `title`. Returning `null` rather than "Untitled" keeps
 * "this row has no title in this locale" distinguishable from a real title.
 */
function resolveTitle(
  spec: ContentDomainSpec,
  row: Row,
  locale: ContentLocale
): string | null {
  if (spec.translations.kind === "content_translations") {
    const refs = row[spec.translations.relationship];
    if (Array.isArray(refs)) {
      const list = refs as ContentTranslations[];
      const match =
        list.find((item) => item.locale === locale) ??
        list.find((item) => item.locale === "no") ??
        list[0];
      return textOf(match?.title);
    }
    return null;
  }
  if (spec.translations.kind === "inline_columns") {
    return locale === "en"
      ? (textOf(row.title_en) ?? textOf(row.title_nb))
      : (textOf(row.title_nb) ?? textOf(row.title_en));
  }
  return textOf(row.title);
}

function resolveLocales(spec: ContentDomainSpec, row: Row): ContentLocale[] {
  if (spec.translations.kind === "content_translations") {
    const refs = row[spec.translations.relationship];
    if (Array.isArray(refs)) {
      const out: ContentLocale[] = [];
      for (const item of refs as ContentTranslations[]) {
        if (item.locale === "no" || item.locale === "en") {
          out.push(item.locale);
        }
      }
      return out;
    }
    return [];
  }
  if (spec.translations.kind === "inline_columns") {
    const locales: ContentLocale[] = [];
    if (textOf(row.title_nb)) {
      locales.push("no");
    }
    if (textOf(row.title_en)) {
      locales.push("en");
    }
    return locales;
  }
  return [];
}

function pickFields(
  spec: ContentDomainSpec,
  row: Row
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of spec.summaryColumns) {
    if (column in row) {
      out[column] = row[column];
    }
  }
  return out;
}

/**
 * The per-locale text for a detail read, by whichever route the domain stores
 * it.
 *
 * Extracted from `get` so that the authorization decision above it reads as one
 * sequence rather than being separated from its result by thirty lines of
 * text-shaping.
 */
function detailTranslations(
  spec: ContentDomainSpec,
  row: Row
): ContentDetail["translations"] {
  if (spec.translations.kind === "content_translations") {
    const refs = row[spec.translations.relationship];
    if (!Array.isArray(refs)) {
      return [];
    }
    return (refs as ContentTranslations[]).map((item) => ({
      locale: item.locale,
      title: textOf(item.title),
      description: textOf(item.description),
      shortDescription: textOf(item.short_description),
    }));
  }
  if (spec.translations.kind === "inline_columns") {
    return [
      {
        locale: "no",
        title: textOf(row.title_nb),
        description: textOf(row.description_nb),
        shortDescription: textOf(row.teaser_nb),
      },
      {
        locale: "en",
        title: textOf(row.title_en),
        description: textOf(row.description_en),
        shortDescription: textOf(row.teaser_en),
      },
    ];
  }
  return [];
}

function toSummary(
  spec: ContentDomainSpec,
  row: Row,
  locale: ContentLocale,
  links: { web(path: string): string; admin(path: string): string }
): ContentSummary {
  const ownership = rowOwnership(row as never, { legacyFallback: true });
  const slug = textOf(row.slug);
  const built: Record<string, string> = {
    admin: links.admin(spec.adminPath(row.$id)),
  };
  if (slug && spec.publicPath) {
    built.public = links.web(spec.publicPath(slug));
  }
  return {
    id: row.$id,
    domain: spec.domain,
    title: resolveTitle(spec, row, locale),
    status: textOf(row.status),
    campusId: ownership.campusId,
    campusLabel: campusLabel(ownership.campusId),
    departmentId: ownership.departmentId,
    slug,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
    locales: resolveLocales(spec, row),
    fields: pickFields(spec, row),
    links: built,
  };
}

/** Translate `ContentSearchInput["order"]` into the Appwrite ordering. */
function orderQuery(
  domain: ContentDomain,
  order: ContentSearchInput["order"]
): string {
  if (order === "date") {
    return Query.orderAsc(primaryDateField(domain));
  }
  if (order === "oldest") {
    return Query.orderAsc("$updatedAt");
  }
  return Query.orderDesc("$updatedAt");
}

/** The date column a domain's `updatedSince` filter should use. */
function primaryDateField(domain: ContentDomain): string {
  if (domain === "events") {
    return "start_date";
  }
  return "$updatedAt";
}

/** What a translation scan found, and whether it saw everything. */
interface TextMatch {
  ids: string[];
  /**
   * True when more translations matched than the scan read.
   *
   * Separate from "more ids than one query can carry" (`MAX_ID_BATCH`), and it
   * has to be, because the locale filter below can shrink a truncated scan to
   * a handful of ids. A caller that only checked the id count would then be
   * told a partial search was complete.
   */
  truncated: boolean;
}

/**
 * Resolve a free-text search to a set of row ids via `content_translations`.
 *
 * The translation table carries fulltext indexes on `title` and `description`
 * and a `content_type` discriminator, which is what makes a cross-domain text
 * search possible at all. Rows whose text lives on the row itself
 * (benefits, documents) do not come through here.
 */
async function idsMatchingText(
  clients: BackendClients,
  spec: ContentDomainSpec,
  term: string,
  locale: ContentLocale
): Promise<TextMatch | null> {
  if (spec.translations.kind !== "content_translations") {
    return null;
  }
  const { contentType } = spec.translations;
  try {
    const result = await clients.user.db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", contentType),
        Query.or([
          Query.search("title", term),
          Query.search("description", term),
        ]),
        Query.select(["content_id", "locale"]),
        Query.limit(TRANSLATION_SCAN_LIMIT),
      ]
    );
    // Prefer rows in the requested locale. Falling back to every match when
    // none exist keeps a search from going empty just because the term only
    // appears in the other language — but when the locale *does* match,
    // returning all rows would surface a parent whose Norwegian text contains
    // the term while its English text does not.
    const preferred = result.rows.filter((row) => row.locale === locale);
    const source = preferred.length > 0 ? preferred : result.rows;
    return {
      ids: [...new Set(source.map((row) => row.content_id))],
      // Truncation is "the scan filled its window", not "total exceeds the
      // page". Reading `total` here would depend on it being the filtered
      // match count, which `apps/web/src/lib/data/queries.ts` disputes — see
      // `inboxCounts` in `./operations.ts`. A full window is the same answer
      // under either reading.
      truncated: result.rows.length === TRANSLATION_SCAN_LIMIT,
    };
  } catch (error) {
    throw fromAppwriteError(error, {
      operation: `search ${spec.domain} translations`,
    });
  }
}

/** Columns on the row itself that a text search should match. */
const INLINE_SEARCH_COLUMNS: Partial<Record<ContentDomain, readonly string[]>> =
  {
    benefits: ["title_nb", "title_en", "partner_name"],
    documents: ["title"],
    pages: ["slug"],
  };

/**
 * Push a free-text filter onto the query, by whichever route the domain has.
 *
 * Returns `"no_matches"` when the term resolved to an empty id set, so the
 * caller can short-circuit rather than issuing a query it knows returns
 * nothing (and rather than issuing one with no id filter at all, which would
 * silently return everything).
 */
async function applyTextFilter(input: {
  clients: BackendClients;
  locale: ContentLocale;
  queries: string[];
  spec: ContentDomainSpec;
  term: string;
  warnings: string[];
}): Promise<"applied" | "no_matches" | "unavailable"> {
  const { clients, spec, term, locale, queries, warnings } = input;

  const inlineColumns = INLINE_SEARCH_COLUMNS[spec.domain];
  if (inlineColumns) {
    queries.push(
      Query.or(inlineColumns.map((column) => Query.contains(column, term)))
    );
    return "applied";
  }

  const match = await idsMatchingText(clients, spec, term, locale);
  if (match === null) {
    warnings.push(
      `Text search is not available for ${spec.domain}; the term was ignored.`
    );
    return "unavailable";
  }
  const { ids } = match;
  if (match.truncated) {
    warnings.push(
      `More than ${TRANSLATION_SCAN_LIMIT} translations matched "${term}"; only the first ${TRANSLATION_SCAN_LIMIT} were scanned, so matching ${spec.domain} may be missing from these results. Narrow the term for complete results.`
    );
  }
  if (ids.length === 0) {
    return "no_matches";
  }
  if (ids.length > MAX_ID_BATCH) {
    warnings.push(
      `The search term matched ${ids.length} items; only the first ${MAX_ID_BATCH} were considered. Narrow the term for complete results.`
    );
  }
  queries.push(Query.equal("$id", ids.slice(0, MAX_ID_BATCH)));
  return "applied";
}

/**
 * The error for a lifecycle change whose parent row committed and whose
 * translation permissions did not.
 *
 * The write order is deliberate and stays: publishing widens access, so the
 * translations are widened first; every other transition narrows it, so the
 * parent is narrowed first. Both orders fail safe — the item ends up less
 * visible, never more. What was not safe was the *report*: an unpublish whose
 * parent update landed leaves the item genuinely unpublished, with its
 * proposal token already spent, while the caller is told the operation failed
 * and may go looking for an item that is no longer public.
 *
 * Nothing is compensated, for the reason the page publish path gives: a
 * reversing write runs against the backend that just refused one.
 */
function partialStatusFailure(
  error: unknown,
  input: {
    domain: string;
    id: string;
    status: string;
    statusCommitted: boolean;
  }
): DomainError {
  const mapped = fromAppwriteError(error, {
    operation: `set ${input.domain} status`,
  });
  if (!input.statusCommitted) {
    return mapped;
  }
  return new DomainError(
    mapped.code,
    `${mapped.message} The ${input.domain} item is already \`${input.status}\` and that change is committed; only its translations' read permissions were not updated.`,
    {
      cause: error,
      details: {
        ...mapped.details,
        committed: {
          table: input.domain,
          rowId: input.id,
          status: input.status,
        },
        translationPermissionsUpdated: false,
      },
      remedy:
        "The item's own status changed. Re-run the same transition to finish synchronising its translations, which is safe to repeat.",
    }
  );
}

export function createContentService(
  clients: BackendClients,
  links: { web(path: string): string; admin(path: string): string }
): ContentService {
  /**
   * Build the shared query prefix: scope + status + campus + department + date.
   *
   * Campus/department narrowing from arguments can only ever *intersect* the
   * principal's own scope — it is applied on top of `scopeQueries`, never
   * instead of it — so a caller naming another campus gets no rows rather than
   * that campus's rows.
   *
   * Everything here filters on the **relationship** paths (`campus.$id`,
   * `department.$id`), not the legacy scalar columns, because that is what
   * `applyContentRelationshipScopeQueries` in `apps/admin` does and its
   * companion `getContentOwnership` states the rule outright: "relationship
   * values win; `legacyFallback` exposes the scalar columns only for rows that
   * predate the relationship backfill (repair rollout window)". Scoping on the
   * scalar authorizes a repair-window row by whichever value is *stale*, and
   * these tables carry a table-level `read("any")`, so Appwrite offers no
   * second gate to catch it.
   *
   * It also stops a table without a department *scalar* being treated as a
   * table without a department. `documents` and `campus_benefits` have no
   * `department_id` column but do have the relationship, so scoping by the
   * scalar made `departmentField` null, which `scopeQueries` fails closed on —
   * hiding a department's own documents and benefits from it.
   */
  function scopeFieldsFor(spec: ContentDomainSpec): {
    campusField: string | null;
    departmentField: string | null;
  } {
    return {
      campusField: spec.scope.campusRelation ?? spec.scope.campusField,
      departmentField:
        spec.scope.departmentRelation ?? spec.scope.departmentField,
    };
  }

  function baseQueries(
    principal: Principal,
    spec: ContentDomainSpec,
    input: ContentSearchInput,
    warnings: string[]
  ): string[] {
    const fields = scopeFieldsFor(spec);
    const queries: string[] = [...scopeQueries(principal, fields)];

    if (input.status) {
      if (spec.statuses.includes(input.status)) {
        queries.push(Query.equal("status", input.status));
      } else {
        warnings.push(
          `Status "${input.status}" is not valid for ${spec.domain} (valid: ${spec.statuses.join(", ")}). The filter was not applied.`
        );
      }
    }

    if (input.campusId) {
      // The same path the scope filter used, or an argument could narrow on
      // one side of a repair-window row while authorization read the other.
      if (fields.campusField) {
        queries.push(Query.equal(fields.campusField, [input.campusId]));
      } else {
        warnings.push(
          `${spec.domain} has no campus column; the campus filter was not applied.`
        );
      }
    }

    if (input.departmentId) {
      if (fields.departmentField) {
        queries.push(Query.equal(fields.departmentField, [input.departmentId]));
      } else {
        warnings.push(
          `${spec.domain} has no department column; the department filter was not applied.`
        );
      }
    }

    if (input.updatedSince) {
      queries.push(
        Query.greaterThanEqual(
          primaryDateField(spec.domain),
          resolveDateFilter(input.updatedSince)
        )
      );
    }

    return queries;
  }

  /**
   * The projection for a single-row detail read.
   *
   * `*` because `biso_content_get` promises every non-sensitive column, and the
   * relationships named explicitly because a projection that does not name them
   * cannot be relied on to expand them — which is why every other detail reader
   * in this repository names them too (`NEWS_RELATIONSHIP_SELECT` and its
   * siblings in `apps/admin`, `JOB_SELECT` in `@repo/shared`, `readPageRow` and
   * `getPublicPage` here). `search` already did this through `selectFor`; `get`
   * was the one reader that did not, while reading the children all the same.
   */
  function detailSelect(spec: ContentDomainSpec): string[] {
    const columns = new Set<string>(["*"]);
    if (spec.scope.campusRelation) {
      columns.add(spec.scope.campusRelation);
    }
    if (spec.scope.departmentRelation) {
      columns.add(spec.scope.departmentRelation);
    }
    if (spec.translations.kind === "content_translations") {
      columns.add(`${spec.translations.relationship}.*`);
    }
    return [...columns];
  }

  function selectFor(spec: ContentDomainSpec): string[] {
    const columns = new Set<string>([
      "$id",
      "$createdAt",
      "$updatedAt",
      ...spec.summaryColumns,
    ]);
    if (spec.scope.campusField) {
      columns.add(spec.scope.campusField);
    }
    if (spec.scope.departmentField) {
      columns.add(spec.scope.departmentField);
    }
    columns.add("campus.$id");
    columns.add("department.$id");
    if (spec.translations.kind === "content_translations") {
      columns.add(`${spec.translations.relationship}.title`);
      columns.add(`${spec.translations.relationship}.locale`);
    }
    return [...columns];
  }

  return {
    async search(principal, input): Promise<ContentSearchResult> {
      const spec = domainSpec(input.domain);
      const warnings: string[] = [];
      const scope = describeScope(principal, {
        campusField: spec.scope.campusField,
        departmentField: spec.scope.departmentField,
      });

      const queries = baseQueries(principal, spec, input, warnings);
      const term = input.query?.trim()
        ? truncate(input.query.trim(), MAX_SEARCH_TERM)
        : null;
      const locale = input.locale ?? "no";

      if (term) {
        const applied = await applyTextFilter({
          clients,
          spec,
          term,
          locale,
          queries,
          warnings,
        });
        if (applied === "no_matches") {
          return {
            rows: [],
            pagination: buildPagination({
              count: 0,
              total: 0,
              offset: input.offset,
              limit: input.limit,
            }),
            scope,
            warnings,
          };
        }
      }

      queries.push(
        Query.select(selectFor(spec)),
        orderQuery(spec.domain, input.order),
        Query.limit(input.limit),
        Query.offset(input.offset)
      );

      try {
        const result = await clients.user.db.listRows<Row>(
          "app",
          spec.table,
          queries
        );
        return {
          rows: result.rows.map((row) => toSummary(spec, row, locale, links)),
          pagination: buildPagination({
            count: result.rows.length,
            total: result.total,
            offset: input.offset,
            limit: input.limit,
          }),
          scope,
          warnings,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: `search ${spec.domain}` });
      }
    },

    async get(principal, domain, id): Promise<ContentDetail> {
      const spec = domainSpec(domain);
      let row: Row;
      try {
        row = await clients.user.db.getRow<Row>("app", spec.table, id, [
          Query.select(detailSelect(spec)),
        ]);
      } catch (error) {
        const mapped = fromAppwriteError(error, {
          operation: `get ${domain}`,
        });
        // A row the caller cannot read and a row that does not exist are
        // reported identically on purpose: distinguishing them tells an
        // unauthorized caller that the id is real.
        if (mapped.code === "forbidden" || mapped.code === "not_found") {
          throw notFound(`No ${domain} found with id ${id}.`, { domain, id });
        }
        throw mapped;
      }

      const ownership = rowOwnership(row as never, { legacyFallback: true });
      // Appwrite's own permissions already gate the read, but several content
      // tables grant `read("any")` at table level, so a second application-level
      // check is what actually keeps a draft in another campus out of reach.
      //
      // A *published* row is readable across campuses on purpose — it is
      // already public. That makes `raw` below the load-bearing part: anything
      // on a published row that should not cross a campus boundary has to be in
      // `SENSITIVE_COLUMNS`, because this check will not stop it. That is why
      // `campus_benefits.redemption_value` and the `jobs` screening columns are
      // listed there.
      const isPublished = row.status === spec.publishedStatus;
      // Which of the two checks let this through decides how much of the row
      // comes back, so keep them apart rather than collapsing into one boolean.
      const owned = canReadRow(
        principal,
        ownership.campusId,
        ownership.departmentId
      );
      if (!(isPublished || owned)) {
        throw notFound(`No ${domain} found with id ${id}.`, { domain, id });
      }

      const translations = detailTranslations(spec, row);
      const summary = toSummary(spec, row, "no", links);
      const warnings: string[] = [];
      if (!owned) {
        warnings.push(
          `This ${domain} is outside your campus and department scope; it is readable only because it is published. The full row is withheld — "fields" carries the public columns for ${domain}.`
        );
      }
      return {
        ...summary,
        translations,
        raw: owned ? stripSensitive(spec.table, row) : null,
        revision: row.$updatedAt,
        warnings,
      };
    },

    async setStatus(principal, domain, id, status, expectedRevision) {
      const spec = domainSpec(domain);
      if (!spec.statuses.includes(status)) {
        throw forbidden(`"${status}" is not a valid status for ${domain}.`, {
          valid: spec.statuses,
        });
      }

      // Re-read immediately before the write. The ownership used for the
      // authorization decision must be the backend's current view, not the one
      // the caller saw when the proposal was built.
      let current: Row;
      try {
        current = await clients.user.db.getRow<Row>("app", spec.table, id);
      } catch (error) {
        const mapped = fromAppwriteError(error, {
          operation: `read ${domain} before status change`,
        });
        if (mapped.code === "not_found" || mapped.code === "forbidden") {
          throw notFound(`No ${domain} found with id ${id}.`, { domain, id });
        }
        throw mapped;
      }

      // Re-authorize against the ownership the backend just reported, not the
      // ownership the tool layer saw when it built the proposal. Between those
      // two reads a row can be moved to another campus or department, and the
      // earlier check would then have authorized a row this principal no longer
      // owns. Publishing follows the same scope as writing.
      const ownership = rowOwnership(current as never, {
        legacyFallback: true,
      });
      if (status === spec.publishedStatus) {
        assertPublishAccess(
          principal,
          ownership.campusId,
          ownership.departmentId
        );
      } else {
        assertWriteAccess(
          principal,
          ownership.campusId,
          ownership.departmentId
        );
      }

      if (expectedRevision && current.$updatedAt !== expectedRevision) {
        throw new DomainError(
          "stale_revision",
          `This ${domain} changed since the proposal was created.`,
          {
            details: {
              expected: expectedRevision,
              actual: current.$updatedAt,
            },
            remedy: "Re-read the item and create a new proposal.",
          }
        );
      }

      // Content rows carry no team write grants (see `services/permissions.ts`),
      // so the write itself needs the service key. Authorization has already
      // been decided from the principal by the caller and re-derived here from
      // the row the backend just returned.
      const { db } = clients.requireElevated(
        `set ${domain} status (row grants no team write access)`
      );
      const audience =
        current.member_only === true || current.is_member_only === true
          ? ("members" as const)
          : ("public" as const);

      const rowPermissions = buildContentRowPermissions({ status, audience });
      const translationPermissions = buildTranslationRowPermissions({
        status,
        audience,
      });

      /**
       * Bring the row's `content_translations` ACLs in line with its new
       * status, the way every `apps/admin` content action does (`news.ts`,
       * `benefits.ts`, `shop.ts` all rebuild translation permissions from the
       * status on every write).
       *
       * This is defence in depth rather than today's visibility control: the
       * table itself grants `read("any")`, so a row ACL neither hides a draft
       * translation nor reveals a published one while that grant stands.
       * Writing them anyway keeps MCP-published content identical to
       * portal-published content, so that tightening the table grant — the
       * schema task in `docs/roadmap.md` — fixes both at once instead of
       * leaving a cohort of rows the portal would have set correctly.
       */
      const syncTranslationPermissions = async (): Promise<void> => {
        if (spec.translations.kind !== "content_translations") {
          return;
        }
        const { contentType } = spec.translations;
        const existing = await db.listRows<Projected<{ $id: string }>>(
          "app",
          "content_translations",
          [
            Query.equal("content_id", id),
            Query.equal("content_type", contentType),
            Query.select(["$id"]),
            Query.limit(TRANSLATION_SYNC_LIMIT),
          ]
        );
        for (const translation of existing.rows) {
          await db.updateRow(
            "app",
            "content_translations",
            translation.$id,
            {},
            translationPermissions
          );
        }
      };

      // Ordering matters, because there is no transaction across these writes.
      // Publishing widens access, so widen the translations first: a failure
      // then leaves the row unpublished, which is safe. Any other transition
      // narrows access, so narrow the parent first, for the same reason.
      const publishing = status === spec.publishedStatus;

      // Which write has already landed decides what the caller is told, so
      // the flag is tracked rather than inferred from the error.
      let statusCommitted = false;
      try {
        if (publishing) {
          await syncTranslationPermissions();
        }
        const updated = await db.updateRow<Row>(
          "app",
          spec.table,
          id,
          { status },
          rowPermissions
        );
        statusCommitted = true;
        if (!publishing) {
          await syncTranslationPermissions();
        }
        return {
          id: updated.$id,
          status,
          revision: updated.$updatedAt,
        };
      } catch (error) {
        throw partialStatusFailure(error, {
          domain,
          id,
          status,
          // Only the narrowing order can strand a committed parent: when
          // publishing, the translation sync runs first, so a failure there
          // leaves nothing committed and the plain error is the whole truth.
          statusCommitted: statusCommitted && !publishing,
        });
      }
    },

    async createDraft(principal, input) {
      if (isAnonymous(principal)) {
        throw forbidden("Creating content requires a verified identity.");
      }
      const spec = domainSpec(input.domain);
      if (spec.translations.kind !== "content_translations") {
        throw forbidden(`Draft creation is not modelled for ${input.domain}.`);
      }

      const rowId = ID.unique();
      const status = spec.draftStatus;

      // A draft is never publicly visible, so both permission sets are empty.
      // Stated explicitly rather than relying on the default, because getting
      // this wrong publishes a draft.
      const rowPermissions = buildContentRowPermissions({ status });
      const translationPermissions = buildTranslationRowPermissions({ status });

      const nested = input.translations.map((translation) => ({
        $id: ID.unique(),
        $permissions: translationPermissions,
        content_id: rowId,
        content_type:
          spec.translations.kind === "content_translations"
            ? spec.translations.contentType
            : "",
        locale: translation.locale,
        title: translation.title,
        description: translation.description,
        short_description: translation.shortDescription ?? null,
      }));

      const { db } = clients.requireElevated(
        `create ${input.domain} draft (content tables grant no team create for every campus)`
      );

      try {
        const created = await db.createRow<Row>(
          "app",
          spec.table,
          rowId,
          {
            slug: input.slug,
            status,
            campus: input.campusId,
            campus_id: input.campusId,
            department: input.departmentId,
            department_id: input.departmentId,
            [spec.translations.relationship]: nested,
            ...(input.extra ?? {}),
          },
          rowPermissions
        );
        return {
          id: created.$id,
          slug: input.slug,
          revision: created.$updatedAt,
        };
      } catch (error) {
        throw fromAppwriteError(error, {
          operation: `create ${input.domain} draft`,
        });
      }
    },
  };
}

/** Exported for the ownership diagnostics in the audit workflow. */
export function ownershipOf(row: Record<string, unknown>): {
  campusId: string | null;
  departmentId: string | null;
} {
  return rowOwnership(row as never, { legacyFallback: true });
}
