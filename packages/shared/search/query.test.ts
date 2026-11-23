import type {
  Hit,
  SearchResponse as MeiliResponse,
  MultiSearchQuery,
} from "meilisearch";
import { describe, expect, it } from "vitest";
import type { SearchRequest } from "./params";
import {
  BEST_OTHER_CAMPUS_MARGIN,
  baseFilter,
  runSearch,
  type SearchRunner,
  toHit,
} from "./query";
import type { SearchEntry, SearchType } from "./types";

const MINE_OR_ALL = /^(2|all)$/;
const NOW = new Date("2026-11-23T12:00:00Z");

function req(over: Partial<SearchRequest> = {}): SearchRequest {
  return {
    q: "winter",
    locale: "no",
    campus: null,
    onlyCampus: false,
    group: null,
    page: 1,
    mode: "quick",
    ...over,
  };
}

function entry(over: Partial<SearchEntry> & { id: string }): SearchEntry {
  return {
    body: "body text",
    campus_id: "all",
    category: null,
    cover_pattern: null,
    deadline: null,
    department: null,
    ends_at: null,
    image: null,
    in_stock: null,
    keywords: [],
    locale: "no",
    location: null,
    member_only: false,
    member_price: null,
    price: null,
    published_at: null,
    row_id: over.id,
    starts_at: null,
    summary: "summary",
    synced_at: 0,
    text_locale: "no",
    title: `title ${over.id}`,
    type: "event",
    url: `/x/${over.id}`,
    visible_until: 32_503_680_000,
    ...over,
  };
}

function hitWith(over: Partial<Hit<SearchEntry>> = {}): Hit<SearchEntry> {
  const base = entry({ id: "h1", ...over });
  return {
    ...base,
    _formatted: { title: base.title, summary: base.summary, body: "" },
    ...over,
  } as Hit<SearchEntry>;
}

const IN_RE = /^(\w+) (NOT IN|IN) \[(.*)\]$/;
const CMP_RE = /^(\w+) (=|>=) (.+)$/;

function matches(e: SearchEntry, filter: string): boolean {
  const inM = IN_RE.exec(filter);
  if (inM) {
    const values = JSON.parse(`[${inM[3]}]`) as string[];
    const has = values.includes(String(e[inM[1] as keyof SearchEntry]));
    return inM[2] === "IN" ? has : !has;
  }
  const cm = CMP_RE.exec(filter);
  if (!cm) {
    throw new Error(`unparsed filter ${filter}`);
  }
  const actual = e[cm[1] as keyof SearchEntry];
  if (cm[2] === "=") {
    return actual === JSON.parse(cm[3]);
  }
  return Number(actual) >= Number(cm[3]);
}

function fake(entries: SearchEntry[], scores: Record<string, number> = {}) {
  const calls: MultiSearchQuery[][] = [];
  const runner: SearchRunner & { calls: MultiSearchQuery[][] } = {
    calls,
    multiSearch(queries) {
      calls.push(queries);
      return Promise.resolve(
        queries.map((q) => {
          const filtered = entries.filter((e) =>
            ((q.filter as string[]) ?? []).every((f) => matches(e, f))
          );
          const toH = (e: SearchEntry) =>
            ({
              ...e,
              ...(q.showRankingScore && scores[e.id] !== undefined
                ? { _rankingScore: scores[e.id] }
                : {}),
              _formatted: { title: e.title, summary: e.summary, body: "" },
            }) as Hit<SearchEntry>;
          const res: Record<string, unknown> = {
            query: q.q,
            processingTimeMs: 0,
          };
          if (q.facets?.includes("type")) {
            const dist: Record<string, number> = {};
            for (const e of filtered) {
              dist[e.type] = (dist[e.type] ?? 0) + 1;
            }
            res.facetDistribution = { type: dist };
          }
          if (q.hitsPerPage === undefined) {
            const offset = q.offset ?? 0;
            const limit = q.limit ?? 20;
            res.hits = filtered.slice(offset, offset + limit).map(toH);
            res.estimatedTotalHits = filtered.length;
            res.offset = offset;
            res.limit = limit;
          } else {
            const size = q.hitsPerPage;
            const page = q.page ?? 1;
            res.hits = filtered.slice((page - 1) * size, page * size).map(toH);
            res.totalHits = filtered.length;
            res.page = page;
            res.hitsPerPage = size;
            res.totalPages = size === 0 ? 0 : Math.ceil(filtered.length / size);
          }
          return res as unknown as MeiliResponse<SearchEntry>;
        })
      );
    },
  };
  return runner;
}

