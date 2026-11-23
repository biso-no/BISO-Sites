import type {
  Hit,
  SearchResponse as MeiliResponse,
  MultiSearchQuery,
} from "meilisearch";
import { campusIdToLabel } from "../utils/unit-urls";
import {
  HIGHLIGHT_POST,
  HIGHLIGHT_PRE,
  hasMatch,
  toSegments,
} from "./highlight";
import {
  QUICK_GROUP_SIZE,
  SEARCH_PAGE_MAX,
  SEARCH_PAGE_SIZE,
  type SearchRequest,
} from "./params";
import {
  emptyCounts,
  type GroupCounts,
  groupOf,
  SEARCH_GROUPS,
  type SearchGroup,
  type SearchHit,
  type SearchResponse,
  typesOf,
} from "./response";
import { ALL_CAMPUSES, type SearchEntry, type SearchLocale } from "./types";

export interface SearchRunner {
  multiSearch(
    queries: MultiSearchQuery[]
  ): Promise<MeiliResponse<SearchEntry>[]>;
}

type Result = MeiliResponse<SearchEntry>;

const RETRIEVE: (keyof SearchEntry)[] = [
  "campus_id",
  "category",
  "cover_pattern",
  "deadline",
  "department",
  "ends_at",
  "id",
  "image",
  "in_stock",
  "locale",
  "location",
  "member_only",
  "member_price",
  "price",
  "published_at",
  "row_id",
  "starts_at",
  "summary",
  "text_locale",
  "title",
  "type",
  "url",
  "visible_until",
];

const CROP_LENGTH = 24;

function list(values: string[]): string {
  return values.map((v) => JSON.stringify(v)).join(", ");
}

export function baseFilter(req: SearchRequest, now: Date): string[] {
  return [
    `locale = ${JSON.stringify(req.locale)}`,
    `visible_until >= ${Math.floor(now.getTime() / 1000)}`,
  ];
}

function groupFilter(group: SearchGroup): string {
  return `type IN [${list(typesOf(group))}]`;
}

function campusFilter(campus: string, side: "mine" | "rest"): string {
  const op = side === "mine" ? "IN" : "NOT IN";
  return `campus_id ${op} [${list([campus, ALL_CAMPUSES])}]`;
}

function allCampusesLabel(locale: SearchLocale): string {
  return locale === "en" ? "All campuses" : "Alle campus";
}

export function toHit(hit: Hit<SearchEntry>, locale: SearchLocale): SearchHit {
  const formatted = hit._formatted;
  const summary = toSegments(formatted?.summary ?? hit.summary ?? "");
  const body = toSegments(formatted?.body ?? "");
  let snippet = summary;
  if (!hasMatch(summary) && (hasMatch(body) || summary.length === 0)) {
    snippet = body;
  }
  return {
    id: hit.id,
    type: hit.type,
    group: groupOf(hit.type),
    title: toSegments(formatted?.title ?? hit.title),
    snippet,
    url: hit.url,
    campus_id: hit.campus_id,
    campus_name:
      hit.campus_id === ALL_CAMPUSES
        ? allCampusesLabel(locale)
        : (campusIdToLabel(hit.campus_id) ?? hit.campus_id),
    category: hit.category,
    cover_pattern: hit.cover_pattern,
    deadline: hit.deadline,
    department: hit.department,
    ends_at: hit.ends_at,
    image: hit.image,
    in_stock: hit.in_stock,
    location: hit.location,
    member_only: hit.member_only,
    member_price: hit.member_price,
    price: hit.price,
    published_at: hit.published_at,
    starts_at: hit.starts_at,
    text_locale: hit.text_locale,
  };
}

function makeQuery(
  indexName: string,
  req: SearchRequest,
  filter: string[],
  extra: Partial<MultiSearchQuery>
): MultiSearchQuery {
  return {
    indexUid: indexName,
    q: req.q,
    filter,
    attributesToHighlight: ["title", "summary", "body"],
    attributesToCrop: ["body"],
    cropLength: CROP_LENGTH,
    highlightPreTag: HIGHLIGHT_PRE,
    highlightPostTag: HIGHLIGHT_POST,
    attributesToRetrieve: RETRIEVE,
    ...extra,
  };
}

function toCounts(result: Result | undefined): GroupCounts {
  const counts = emptyCounts();
  const distribution = result?.facetDistribution?.type ?? {};
  for (const [type, n] of Object.entries(distribution)) {
    counts[groupOf(type as SearchEntry["type"])] += n;
  }
  return counts;
}

function sum(counts: GroupCounts): number {
  return SEARCH_GROUPS.reduce((acc, g) => acc + counts[g], 0);
}

function hasSplit(req: SearchRequest): req is SearchRequest & {
  campus: string;
} {
  return req.campus !== null && !req.onlyCampus;
}

/** The campus filter for the single-scope case (no split). */
function scopeFilters(req: SearchRequest, now: Date): string[] {
  const filter = baseFilter(req, now);
  if (req.campus !== null && req.onlyCampus) {
    filter.push(campusFilter(req.campus, "mine"));
  }
  return filter;
}

