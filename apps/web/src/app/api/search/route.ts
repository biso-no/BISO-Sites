import { NextResponse } from "next/server";
import { Query, type Models } from "@repo/api";

import { createAdminClient } from "@repo/api/server";
import type { SearchIndex, SearchResult } from "@/lib/search/types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const DEFAULT_INDICES: SearchIndex[] = ["jobs", "events", "news", "units"];

type SearchPayload = {
  query?: unknown;
  indices?: unknown;
  limit?: unknown;
  locale?: unknown;
};

type HandlerContext = {
  query: string;
  limit: number;
  locale?: string;
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
};

type SearchHandler = (context: HandlerContext) => Promise<SearchResult[]>;

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as SearchPayload;
    const rawQuery =
      typeof payload.query === "string" ? payload.query.trim() : "";

    if (rawQuery.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const limitInput = Number(payload.limit);
    const limit = Number.isFinite(limitInput)
      ? Math.min(Math.max(Math.trunc(limitInput), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const locale =
      typeof payload.locale === "string" && payload.locale.length === 2
        ? payload.locale
        : undefined;

    const indicesInput = Array.isArray(payload.indices)
      ? (payload.indices as unknown[])
      : DEFAULT_INDICES;
    const indices = Array.from(
      new Set(
        indicesInput.filter((value): value is SearchIndex =>
          DEFAULT_INDICES.includes(value as SearchIndex),
        ),
      ),
    );

    if (indices.length === 0) {
      indices.push(...DEFAULT_INDICES);
    }

    const { db } = await createAdminClient();
    const context: HandlerContext = { query: rawQuery, limit, locale, db };

    const results = await Promise.all(
      indices.map((index) => SEARCH_HANDLERS[index](context)),
    );

    const flattened = results.flat() as Array<SearchResult & { _score?: number; _updatedAt?: number }>;
    flattened.sort((a, b) => (Number(b._score) || 0) - (Number(a._score) || 0));

    const sanitized = flattened
      .slice(0, limit)
      .map(({ _score, _updatedAt, ...result }) => result);

    return NextResponse.json({ results: sanitized });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", results: [] },
      { status: 500 },
    );
  }
}

const SEARCH_HANDLERS: Record<SearchIndex, SearchHandler> = {
  jobs: async (ctx) =>
    searchTranslations({
      ...ctx,
      relationField: "job_ref",
      index: "jobs",
      buildResult: (params) => buildJobResult(params as unknown as { parent: Models.Row; translation: Models.Row; index: SearchIndex }),
    }),
  events: async (ctx) =>
    searchTranslations({
      ...ctx,
      relationField: "event_ref",
      index: "events",
      buildResult: (params) => buildEventResult(params as unknown as { parent: Models.Row; translation: Models.Row; index: SearchIndex }),
    }),
  news: async (ctx) =>
    searchTranslations({
      ...ctx,
      relationField: "news_ref",
      index: "news",
      buildResult: (params) => buildNewsResult(params as unknown as { parent: Models.Row; translation: Models.Row; index: SearchIndex }),
    }),
  units: async (ctx) => searchUnits(ctx),
};

type TranslationSearchParams = HandlerContext & {
  relationField: "job_ref" | "event_ref" | "news_ref";
  index: SearchIndex;
  buildResult: (params: {
    parent: Models.Row;
    translation: Models.Row;
    index: SearchIndex;
  }) => SearchResult;
};

async function searchTranslations({
  db,
  query,
  limit,
  locale,
  relationField,
  index,
  buildResult,
}: TranslationSearchParams): Promise<SearchResult[]> {
  const perFieldLimit = Math.max(limit * 3, 15);
  const fields: Array<"title" | "description"> = ["title", "description"];
  const loweredQuery = query.toLowerCase();

  type Aggregated = {
    result: SearchResult & { _score?: number; _updatedAt?: number };
    score: number;
    updatedAt: number;
  };

  const aggregated = new Map<string, Aggregated>();

  await Promise.all(
    fields.map(async (field, fieldIndex) => {
      const queries = [
        Query.limit(perFieldLimit),
        Query.search(field, query),
      ];

      if (locale) {
        queries.push(Query.equal("locale", locale));
      }

      try {
        const response = await db.listRows(
          "app",
          "content_translations",
          queries,
        );

        response.rows.forEach((translation, docIndex) => {
          const parent = translation[relationField] as
            | Models.Document
            | undefined;
          if (!parent) return;

          // Public safety: only include visible parent records
          const parentStatus = (parent as any).status as string | undefined
          const allowed = (() => {
            switch (index) {
              case 'events':
                return parentStatus === 'published'
              case 'news':
                return parentStatus === 'published'
              case 'jobs':
                return parentStatus === 'published'
              default:
                return true
            }
          })()
          if (!allowed) return;

          const key = `${index}:${parent.$id}`;
          const value = translation[field] as string | undefined;
          const score = computeMatchScore({
            value,
            loweredQuery,
            fieldIndex,
            docIndex,
            localeMatch: locale ? translation.locale === locale : false,
          });

          if (score <= 0) return;

          const updatedAt = parseDate(
            parent.$updatedAt ||
              parent.$createdAt ||
              translation.$updatedAt ||
              translation.$createdAt,
          );

          const result = {
            ...buildResult({ parent: parent as unknown as Models.Row, translation: translation as unknown as Models.Row, index }),
            _score: score,
            _updatedAt: updatedAt,
          };

          const existing = aggregated.get(key);
          if (!existing || score > existing.score) {
            aggregated.set(key, { result, score, updatedAt });
          } else if (score === existing.score && updatedAt > existing.updatedAt) {
            aggregated.set(key, { result, score, updatedAt });
          }
        });
      } catch (error) {
        console.error(
          `Failed to search translations field="${field}" type="${relationField}"`,
          error,
        );
      }
    }),
  );

  return Array.from(aggregated.values())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .map((item) => item.result);
}