function many(
  type: SearchType,
  n: number,
  campus: string,
  prefix = type as string
): SearchEntry[] {
  return Array.from({ length: n }, (_, i) =>
    entry({ id: `${prefix}-${campus}-${i}`, type, campus_id: campus })
  );
}

const cannedQuick: SearchEntry[] = [
  ...many("event", 6, "all"),
  ...many("news", 5, "all"),
  ...many("job", 2, "all"),
  ...many("product", 4, "all"),
  ...many("page", 2, "all"),
  ...many("document", 1, "all"),
  ...many("coded", 1, "all"),
  ...many("unit", 2, "all"),
];

describe("baseFilter", () => {
  it("filters on locale and visibility", () => {
    expect(baseFilter(req({ locale: "en" }), NOW)).toEqual([
      'locale = "en"',
      "visible_until >= 1795435200",
    ]);
  });
});

describe("toHit", () => {
  it("falls back to the cropped body when only the body matched", () => {
    const hit = toHit(
      hitWith({
        _formatted: {
          title: "Packing list",
          summary: "Bring warm clothes",
          body: "…rent \u0001ski\u0002 gear on site…",
        },
      }),
      "en"
    );
    expect(hit.snippet.some((s) => s.match)).toBe(true);
  });

  it("prefers a matching summary", () => {
    const hit = toHit(
      hitWith({
        _formatted: { title: "t", summary: "a \u0001b\u0002", body: "x" },
      }),
      "en"
    );
    expect(hit.snippet).toEqual([
      { text: "a ", match: false },
      { text: "b", match: true },
    ]);
  });

  it("labels campuses", () => {
    expect(toHit(hitWith({ campus_id: "all" }), "no").campus_name).toBe(
      "Alle campus"
    );
    expect(toHit(hitWith({ campus_id: "all" }), "en").campus_name).toBe(
      "All campuses"
    );
    expect(toHit(hitWith({ campus_id: "2" }), "en").campus_name).toBe("Bergen");
  });

  it("carries the row id", () => {
    expect(
      toHit(hitWith({ id: "event_r1_no", row_id: "r1" }), "no").row_id
    ).toBe("r1");
  });

  it("maps the group", () => {
    expect(toHit(hitWith({ type: "coded" }), "no").group).toBe("page");
  });
});

describe("runSearch quick", () => {
  it("answers with one call and no repeated best hit", async () => {
    const f = fake(cannedQuick);
    const r = await runSearch(f, "site_content", req(), NOW);
    expect(f.calls).toHaveLength(1);
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.counts).toEqual({
      event: 6,
      news: 5,
      job: 2,
      product: 4,
      page: 4,
      unit: 2,
    });
    expect(r.total).toBe(23);
    expect(r.best).not.toBeNull();
    expect(
      Object.values(r.groups)
        .flat()
        .some((h) => h.id === r.best?.id)
    ).toBe(false);
    expect(r.groups.event.length).toBeLessThanOrEqual(2);
    expect(r.groups.page).toHaveLength(2);
  });

  it("puts the selected campus first", async () => {
    const entries = [
      ...many("event", 3, "1", "ev"),
      ...many("event", 2, "2", "ev"),
      ...many("event", 2, "all", "ev"),
    ];
    const f = fake(entries);
    const r = await runSearch(f, "site_content", req({ campus: "2" }), NOW);
    const filters = f.calls[0].flatMap((q) => q.filter ?? []);
    expect(filters).toContain('campus_id IN ["2", "all"]');
    expect(filters).toContain('campus_id NOT IN ["2", "all"]');
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.best?.campus_id).toMatch(MINE_OR_ALL);
    expect(r.groups.event[0].campus_id).toMatch(MINE_OR_ALL);
    expect(r.total).toBe(7);
  });

  it("fills a group with the rest after mine", async () => {
    const entries = [...many("event", 1, "2"), ...many("event", 4, "1")];
    const r = await runSearch(
      fake(entries),
      "site_content",
      req({ campus: "2" }),
      NOW
    );
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.best?.campus_id).toBe("2");
    expect(r.groups.event.map((h) => h.campus_id)).toEqual(["1", "1"]);
  });

  it("drops other campuses with onlyCampus, in counts too", async () => {
    const entries = [...many("event", 2, "2"), ...many("event", 3, "1")];
    const f = fake(entries);
    const r = await runSearch(
      f,
      "site_content",
      req({ campus: "2", onlyCampus: true }),
      NOW
    );
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.counts.event).toBe(2);
    expect(f.calls[0].flatMap((q) => q.filter ?? [])).not.toContain(
      'campus_id NOT IN ["2", "all"]'
    );
  });

  it("ignores onlyCampus without a campus", async () => {
    const f = fake(cannedQuick);
    const r = await runSearch(
      f,
      "site_content",
      req({ onlyCampus: true }),
      NOW
    );
    expect(r.total).toBe(23);
  });
});