function countsQuery(
  indexName: string,
  req: SearchRequest,
  now: Date
): MultiSearchQuery {
  return makeQuery(indexName, req, scopeFilters(req, now), {
    limit: 0,
    facets: ["type"],
  });
}

async function runQuick(
  runner: SearchRunner,
  indexName: string,
  req: SearchRequest,
  now: Date
): Promise<SearchResponse> {
  const base = baseFilter(req, now);
  const scopes: string[][] = hasSplit(req)
    ? [
        [...base, campusFilter(req.campus, "mine")],
        [...base, campusFilter(req.campus, "rest")],
      ]
    : [scopeFilters(req, now)];

  const queries: MultiSearchQuery[] = [countsQuery(indexName, req, now)];
  for (const scope of scopes) {
    queries.push(makeQuery(indexName, req, scope, { limit: 1 }));
    for (const group of SEARCH_GROUPS) {
      queries.push(
        makeQuery(indexName, req, [...scope, groupFilter(group)], {
          limit: QUICK_GROUP_SIZE + 1,
        })
      );
    }
  }

  const results = await runner.multiSearch(queries);
  const counts = toCounts(results[0]);
  const stride = 1 + SEARCH_GROUPS.length;
  const scoped = scopes.map((_, i) => {
    const start = 1 + i * stride;
    return {
      best: results[start]?.hits ?? [],
      groups: SEARCH_GROUPS.map(
        (_g, gi) => results[start + 1 + gi]?.hits ?? []
      ),
    };
  });

  const bestHit = scoped.map((s) => s.best[0]).find((h) => h !== undefined);
  const groups = {} as Record<SearchGroup, SearchHit[]>;
  SEARCH_GROUPS.forEach((group, gi) => {
    groups[group] = scoped
      .flatMap((s) => s.groups[gi])
      .filter((h) => h.id !== bestHit?.id)
      .slice(0, QUICK_GROUP_SIZE)
      .map((h) => toHit(h, req.locale));
  });

  return {
    mode: "quick",
    query: req.q,
    locale: req.locale,
    best: bestHit ? toHit(bestHit, req.locale) : null,
    counts,
    total: sum(counts),
    groups,
  };
}

async function runPage(
  runner: SearchRunner,
  indexName: string,
  req: SearchRequest,
  now: Date
): Promise<SearchResponse> {
  const base = baseFilter(req, now);
  const groupPart = req.group ? [groupFilter(req.group)] : [];
  const queries: MultiSearchQuery[] = [countsQuery(indexName, req, now)];

  if (hasSplit(req)) {
    const mineFilter = [
      ...base,
      campusFilter(req.campus, "mine"),
      ...groupPart,
    ];
    const restFilter = [
      ...base,
      campusFilter(req.campus, "rest"),
      ...groupPart,
    ];
    queries.push(
      makeQuery(indexName, req, mineFilter, {
        hitsPerPage: SEARCH_PAGE_SIZE,
        page: req.page,
      }),
      makeQuery(indexName, req, restFilter, { hitsPerPage: 1, page: 1 })
    );
    const [counts, mine, rest] = await runner.multiSearch(queries);
    const mineTotal = mine?.totalHits ?? 0;
    const restTotal = rest?.totalHits ?? 0;
    const hits = [...(mine?.hits ?? [])];
    if (hits.length < SEARCH_PAGE_SIZE && restTotal > 0) {
      const start = (req.page - 1) * SEARCH_PAGE_SIZE;
      const [more] = await runner.multiSearch([
        makeQuery(indexName, req, restFilter, {
          offset: Math.max(0, start - mineTotal),
          limit: SEARCH_PAGE_SIZE - hits.length,
        }),
      ]);
      hits.push(...(more?.hits ?? []));
    }
    return pageResponse(req, toCounts(counts), hits, mineTotal + restTotal);
  }

  queries.push(
    makeQuery(indexName, req, [...scopeFilters(req, now), ...groupPart], {
      hitsPerPage: SEARCH_PAGE_SIZE,
      page: req.page,
    })
  );
  const [counts, results] = await runner.multiSearch(queries);
  return pageResponse(
    req,
    toCounts(counts),
    results?.hits ?? [],
    results?.totalHits ?? 0
  );
}

function pageResponse(
  req: SearchRequest,
  counts: GroupCounts,
  hits: Hit<SearchEntry>[],
  total: number
): SearchResponse {
  return {
    mode: "page",
    query: req.q,
    locale: req.locale,
    group: req.group,
    page: req.page,
    pageSize: SEARCH_PAGE_SIZE,
    counts,
    hits: hits.map((h) => toHit(h, req.locale)),
    total,
    totalPages: Math.min(Math.ceil(total / SEARCH_PAGE_SIZE), SEARCH_PAGE_MAX),
  };
}

export function runSearch(
  runner: SearchRunner,
  indexName: string,
  req: SearchRequest,
  now: Date
): Promise<SearchResponse> {
  return req.mode === "quick"
    ? runQuick(runner, indexName, req, now)
    : runPage(runner, indexName, req, now);
}