function buildJobResult({
  parent,
  translation,
}: {
  parent: Models.Row;
  translation: Models.Row;
  index: SearchIndex;
}): SearchResult & { _score?: number; _updatedAt?: number } {
  const metadata = safeJson((parent as unknown as { metadata: string }).metadata) ?? {};
  const summary = (translation as unknown as { description: string }).description as string | undefined
    ? truncate(stripHtml((translation as unknown as { description: string }).description), 200)
    : undefined;

  return {
    id: parent.$id,
    index: "jobs",
    title: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "Job",
    name: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "Job",
    description: summary,
    type: metadata.type ?? (parent as unknown as { type: string }).type ?? undefined,
    company: metadata.company ?? undefined,
    department: (parent as unknown as { department_id: string }).department_id ?? undefined,
    date: metadata.application_deadline ?? undefined,
    location: metadata.location ?? undefined,
    href: (parent as unknown as { slug: string }).slug ? `/jobs/${(parent as unknown as { slug: string }).slug}` : `/jobs`,
  };
}

function buildEventResult({
  parent,
  translation,
}: {
  parent: Models.Row;
  translation: Models.Row;
  index: SearchIndex;
}): SearchResult & { _score?: number; _updatedAt?: number } {
  const metadata = safeJson((parent as unknown as { metadata: string }).metadata) ?? {};
  const summary = (translation as unknown as { description: string }).description
    ? truncate(stripHtml((translation as unknown as { description: string }).description), 200)
    : undefined;

  return {
    id: parent.$id,
    index: "events",
    title: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "Event",
    name: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "Event",
    description: summary,
    date: metadata.start_date ?? (parent as unknown as { start_date: string }).start_date ?? undefined,
    location: metadata.location ?? (parent as unknown as { location: string }).location ?? undefined,
    href: `/events/${parent.$id}`,
  };
}

function buildNewsResult({
  parent,
  translation,
}: {
  parent: Models.Row;
  translation: Models.Row;
  index: SearchIndex;
}): SearchResult & { _score?: number; _updatedAt?: number } {
  const summary = (translation as unknown as { description: string }).description
    ? truncate(stripHtml((translation as unknown as { description: string }).description), 200)
    : undefined;

  return {
    id: parent.$id,
    index: "news",
    title: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "News",
    name: (translation as unknown as { title: string }).title ?? (parent as unknown as { slug: string }).slug ?? "News",
    description: summary,
    date: parent.$createdAt ?? undefined,
    href: `/news/${parent.$id}`,
  };
}

async function searchUnits({ db, query, limit }: HandlerContext): Promise<SearchResult[]> {
  const perFieldLimit = Math.max(limit * 3, 15);

  try {
    const response = await db.listRows("app", "departments", [
      Query.limit(perFieldLimit),
      Query.search("Name", query),
    ]);

    // Optionally enrich with campus name (best-effort)
    const results: SearchResult[] = await Promise.all(
      response.rows.map(async (dept) => {
        let campusName: string | undefined;
        try {
          if (dept.campus_id) {
            const campus = await db.getRow("app", "campus", String(dept.campus_id));
            campusName = (campus as unknown as { name: string }).name as string | undefined;
          }
        } catch {}

        const summary = typeof dept.description === "string" && dept.description.length
          ? truncate(stripHtml(dept.description), 180)
          : undefined;

        return {
          id: dept.$id,
          index: "units",
          title: String(dept.Name || "Unit"),
          name: String(dept.Name || "Unit"),
          description: summary,
          location: campusName,
          href: `/units${dept.campus_id ? `?campus_id=${dept.campus_id}` : ""}`,
        };
      })
    );

    return results;
  } catch (error) {
    console.error("Failed to search units:", error);
    return [];
  }
}

function computeMatchScore({
  value,
  loweredQuery,
  fieldIndex,
  docIndex,
  localeMatch,
}: {
  value?: string;
  loweredQuery: string;
  fieldIndex: number;
  docIndex: number;
  localeMatch: boolean;
}): number {
  const text = value?.toLowerCase().trim();
  if (!text) return 0;

  const baseScore = 120 - fieldIndex * 12;
  const positionScore = Math.max(20 - docIndex, 1);
  const localeBonus = localeMatch ? 15 : 0;

  if (text === loweredQuery) {
    return baseScore + positionScore + localeBonus + 30;
  }
  if (text.startsWith(loweredQuery)) {
    return baseScore + positionScore + localeBonus + 20;
  }
  if (text.includes(loweredQuery)) {
    return baseScore + positionScore + localeBonus + 10;
  }

  return Math.max(baseScore + positionScore + localeBonus - 25, 1);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}…`;
}

function safeJson(value: unknown): Record<string, any> | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}