describe("quick best card by relevance", () => {
  const entries = [
    entry({ id: "m1", campus_id: "2" }),
    entry({ id: "m2", campus_id: "2" }),
    entry({ id: "r1", campus_id: "1" }),
  ];
  const quick = (scores: Record<string, number>) =>
    runSearch(fake(entries, scores), "i", req({ campus: "2" }), NOW);

  it("exports a 0.1 margin", () => {
    expect(BEST_OTHER_CAMPUS_MARGIN).toBe(0.1);
  });

  it("lets a clearly better other-campus hit win", async () => {
    const r = await quick({ m1: 0.6, r1: 0.95 });
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.best?.id).toBe("r1");
    expect(r.groups.event.map((h) => h.id)).toEqual(["m1", "m2"]);
  });

  it("keeps campus first when the gain is small", async () => {
    const r = await quick({ m1: 0.9, r1: 0.95 });
    if (r.mode !== "quick") {
      throw new Error("mode");
    }
    expect(r.best?.id).toBe("m1");
    expect(r.groups.event.map((h) => h.id)).toEqual(["m2", "r1"]);
  });

  it("asks for ranking scores on the best queries only", async () => {
    const f = fake(entries);
    await runSearch(f, "i", req({ campus: "2" }), NOW);
    const scored = f.calls[0].filter((q) => q.showRankingScore);
    expect(scored).toHaveLength(2);
    expect(scored.every((q) => q.limit === 1)).toBe(true);
  });
});

describe("runSearch page", () => {
  const mine = many("event", 25, "2", "m");
  const rest = many("event", 30, "1", "r");
  const mineIds = mine.map((e) => e.id);
  const restIds = rest.map((e) => e.id);
  const pageReq = (page: number) =>
    req({ q: "x", campus: "2", mode: "page", page });

  it("crosses the campus boundary without skipping or repeating", async () => {
    const entries = [...mine, ...rest];
    const pg1 = await runSearch(fake(entries), "i", pageReq(1), NOW);
    const f2 = fake(entries);
    const pg2 = await runSearch(f2, "i", pageReq(2), NOW);
    const pg3 = await runSearch(fake(entries), "i", pageReq(3), NOW);
    if (pg1.mode !== "page" || pg2.mode !== "page" || pg3.mode !== "page") {
      throw new Error("mode");
    }
    expect(pg1.hits.map((h) => h.id)).toEqual(mineIds.slice(0, 20));
    expect(pg2.hits.map((h) => h.id)).toEqual([
      ...mineIds.slice(20, 25),
      ...restIds.slice(0, 15),
    ]);
    expect(pg3.hits.map((h) => h.id)).toEqual(restIds.slice(15, 30));
    expect(pg2.total).toBe(55);
    expect(pg2.total_pages).toBe(3);
    expect(pg2.page_size).toBe(20);
    expect(f2.calls).toHaveLength(2);
  });

  it("makes one call when page 1 is filled by mine", async () => {
    const f = fake([...mine, ...rest]);
    await runSearch(f, "i", pageReq(1), NOW);
    expect(f.calls).toHaveLength(1);
  });

  it("makes one call when other campuses have no matches", async () => {
    const f = fake(many("event", 5, "2", "m"));
    const r = await runSearch(f, "i", pageReq(1), NOW);
    if (r.mode !== "page") {
      throw new Error("mode");
    }
    expect(f.calls).toHaveLength(1);
    expect(r.hits.map((h) => h.id)).toEqual(
      many("event", 5, "2", "m").map((e) => e.id)
    );
  });

  it("skips the second call for a page past the end", async () => {
    const f = fake([...mine, ...rest]);
    const r = await runSearch(f, "i", pageReq(4), NOW);
    if (r.mode !== "page") {
      throw new Error("mode");
    }
    expect(f.calls).toHaveLength(1);
    expect(r.hits).toEqual([]);
  });

  it("probes with an exact total and no hit, without highlighting", async () => {
    const f = fake([...mine, ...rest]);
    await runSearch(f, "i", pageReq(1), NOW);
    const [counts, minePart, probe] = f.calls[0];
    expect(probe.hitsPerPage).toBe(0);
    expect(probe.page).toBe(1);
    for (const q of [counts, probe]) {
      expect(q.attributesToHighlight).toBeUndefined();
      expect(q.attributesToCrop).toBeUndefined();
      expect(q.attributesToRetrieve).toEqual([]);
    }
    expect(minePart.attributesToHighlight).toContain("body");
  });

  it("applies the group filter to results, not to counts", async () => {
    const f = fake(cannedQuick);
    const r = await runSearch(
      f,
      "i",
      req({ q: "x", mode: "page", group: "job" }),
      NOW
    );
    expect(f.calls[0].slice(1).flatMap((q) => q.filter ?? [])).toContain(
      'type IN ["job"]'
    );
    expect(f.calls[0][0].filter).not.toContain('type IN ["job"]');
    if (r.mode !== "page") {
      throw new Error("mode");
    }
    expect(r.hits).toHaveLength(2);
    expect(r.total).toBe(2);
    expect(r.counts.event).toBe(6);
  });

  it("uses the page group types filter", async () => {
    const f = fake(cannedQuick);
    const r = await runSearch(
      f,
      "i",
      req({ q: "x", mode: "page", group: "page" }),
      NOW
    );
    expect(f.calls[0].slice(1).flatMap((q) => q.filter ?? [])).toContain(
      'type IN ["page", "document", "coded"]'
    );
    if (r.mode !== "page") {
      throw new Error("mode");
    }
    expect(r.total).toBe(4);
  });
});

describe("counts", () => {
  it("ignores unknown types", async () => {
    const f = fake([]);
    const original = f.multiSearch.bind(f);
    f.multiSearch = async (queries) => {
      const results = await original(queries);
      results[0] = {
        ...results[0],
        facetDistribution: { type: { event: 2, benefit: 5 } },
      } as unknown as (typeof results)[number];
      return results;
    };
    const r = await runSearch(f, "i", req(), NOW);
    expect(r.counts).toEqual({
      event: 2,
      news: 0,
      job: 0,
      product: 0,
      page: 0,
      unit: 0,
    });
    expect(r.total).toBe(2);
  });
});

describe("query shape and edges", () => {
  it("highlights and crops the body, and filters every query", async () => {
    const inEn = (e: SearchEntry): SearchEntry => ({ ...e, locale: "en" });
    const mine = many("event", 5, "2", "m").map(inEn);
    const rest = many("event", 30, "1", "r").map(inEn);
    const f = fake([...mine, ...rest]);
    await runSearch(
      f,
      "i",
      req({ q: "x", campus: "2", mode: "page", page: 1, locale: "en" }),
      NOW
    );
    const quick = fake([...mine, ...rest]);
    await runSearch(quick, "i", req({ campus: "2", locale: "en" }), NOW);
    const all = [...f.calls, ...quick.calls];
    expect(f.calls).toHaveLength(2);
    for (const q of all.flat()) {
      expect(q.filter).toContain('locale = "en"');
      expect(q.filter).toContain("visible_until >= 1795435200");
      const isResultQuery = q.limit !== 0 && q.hitsPerPage !== 0;
      if (isResultQuery) {
        expect(q.attributesToHighlight).toContain("body");
        expect(q.attributesToCrop).toContain("body");
      }
    }
  });

  it("uses the cropped body when the summary is empty", () => {
    const hit = toHit(
      hitWith({
        _formatted: { title: "t", summary: "", body: "cropped body" },
      }),
      "en"
    );
    expect(hit.snippet).toEqual([{ text: "cropped body", match: false }]);
  });

  it("clamps totalPages to the page cap", async () => {
    const r = await runSearch(
      fake(many("event", 1100, "all")),
      "i",
      req({ q: "x", mode: "page" }),
      NOW
    );
    if (r.mode !== "page") {
      throw new Error("mode");
    }
    expect(r.total).toBe(1100);
    expect(r.total_pages).toBe(50);
  });
});
