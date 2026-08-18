# WordPress → Appwrite Content Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/wp-import`, a three-phase (extract → transform → load) tool that migrates job positions, WooCommerce products, and WooCommerce orders from the WordPress site at biso.no into the Appwrite `app` database.

**Architecture:** Extract hits the WordPress REST API and writes raw JSON snapshots (no Appwrite credentials needed). Transform is pure, offline functions that map WordPress shapes to Appwrite row shapes, unit-tested against fixtures captured from the live site. Load writes to Appwrite, dry-run by default with an `--apply` flag, using deterministic row IDs (`wpjob<id>`, `wpprod<id>`, `wporder<id>`) so re-runs upsert instead of duplicating.

**Tech Stack:** Bun 1.3.1, TypeScript (strict), `bun:test`, `node-appwrite` (via `@repo/api`), `ai` + `@ai-sdk/openai` (`gpt-5-nano`) for translation, `zod` for validation.

**Spec:** `docs/superpowers/specs/2026-08-18-wordpress-content-import-design.md`

## Global Constraints

- **Package manager is Bun.** Never `npm`/`pnpm`. Add deps with `bun add <pkg> --filter=wp-import`. Shared versions use `"catalog:"` from the root `package.json` catalog.
- **Never import `appwrite`/`node-appwrite` directly in app code** — but this package is tooling, not app code, and follows `packages/api/scripts/*` precedent: importing `node-appwrite` directly in `src/load/*` and `scripts/*` is correct here.
- **Do not edit** `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts` — both are generated. Read them; never write them.
- **No Appwrite schema push is required.** The design deliberately avoids adding columns.
- **Ultracite/Biome governs formatting.** Run `bun x ultracite fix` before each commit.
- **TypeScript strict.** `bun run check-types` must pass before merging.
- **Campus name → Appwrite `campus.$id`** (verified live, treat as fixed): `Oslo`→`1`, `Bergen`→`2`, `Trondheim`→`3`, `Stavanger`→`4`, `National`→`5`.
- **Locale values** are exactly `"no"` and `"en"` (the `content_translations.locale` enum).
- **`content_translations` limits:** `title` ≤ 500 chars, `description` ≤ 8000, `short_description` ≤ 500. All three of `content_id`, `locale`, `title`, `description`, `content_type` are required.
- **Commit after every task.** Author as the repo owner; do **not** add a `Co-Authored-By: Claude` trailer.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/wp-import/package.json` | Workspace manifest, CLI scripts |
| `packages/wp-import/tsconfig.json` | Extends `@repo/typescript-config` |
| `packages/wp-import/src/types.ts` | Shared types across phases |
| `packages/wp-import/src/wp/client.ts` | WP REST fetch: pagination, retry, auth |
| `packages/wp-import/src/transform/html.ts` | WP/Gutenberg HTML → canonical block HTML |
| `packages/wp-import/src/transform/departments.ts` | Department name → Appwrite `Id` matcher |
| `packages/wp-import/src/transform/csv.ts` | Dependency-free CSV read/write |
| `packages/wp-import/src/transform/locale.ts` | Language detection + AI translation |
| `packages/wp-import/src/transform/products.ts` | WooCommerce product → `webshop_products` |
| `packages/wp-import/src/transform/jobs.ts` | WP job → `jobs` |
| `packages/wp-import/src/transform/orders.ts` | WooCommerce order → `orders` |
| `packages/wp-import/src/permissions.ts` | Replicated row-ACL builders |
| `packages/wp-import/src/extract/*.ts` | Per-type extractors writing snapshots |
| `packages/wp-import/src/load/*.ts` | Per-type Appwrite writers |
| `packages/wp-import/src/media.ts` | Image mirroring to the `media` bucket |
| `packages/wp-import/scripts/{extract,transform,load}.ts` | CLI entrypoints |
| `packages/wp-import/fixtures/*.json` | Real responses captured 2026-08-18 |

---

### Task 1: Package scaffold and WordPress REST client

**Files:**
- Create: `packages/wp-import/package.json`
- Create: `packages/wp-import/tsconfig.json`
- Create: `packages/wp-import/.gitignore`
- Create: `packages/wp-import/src/types.ts`
- Create: `packages/wp-import/src/wp/client.ts`
- Test: `packages/wp-import/src/wp/client.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `WpClient` class with `fetchAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]>` and `fetchJson<T>(path: string, params?: Record<string, string>): Promise<T>`; types `ContentLocale`, `FetchLike`, `ImportReport`, `RejectRow`; const `CAMPUS_IDS`.

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "@repo/wp-import",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "extract": "bun --env-file=.env scripts/extract.ts",
    "transform": "bun --env-file=.env scripts/transform.ts",
    "load": "bun --env-file=.env scripts/load.ts",
    "test": "bun test",
    "check-types": "tsc --noEmit",
    "lint": "biome lint ."
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  },
  "dependencies": {
    "@ai-sdk/openai": "catalog:",
    "@repo/shared": "workspace:*",
    "ai": "catalog:",
    "node-appwrite": "catalog:",
    "zod": "catalog:"
  }
}
```

- [ ] **Step 2: Create tsconfig and gitignore**

`packages/wp-import/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "strictNullChecks": true
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

(`packages/typescript-config` provides `base.json`, `nextjs.json` and
`react-library.json`. `packages/api` extends `react-library.json` because it
ships React types; this package is plain Node tooling, so `base.json` is correct.)

`packages/wp-import/.gitignore`:

```
snapshots/
reports/
.env
```

- [ ] **Step 3: Write shared types**

`packages/wp-import/src/types.ts`:

```ts
export type ContentLocale = "no" | "en";

/** Appwrite campus.$id values, verified live 2026-08-18. */
export const CAMPUS_IDS: Record<string, string> = {
  Bergen: "2",
  National: "5",
  Oslo: "1",
  Stavanger: "4",
  Trondheim: "3",
};

/**
 * Structural type for the `fetch` used by this package's clients.
 *
 * Deliberately NOT `typeof fetch`: Bun's global `fetch` type is merged with a
 * `fetch.preconnect` static, so a plain mock function can never satisfy it and
 * every test double would need an `as unknown as typeof fetch` double-cast.
 * A double-cast suppresses exactly the type errors that type-checking test
 * files exists to surface, so the seam is typed structurally instead.
 */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface RejectRow {
  /** WordPress post id. */
  sourceId: number;
  /** Human-readable identifier, e.g. the post title. */
  label: string;
  /** Why this row could not be imported. */
  reason: string;
}

export interface ImportReport {
  imported: number;
  rejected: RejectRow[];
  warnings: string[];
}
```

- [ ] **Step 4: Write the failing test for the WP client**

`packages/wp-import/src/wp/client.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { WpClient } from "./client";

function stubFetch(pages: Array<{ body: unknown; totalPages: number }>) {
  let call = 0;
  return async (): Promise<Response> => {
    const page = pages[call];
    call += 1;
    if (!page) {
      throw new Error("fetch called more times than expected");
    }
    return new Response(JSON.stringify(page.body), {
      headers: { "X-WP-TotalPages": String(page.totalPages) },
      status: 200,
    });
  };
}

describe("WpClient.fetchAllPages", () => {
  test("concatenates every page reported by X-WP-TotalPages", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubFetch([
        { body: [{ id: 1 }], totalPages: 2 },
        { body: [{ id: 2 }], totalPages: 2 },
      ]),
    });

    const rows = await client.fetchAllPages<{ id: number }>("/wp/v2/product");

    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("stops after one page when only one page exists", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubFetch([{ body: [{ id: 1 }], totalPages: 1 }]),
    });

    const rows = await client.fetchAllPages<{ id: number }>("/wp/v2/product");

    expect(rows).toHaveLength(1);
  });

  test("throws a descriptive error on 401 so a partial import cannot happen", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });

    await expect(client.fetchAllPages("/wc/v3/orders")).rejects.toThrow(
      "401"
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd packages/wp-import && bun test src/wp/client.test.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 6: Implement the client**

`packages/wp-import/src/wp/client.ts`:

```ts
const DEFAULT_PER_PAGE = "100";
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export interface WpClientOptions {
  baseUrl: string;
  /** WooCommerce consumer key — only required for /wc/v3 routes. */
  consumerKey?: string;
  consumerSecret?: string;
  fetchImpl?: FetchLike;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class WpClient {
  private readonly baseUrl: string;
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: WpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.consumerKey = options.consumerKey;
    this.consumerSecret = options.consumerSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/wp-json${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (path.startsWith("/wc/v3") && this.consumerKey && this.consumerSecret) {
      url.searchParams.set("consumer_key", this.consumerKey);
      url.searchParams.set("consumer_secret", this.consumerSecret);
    }
    return url.toString();
  }

  private async request(url: string): Promise<Response> {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: { "User-Agent": "biso-wp-import/1.0" },
      });
      if (response.ok) {
        return response;
      }
      if (!RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(
          `WordPress request failed with ${response.status} for ${url}`
        );
      }
      lastError = `${response.status}`;
      await sleep(2 ** attempt * 500);
    }
    throw new Error(
      `WordPress request failed after ${MAX_RETRIES} retries (${lastError}) for ${url}`
    );
  }

  async fetchJson<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const response = await this.request(this.buildUrl(path, params));
    return (await response.json()) as T;
  }

  async fetchAllPages<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = this.buildUrl(path, {
        per_page: DEFAULT_PER_PAGE,
        ...params,
        page: String(page),
      });
      const response = await this.request(url);
      const header = response.headers.get("X-WP-TotalPages");
      totalPages = header ? Number.parseInt(header, 10) || 1 : 1;
      const body = (await response.json()) as T[];
      rows.push(...(Array.isArray(body) ? body : []));
      page += 1;
    } while (page <= totalPages);

    return rows;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/wp/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Install and verify the workspace wiring**

Run from the repo root:

```bash
bun install
bun run check-types --filter=@repo/wp-import
```

Expected: the package resolves as a workspace member and type-checks clean.

- [ ] **Step 9: Commit**

```bash
git add packages/wp-import bun.lock
git commit -m "feat(wp-import): scaffold package and WordPress REST client"
```

---

### Task 2: HTML normalization to the studio's block subset

The studio parses `content_translations.description` with `htmlToDescriptionBlocks()`, whose `TOP_LEVEL_BLOCK` regex is `/<figure\b([^>]*)>([\s\S]*?)<\/figure>|<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\3>/gi`. **Anything not `figure`/`h1-6`/`p`/`li` at top level is silently dropped**, and inline markup inside those tags is stripped by `stripHtml`. The serializer `descriptionBlocksToHtml()` emits `<p>…</p>`, `<h3>…</h3>` (every heading level collapses to `h3`), and `<ul><li>…</li></ul>`, joined with no separator, text HTML-escaped.

So this transform must emit **exactly that canonical form**, guaranteeing a clean round-trip.

**Files:**
- Create: `packages/wp-import/src/transform/html.ts`
- Test: `packages/wp-import/src/transform/html.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeDescriptionHtml(rawHtml: string, maxLength?: number): { html: string; truncated: boolean }` and `decodeEntities(value: string): string` and `plainTextExcerpt(rawHtml: string, maxLength: number): string`.

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/html.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  decodeEntities,
  normalizeDescriptionHtml,
  plainTextExcerpt,
} from "./html";

describe("decodeEntities", () => {
  test("decodes numeric entities WordPress emits in titles", () => {
    expect(decodeEntities("Booklocker &#8211; Campus Oslo")).toBe(
      "Booklocker – Campus Oslo"
    );
  });

  test("decodes named entities", () => {
    expect(decodeEntities("Marketing &amp; PR")).toBe("Marketing & PR");
  });

  test("decodes hex entities", () => {
    expect(decodeEntities("caf&#x e9;".replace(" ", ""))).toBe("café");
  });
});

describe("normalizeDescriptionHtml", () => {
  test("keeps Gutenberg paragraphs and strips inline markup and classes", () => {
    const input =
      '<p class="wp-block-paragraph"><strong>BI Student Organisation Bergen</strong></p>';

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>BI Student Organisation Bergen</p>"
    );
  });

  test("collapses every heading level to h3, matching the serializer", () => {
    expect(normalizeDescriptionHtml("<h1>Om oss</h1>").html).toBe(
      "<h3>Om oss</h3>"
    );
    expect(normalizeDescriptionHtml("<h5>Om oss</h5>").html).toBe(
      "<h3>Om oss</h3>"
    );
  });

  test("groups consecutive list items into a single ul", () => {
    const input = "<ul><li>Ett</li><li>To</li></ul>";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<ul><li>Ett</li><li>To</li></ul>"
    );
  });

  test("rescues unsupported containers into paragraphs instead of dropping them", () => {
    const input = "<div>Viktig informasjon</div>";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>Viktig informasjon</p>"
    );
  });

  test("converts plain-text content with blank-line breaks into paragraphs", () => {
    const input = "Første avsnitt\n\n\n\nAndre avsnitt";

    expect(normalizeDescriptionHtml(input).html).toBe(
      "<p>Første avsnitt</p><p>Andre avsnitt</p>"
    );
  });

  test("escapes text so the output round-trips through the studio parser", () => {
    expect(normalizeDescriptionHtml("<p>Ben & Jerry</p>").html).toBe(
      "<p>Ben &amp; Jerry</p>"
    );
  });

  test("drops empty blocks", () => {
    expect(normalizeDescriptionHtml("<p></p><p>Tekst</p>").html).toBe(
      "<p>Tekst</p>"
    );
  });

  test("truncates on a block boundary and reports it", () => {
    const long = `<p>${"a".repeat(60)}</p><p>${"b".repeat(60)}</p>`;
    const result = normalizeDescriptionHtml(long, 80);

    expect(result.truncated).toBe(true);
    expect(result.html).toBe(`<p>${"a".repeat(60)}</p>`);
    expect(result.html.length).toBeLessThanOrEqual(80);
  });

  test("returns an empty paragraph for empty input rather than throwing", () => {
    expect(normalizeDescriptionHtml("").html).toBe("<p></p>");
  });
});

describe("plainTextExcerpt", () => {
  test("strips markup and truncates on a word boundary", () => {
    const input = "<p>Karrieredagene rekrutterer en ny manager for 2026</p>";

    expect(plainTextExcerpt(input, 30)).toBe("Karrieredagene rekrutterer en…");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/html.test.ts`
Expected: FAIL — cannot resolve `./html`.

- [ ] **Step 3: Implement the normalizer**

`packages/wp-import/src/transform/html.ts`:

```ts
/**
 * Produces exactly the HTML that `descriptionBlocksToHtml()` in
 * apps/admin/src/app/(portal)/_components/description-blocks.ts emits, so that
 * imported descriptions round-trip cleanly through `htmlToDescriptionBlocks()`.
 * That parser only recognises top-level <figure>, <h1-6>, <p> and <li>; anything
 * else is silently dropped, which is why unsupported containers are rescued into
 * paragraphs here rather than passed through.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  lt: "<",
  laquo: "«",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const BLOCK_PATTERN =
  /<(h[1-6]|p|li|div|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;
const PARAGRAPH_SPLIT_PATTERN = /\n\s*\n/;

export function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toPlainText(value: string): string {
  return decodeEntities(value.replace(TAG_PATTERN, " "))
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

type Block = { tag: "h" | "l" | "p"; text: string };

function blockTag(rawTag: string): "h" | "l" | "p" {
  const lower = rawTag.toLowerCase();
  if (lower.startsWith("h")) {
    return "h";
  }
  return lower === "li" ? "l" : "p";
}

function parseBlocks(rawHtml: string): Block[] {
  const blocks: Block[] = [];
  BLOCK_PATTERN.lastIndex = 0;
  let match = BLOCK_PATTERN.exec(rawHtml);

  while (match) {
    const [, rawTag, inner] = match;
    // A container may itself hold block children (e.g. <div><p>x</p></div>).
    // Recurse so the inner blocks keep their own semantics.
    const nested = parseBlocks(inner ?? "");
    if (nested.length > 0) {
      blocks.push(...nested);
    } else {
      const text = toPlainText(inner ?? "");
      if (text) {
        blocks.push({ tag: blockTag(rawTag ?? "p"), text });
      }
    }
    match = BLOCK_PATTERN.exec(rawHtml);
  }

  return blocks;
}

function serialize(blocks: Block[]): string {
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      parts.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) {
      continue;
    }
    if (block.tag === "l") {
      listItems.push(`<li>${text}</li>`);
      continue;
    }
    flushList();
    parts.push(block.tag === "h" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }

  flushList();
  return parts.join("");
}

/** Truncate on a block boundary so output is never malformed HTML. */
function truncateBlocks(
  blocks: Block[],
  maxLength: number
): { blocks: Block[]; truncated: boolean } {
  const kept: Block[] = [];
  for (const block of blocks) {
    const candidate = [...kept, block];
    if (serialize(candidate).length > maxLength) {
      return { blocks: kept, truncated: true };
    }
    kept.push(block);
  }
  return { blocks: kept, truncated: false };
}

export function normalizeDescriptionHtml(
  rawHtml: string,
  maxLength = 8000
): { html: string; truncated: boolean } {
  let blocks = parseBlocks(rawHtml);

  if (blocks.length === 0) {
    // Plain-text source (the /custom/v1/jobs `content` field is plain text with
    // blank-line paragraph breaks).
    const text = decodeEntities(rawHtml.replace(TAG_PATTERN, " "));
    blocks = text
      .split(PARAGRAPH_SPLIT_PATTERN)
      .map((part) => part.replace(WHITESPACE_PATTERN, " ").trim())
      .filter((part) => part.length > 0)
      .map((part) => ({ tag: "p" as const, text: part }));
  }

  const limited = truncateBlocks(blocks, maxLength);
  const html = serialize(limited.blocks);

  return {
    html: html || "<p></p>",
    truncated: limited.truncated,
  };
}

export function plainTextExcerpt(rawHtml: string, maxLength: number): string {
  const text = toPlainText(rawHtml);
  if (text.length <= maxLength) {
    return text;
  }
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/html.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/html.ts packages/wp-import/src/transform/html.test.ts
git commit -m "feat(wp-import): normalize WordPress HTML into the studio block subset"
```

---

### Task 3: Dependency-free CSV reader/writer

Needed by the department mapping review loop. Department names contain hyphens and non-ASCII but may also contain commas, so quoting must be handled.

**Files:**
- Create: `packages/wp-import/src/transform/csv.ts`
- Test: `packages/wp-import/src/transform/csv.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseCsv(text: string): Array<Record<string, string>>` and `toCsv(rows: Array<Record<string, string>>, columns: string[]): string`.

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/csv.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  test("parses a header row and data rows into objects", () => {
    const text = "wp_name,resolved_id\nKarrieredagene,803\n";

    expect(parseCsv(text)).toEqual([
      { resolved_id: "803", wp_name: "Karrieredagene" },
    ]);
  });

  test("respects quoted fields containing commas", () => {
    const text = 'wp_name,suggested_name\nNU,"BRG NU, Bergen"\n';

    expect(parseCsv(text)[0]?.suggested_name).toBe("BRG NU, Bergen");
  });

  test("unescapes doubled quotes inside quoted fields", () => {
    const text = 'a\n"He said ""hi"""\n';

    expect(parseCsv(text)[0]?.a).toBe('He said "hi"');
  });

  test("returns an empty array for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("toCsv", () => {
  test("writes a header and quotes fields that need it", () => {
    const csv = toCsv(
      [{ name: "BRG NU, Bergen", id: "313" }],
      ["id", "name"]
    );

    expect(csv).toBe('id,name\n313,"BRG NU, Bergen"\n');
  });

  test("round-trips through parseCsv", () => {
    const rows = [{ a: 'x"y', b: "z,w" }];

    expect(parseCsv(toCsv(rows, ["a", "b"]))).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/csv.test.ts`
Expected: FAIL — cannot resolve `./csv`.

- [ ] **Step 3: Implement the CSV helpers**

`packages/wp-import/src/transform/csv.ts`:

```ts
const NEEDS_QUOTING = /[",\n]/;

function splitRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (inQuotes) {
      if (char === '"') {
        if (row[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields;
}

/** Split on newlines that are not inside a quoted field. */
function splitRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === "\n" && !inQuotes) {
      rows.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    rows.push(current);
  }

  return rows.map((row) => row.replace(/\r$/, "")).filter((row) => row !== "");
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = splitRows(text);
  const header = rows.shift();
  if (!header) {
    return [];
  }
  const columns = splitRow(header);

  return rows.map((row) => {
    const values = splitRow(row);
    const record: Record<string, string> = {};
    for (const [index, column] of columns.entries()) {
      record[column] = values[index] ?? "";
    }
    return record;
  });
}

function escapeField(value: string): string {
  return NEEDS_QUOTING.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function toCsv(
  rows: Array<Record<string, string>>,
  columns: string[]
): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeField(row[c] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/csv.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/csv.ts packages/wp-import/src/transform/csv.test.ts
git commit -m "feat(wp-import): add dependency-free CSV reader and writer"
```

---

### Task 4: Department name matcher

Appwrite has 263 departments whose `Name` carries a campus prefix (`OSL `, `BRG `, `TRD `, `STV `) and often a status suffix (`- nedlagt`, `- overført til BIA`, `- lagt ned`, `- inaktiv`, `- flyttet til nasjonalt`, `(bruk …)`). WordPress supplies bare names (`"Karrieredagene"`, `"HR advisor"`, `"academic association"`).

**Candidates are restricted to departments on the job's campus.** That is the single biggest precision win — it cuts 263 candidates to at most 94.

**Files:**
- Create: `packages/wp-import/src/transform/departments.ts`
- Test: `packages/wp-import/src/transform/departments.test.ts`

**Interfaces:**
- Consumes: `CAMPUS_IDS` from `../types`.
- Produces:
  - `interface DepartmentRecord { Id: string; Name: string; campus_id: string }`
  - `interface DepartmentMatch { departmentId: string | null; matchedName: string | null; confidence: number }`
  - `normalizeDepartmentName(name: string): string`
  - `matchDepartment(wpName: string, campusId: string, departments: DepartmentRecord[]): DepartmentMatch`
  - `AUTO_ACCEPT_CONFIDENCE = 0.85`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/departments.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  AUTO_ACCEPT_CONFIDENCE,
  type DepartmentRecord,
  matchDepartment,
  normalizeDepartmentName,
} from "./departments";

const DEPARTMENTS: DepartmentRecord[] = [
  { Id: "1", Name: "Drift Campus Oslo", campus_id: "1" },
  { Id: "9", Name: "OSL FINANS (bachelor)", campus_id: "1" },
  { Id: "11", Name: "OSL IM - International Management", campus_id: "1" },
  { Id: "21", Name: "OSL Bergensbaneløpet", campus_id: "1" },
  { Id: "309", Name: "BRG Fagutvalget", campus_id: "2" },
  { Id: "310", Name: "BRG Retail Management", campus_id: "2" },
  { Id: "354", Name: "BRG Dans  - overført til BIA", campus_id: "2" },
  { Id: "803", Name: "STV Karrieredagene", campus_id: "4" },
  { Id: "1005", Name: "HR", campus_id: "5" },
];

describe("normalizeDepartmentName", () => {
  test("strips the campus prefix", () => {
    expect(normalizeDepartmentName("OSL Bergensbaneløpet")).toBe(
      "bergensbanelopet"
    );
  });

  test("strips status suffixes", () => {
    expect(normalizeDepartmentName("BRG Dans  - overført til BIA")).toBe(
      "dans"
    );
    expect(normalizeDepartmentName("STV ØAF - nedlagt")).toBe("oaf");
  });

  test("folds Norwegian characters", () => {
    expect(normalizeDepartmentName("Økonomiansvarlig")).toBe(
      "okonomiansvarlig"
    );
    expect(normalizeDepartmentName("Næringslivsutvalget")).toBe(
      "naeringslivsutvalget"
    );
  });

  test("drops parenthesised qualifiers", () => {
    expect(normalizeDepartmentName("OSL FINANS (bachelor)")).toBe("finans");
  });
});

describe("matchDepartment", () => {
  test("matches exactly on the same campus with full confidence", () => {
    const result = matchDepartment("Bergensbaneløpet", "1", DEPARTMENTS);

    expect(result.departmentId).toBe("21");
    expect(result.confidence).toBe(1);
  });

  test("never matches a department from another campus", () => {
    // "Karrieredagene" exists only under Stavanger (803).
    const result = matchDepartment("Karrieredagene", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
  });

  test("matches across the campus prefix", () => {
    const result = matchDepartment("Fagutvalget", "2", DEPARTMENTS);

    expect(result.departmentId).toBe("309");
  });

  test("matches on token overlap for partial names", () => {
    const result = matchDepartment("International Management", "1", DEPARTMENTS);

    expect(result.departmentId).toBe("11");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_ACCEPT_CONFIDENCE);
  });

  test("returns no match with low confidence for a job title, not a department", () => {
    const result = matchDepartment("HR advisor", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
    expect(result.confidence).toBeLessThan(AUTO_ACCEPT_CONFIDENCE);
  });

  test("returns no match for an unrelated free-text value", () => {
    const result = matchDepartment("academic association", "1", DEPARTMENTS);

    expect(result.departmentId).toBeNull();
  });

  test("still reports the best suggestion even below the threshold", () => {
    const result = matchDepartment("Retail", "2", DEPARTMENTS);

    expect(result.matchedName).toBe("BRG Retail Management");
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("handles an empty department list without throwing", () => {
    expect(matchDepartment("Anything", "1", []).departmentId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/departments.test.ts`
Expected: FAIL — cannot resolve `./departments`.

- [ ] **Step 3: Implement the matcher**

`packages/wp-import/src/transform/departments.ts`:

```ts
export const AUTO_ACCEPT_CONFIDENCE = 0.85;

export interface DepartmentRecord {
  Id: string;
  Name: string;
  campus_id: string;
}

export interface DepartmentMatch {
  departmentId: string | null;
  matchedName: string | null;
  confidence: number;
}

const CAMPUS_PREFIX = /^(osl|brg|trd|stv)\s+/i;
const STATUS_SUFFIX =
  /\s*[-–]\s*(nedlagt|lagt ned|inaktiv|overf(?:ø|o)rt til .*|flyttet til .*|bruk .*|n(?:å|a) et prosjekt.*|kan brukes.*|sl(?:å|a)tt sammen.*|engangsprosjekt.*)$/i;
const PARENTHESISED = /\([^)]*\)/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

const CHARACTER_FOLDS: Array<[RegExp, string]> = [
  [/æ/g, "ae"],
  [/ø/g, "oe"],
  [/å/g, "aa"],
];

export function normalizeDepartmentName(name: string): string {
  let value = name.toLowerCase().trim();
  value = value.replace(STATUS_SUFFIX, "");
  value = value.replace(CAMPUS_PREFIX, "");
  value = value.replace(PARENTHESISED, " ");
  for (const [pattern, replacement] of CHARACTER_FOLDS) {
    value = value.replace(pattern, replacement);
  }
  value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return value.replace(NON_ALPHANUMERIC, " ").trim().replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(value.split(" ").filter((token) => token.length > 0));
}

/** Sørensen–Dice coefficient over token sets. */
function tokenSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared += 1;
    }
  }
  return (2 * shared) / (a.size + b.size);
}

export function matchDepartment(
  wpName: string,
  campusId: string,
  departments: DepartmentRecord[]
): DepartmentMatch {
  const needle = normalizeDepartmentName(wpName);
  const candidates = departments.filter(
    (department) => department.campus_id === campusId
  );

  let best: DepartmentMatch = {
    confidence: 0,
    departmentId: null,
    matchedName: null,
  };

  for (const candidate of candidates) {
    const normalized = normalizeDepartmentName(candidate.Name);
    let score = 0;

    if (normalized === needle && needle.length > 0) {
      score = 1;
    } else if (
      needle.length > 0 &&
      (normalized.startsWith(`${needle} `) || normalized.endsWith(` ${needle}`))
    ) {
      score = 0.9;
    } else {
      score = tokenSimilarity(needle, normalized);
    }

    if (score > best.confidence) {
      best = {
        confidence: score,
        departmentId: null,
        matchedName: candidate.Name,
      };
      if (score >= AUTO_ACCEPT_CONFIDENCE) {
        best.departmentId = candidate.Id;
      }
    }
  }

  return best;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/departments.test.ts`
Expected: PASS. If `"International Management"` scores below 0.85, adjust the substring rule — do **not** lower `AUTO_ACCEPT_CONFIDENCE`, since the threshold is what keeps wrong departments out.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/departments.ts packages/wp-import/src/transform/departments.test.ts
git commit -m "feat(wp-import): add campus-scoped department name matcher"
```

---

### Task 5: Language detection and AI translation

The Polylang locale is unreliable, so the *written* language is detected from the text. Only low-confidence cases cost an AI call. The authored text is never sent through the model for its own locale — it is stored verbatim.

**Files:**
- Create: `packages/wp-import/src/transform/locale.ts`
- Test: `packages/wp-import/src/transform/locale.test.ts`

**Interfaces:**
- Consumes: `ContentLocale` from `../types`.
- Produces:
  - `detectLocale(text: string): { locale: ContentLocale; confidence: number }`
  - `otherLocale(locale: ContentLocale): ContentLocale`
  - `translateFields(input: { contentType: string; fields: Array<{ key: string; value: string }>; sourceLocale: ContentLocale; targetLocale: ContentLocale }): Promise<Record<string, string>>`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/locale.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { detectLocale, otherLocale } from "./locale";

const NORWEGIAN =
  "Karrieredagene rekrutterer til en ny PR and Communications manager for 2026. " +
  "Karrieredagene ønsker å være Norges ledende bindeledd mellom studenter og bedrifter. " +
  "Som Communications Manager vil ditt hovedansvar være å formidle informasjon til studentene.";

const ENGLISH =
  "The Business Relations Committee is looking for a new Marketing Manager. " +
  "You will be responsible for the committee's external communication and visibility, " +
  "and you will play an important role in how we are perceived by students and partners.";

describe("detectLocale", () => {
  test("detects Norwegian from stopwords and æøå", () => {
    expect(detectLocale(NORWEGIAN).locale).toBe("no");
  });

  test("detects English", () => {
    expect(detectLocale(ENGLISH).locale).toBe("en");
  });

  test("is confident about a clearly Norwegian body", () => {
    expect(detectLocale(NORWEGIAN).confidence).toBeGreaterThan(0.6);
  });

  test("reports low confidence for text too short to judge", () => {
    expect(detectLocale("Manager").confidence).toBeLessThan(0.6);
  });

  test("does not treat an English title on a Norwegian body as English", () => {
    const mixed = `PR and Communications Manager Karrieredagene 2026! ${NORWEGIAN}`;

    expect(detectLocale(mixed).locale).toBe("no");
  });

  test("handles empty input without throwing", () => {
    expect(detectLocale("").confidence).toBe(0);
  });
});

describe("otherLocale", () => {
  test("maps no to en and back", () => {
    expect(otherLocale("no")).toBe("en");
    expect(otherLocale("en")).toBe("no");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/locale.test.ts`
Expected: FAIL — cannot resolve `./locale`.

- [ ] **Step 3: Implement detection and translation**

`packages/wp-import/src/transform/locale.ts`:

```ts
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ContentLocale } from "../types";

/** Frequent Norwegian Bokmål function words that are rare in English. */
const NORWEGIAN_MARKERS = [
  "og", "som", "til", "ikke", "være", "har", "med", "for", "det", "den",
  "av", "en", "et", "er", "på", "vi", "du", "din", "ditt", "vil", "kan",
  "skal", "eller", "men", "å", "om", "ved", "fra", "under", "mellom",
];

/** Frequent English function words that are rare in Norwegian. */
const ENGLISH_MARKERS = [
  "the", "and", "you", "will", "with", "for", "are", "have", "this", "that",
  "your", "our", "from", "they", "their", "which", "about", "would", "should",
  "been", "we", "of", "to", "in", "is", "as",
];

const NORWEGIAN_LETTERS = /[æøå]/gi;
const WORD_PATTERN = /[\p{L}]+/gu;
const MIN_WORDS_FOR_CONFIDENCE = 20;

export function otherLocale(locale: ContentLocale): ContentLocale {
  return locale === "no" ? "en" : "no";
}

export function detectLocale(text: string): {
  locale: ContentLocale;
  confidence: number;
} {
  const words = (text.toLowerCase().match(WORD_PATTERN) ?? []).filter(
    (word) => word.length > 0
  );
  if (words.length === 0) {
    return { confidence: 0, locale: "no" };
  }

  const norwegianSet = new Set(NORWEGIAN_MARKERS);
  const englishSet = new Set(ENGLISH_MARKERS);
  let norwegian = 0;
  let english = 0;

  for (const word of words) {
    if (norwegianSet.has(word)) {
      norwegian += 1;
    }
    // "for" and "we" appear in both lists; only count as English when the word
    // is not also a Norwegian marker, so shared words stay neutral.
    if (englishSet.has(word) && !norwegianSet.has(word)) {
      english += 1;
    }
  }

  // æ/ø/å are decisive: they essentially never occur in English copy.
  norwegian += (text.match(NORWEGIAN_LETTERS) ?? []).length * 2;

  const total = norwegian + english;
  if (total === 0) {
    return { confidence: 0, locale: "no" };
  }

  const locale: ContentLocale = norwegian >= english ? "no" : "en";
  const margin = Math.abs(norwegian - english) / total;
  // Short texts cannot be judged confidently no matter how lopsided the margin.
  const lengthFactor = Math.min(1, words.length / MIN_WORDS_FOR_CONFIDENCE);

  return { confidence: margin * lengthFactor, locale };
}

const translationSchema = z.object({
  translations: z.array(
    z.object({ key: z.string(), translated: z.string() })
  ),
});

const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  en: "English",
  no: "Norwegian Bokmål",
};

export interface TranslateFieldsInput {
  contentType: string;
  fields: Array<{ key: string; value: string }>;
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
}

/**
 * Mirrors translateContentFields() in
 * apps/admin/src/lib/content-translation.server.ts, minus the next/server
 * coupling. Kept local because the importer also needs language detection and
 * must run outside a Next.js request context.
 */
export async function translateFields({
  contentType,
  fields,
  sourceLocale,
  targetLocale,
}: TranslateFieldsInput): Promise<Record<string, string>> {
  if (sourceLocale === targetLocale) {
    throw new Error("Source and target locales must differ");
  }

  const result: Record<string, string> = Object.fromEntries(
    fields.map((field) => [field.key, ""])
  );
  const nonEmpty = fields.filter((field) => field.value.trim().length > 0);
  if (nonEmpty.length === 0) {
    return result;
  }

  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    prompt: [
      `Translate the following ${contentType} fields from ${LANGUAGE_NAMES[sourceLocale]} to ${LANGUAGE_NAMES[targetLocale]}.`,
      "Preserve the HTML structure exactly: keep every <p>, <h3>, <ul> and <li> tag and their order.",
      "Translate only the visible text. Do not add, remove, reorder or summarise content.",
      "Return one entry per field, keyed by the given key.",
      "",
      ...nonEmpty.map((field) => `[${field.key}]\n${field.value}`),
    ].join("\n"),
    schema: translationSchema,
  });

  for (const entry of object.translations) {
    if (entry.key in result) {
      result[entry.key] = entry.translated;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/locale.test.ts`
Expected: PASS (7 tests). `translateFields` is not unit-tested — it is a thin wrapper over the AI SDK and is exercised in the Task 10 end-to-end run.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/locale.ts packages/wp-import/src/transform/locale.test.ts
git commit -m "feat(wp-import): add language detection and AI translation"
```

---

### Task 6: Row permission builders

Wrong ACLs mean imported content is invisible on the public site.

The staff grants are **not** replicated: `buildRecruitmentStaffRowPermissions()`
is already exported from `@repo/shared/recruitment` (`packages/shared/recruitment.ts:39`),
so this package imports it directly and cannot drift. Only the thin
visibility wrapper is local, mirroring `buildJobRowPermissions()` in
`apps/admin/src/lib/recruitment.ts:138` and `buildContentTranslationPermissions()`
in `apps/admin/src/lib/utils.ts:166`.

**Files:**
- Create: `packages/wp-import/src/permissions.ts`
- Test: `packages/wp-import/src/permissions.test.ts`

**Interfaces:**
- Consumes: `Permission`, `Role` from `node-appwrite`; `buildRecruitmentStaffRowPermissions` from `@repo/shared/recruitment`.
- Produces: `buildPublicContentPermissions(status: string): string[]` and `buildJobPermissions(status: string): string[]`.

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/permissions.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildJobPermissions, buildPublicContentPermissions } from "./permissions";

describe("buildPublicContentPermissions", () => {
  test("grants public read to published content", () => {
    expect(buildPublicContentPermissions("published")).toEqual(['read("any")']);
  });

  test("grants nothing to draft content", () => {
    expect(buildPublicContentPermissions("draft")).toEqual([]);
  });

  test("grants nothing to archived content", () => {
    expect(buildPublicContentPermissions("archived")).toEqual([]);
  });
});

describe("buildJobPermissions", () => {
  test("published jobs are publicly readable", () => {
    expect(buildJobPermissions("published")).toContain('read("any")');
  });

  test("closed jobs are not publicly readable", () => {
    expect(buildJobPermissions("closed")).not.toContain('read("any")');
  });

  test("closed jobs still carry the staff grants", () => {
    expect(buildJobPermissions("closed").length).toBeGreaterThan(0);
  });

  test("does not emit duplicate permission strings", () => {
    const permissions = buildJobPermissions("published");

    expect(new Set(permissions).size).toBe(permissions.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/permissions.test.ts`
Expected: FAIL — cannot resolve `./permissions`.

- [ ] **Step 3: Implement the builders**

`packages/wp-import/src/permissions.ts`:

```ts
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { Permission, Role } from "node-appwrite";

/**
 * Visibility half of the row ACLs, mirroring buildJobRowPermissions() in
 * apps/admin/src/lib/recruitment.ts and buildContentTranslationPermissions()
 * in apps/admin/src/lib/utils.ts. The staff half is imported from
 * @repo/shared/recruitment rather than copied, so it cannot drift.
 *
 * Imported content is only visible on the public site when these strings are
 * right, so permissions.test.ts pins the behaviour.
 */
export function buildPublicContentPermissions(status: string): string[] {
  return status === "published" ? [Permission.read(Role.any())] : [];
}

export function buildJobPermissions(status: string): string[] {
  const visibility =
    status === "published" ? [Permission.read(Role.any())] : [];
  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
  ];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/permissions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/permissions.ts packages/wp-import/src/permissions.test.ts
git commit -m "feat(wp-import): replicate content row permission builders"
```

---

### Task 7: Extract phase and CLI

**Files:**
- Create: `packages/wp-import/src/extract/index.ts`
- Create: `packages/wp-import/scripts/extract.ts`
- Create: `packages/wp-import/.env.example`
- Test: `packages/wp-import/src/extract/index.test.ts`

**Interfaces:**
- Consumes: `WpClient` (Task 1).
- Produces:
  - `interface WpJob { id: number; title: string; content: string; slug: string; campus: string[]; department: string[]; verv: string[]; url: string; date_posted: string; expiry_date: string | null; is_expired: boolean; location: string | null; job_type: string | null; thumbnail: unknown[] }`
  - `interface WpJobPost { id: number; slug: string; date: string; link: string; status: string; content: { rendered: string }; title: { rendered: string } }`
  - `interface WpProductPost { id: number; slug: string; status: string; title: { rendered: string }; content: { rendered: string }; acf: Record<string, string | false> }`
  - `interface WcStoreProduct { id: number; name: string; slug: string; type: string; description: string; short_description: string; prices: { price: string; currency_minor_unit: number; price_range: { min_amount: string; max_amount: string } | null }; images: Array<{ id: number; src: string; alt: string }>; categories: Array<{ id: number; name: string; slug: string }>; variations: Array<{ id: number; attributes: Array<{ name: string; value: string }> }> }`
  - `interface WcOrder { id: number; status: string; currency: string; total: string; discount_total: string; date_created: string; payment_method_title: string; billing: { first_name: string; last_name: string; email: string; phone: string }; line_items: Array<{ product_id: number; name: string; quantity: number; price: number; total: string }> }`
  - `extractJobs(client: WpClient, sinceIso: string): Promise<Array<WpJob & { post: WpJobPost }>>`
  - `extractProducts(client: WpClient): Promise<Array<WpProductPost & { store: WcStoreProduct | null }>>`
  - `extractOrders(client: WpClient): Promise<WcOrder[]>`
  - `parseSince(value: string, now: Date): string`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/extract/index.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { parseSince } from "./index";

describe("parseSince", () => {
  const now = new Date("2026-08-18T00:00:00.000Z");

  test("parses a month window", () => {
    expect(parseSince("3m", now)).toBe("2026-05-18T00:00:00.000Z");
  });

  test("parses a day window", () => {
    expect(parseSince("30d", now)).toBe("2026-07-19T00:00:00.000Z");
  });

  test("parses a year window", () => {
    expect(parseSince("1y", now)).toBe("2025-08-18T00:00:00.000Z");
  });

  test("passes an explicit ISO date through", () => {
    expect(parseSince("2026-01-01", now)).toBe("2026-01-01T00:00:00.000Z");
  });

  test("returns the epoch for 'all'", () => {
    expect(parseSince("all", now)).toBe("1970-01-01T00:00:00.000Z");
  });

  test("throws on an unparseable window", () => {
    expect(() => parseSince("banana", now)).toThrow("Unrecognised --since");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/extract/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement the extractors**

`packages/wp-import/src/extract/index.ts`:

```ts
import type { WpClient } from "../wp/client";

export interface WpJob {
  campus: string[];
  content: string;
  department: string[];
  expiry_date: string | null;
  id: number;
  is_expired: boolean;
  job_type: string | null;
  location: string | null;
  slug: string;
  thumbnail: unknown[];
  title: string;
  url: string;
  verv: string[];
  date_posted: string;
}

export interface WpJobPost {
  content: { rendered: string };
  date: string;
  id: number;
  link: string;
  slug: string;
  status: string;
  title: { rendered: string };
}

export interface WpProductPost {
  acf: Record<string, string | false>;
  content: { rendered: string };
  id: number;
  slug: string;
  status: string;
  title: { rendered: string };
}

export interface WcStoreProduct {
  categories: Array<{ id: number; name: string; slug: string }>;
  description: string;
  id: number;
  images: Array<{ alt: string; id: number; src: string }>;
  name: string;
  prices: {
    currency_minor_unit: number;
    price: string;
    price_range: { max_amount: string; min_amount: string } | null;
  };
  short_description: string;
  slug: string;
  type: string;
  variations: Array<{
    attributes: Array<{ name: string; value: string }>;
    id: number;
  }>;
}

export interface WcOrder {
  billing: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  currency: string;
  date_created: string;
  discount_total: string;
  id: number;
  line_items: Array<{
    name: string;
    price: number;
    product_id: number;
    quantity: number;
    total: string;
  }>;
  payment_method_title: string;
  status: string;
  total: string;
}

const RELATIVE_WINDOW = /^(\d+)([dmy])$/;

export function parseSince(value: string, now: Date): string {
  if (value === "all") {
    return new Date(0).toISOString();
  }

  const relative = RELATIVE_WINDOW.exec(value);
  if (relative) {
    const amount = Number.parseInt(relative[1] ?? "0", 10);
    const unit = relative[2];
    const date = new Date(now.getTime());
    if (unit === "d") {
      date.setUTCDate(date.getUTCDate() - amount);
    } else if (unit === "m") {
      date.setUTCMonth(date.getUTCMonth() - amount);
    } else {
      date.setUTCFullYear(date.getUTCFullYear() - amount);
    }
    return date.toISOString();
  }

  const explicit = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(explicit.getTime())) {
    throw new Error(`Unrecognised --since value: ${value}`);
  }
  return explicit.toISOString();
}

/**
 * Jobs need two sources joined on the post id: /custom/v1/jobs is the only
 * endpoint that resolves the campus/verv taxonomies (they are not registered
 * with show_in_rest), and /wp/v2/awsm_job_openings is the only source of the
 * raw post content and date.
 */
export async function extractJobs(
  client: WpClient,
  sinceIso: string
): Promise<Array<WpJob & { post: WpJobPost }>> {
  const posts = await client.fetchAllPages<WpJobPost>(
    "/wp/v2/awsm_job_openings"
  );
  const postsById = new Map(posts.map((post) => [post.id, post]));

  const custom: WpJob[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const body = await client.fetchJson<{
      jobs: WpJob[];
      pagination: { total_pages: number };
    }>("/custom/v1/jobs", {
      includeExpired: "true",
      page: String(page),
      per_page: "100",
    });
    custom.push(...body.jobs);
    totalPages = body.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);

  const since = new Date(sinceIso).getTime();

  return custom.flatMap((job) => {
    const post = postsById.get(job.id);
    if (!post) {
      return [];
    }
    if (new Date(post.date).getTime() < since) {
      return [];
    }
    return [{ ...job, post }];
  });
}

/**
 * Products also need two sources: /wp/v2/product carries the ACF
 * campus/department IDs, /wc/store/v1/products carries prices and images.
 */
export async function extractProducts(
  client: WpClient
): Promise<Array<WpProductPost & { store: WcStoreProduct | null }>> {
  const posts = await client.fetchAllPages<WpProductPost>("/wp/v2/product");
  const store = await client.fetchAllPages<WcStoreProduct>(
    "/wc/store/v1/products"
  );
  const storeById = new Map(store.map((product) => [product.id, product]));

  return posts.map((post) => ({
    ...post,
    store: storeById.get(post.id) ?? null,
  }));
}

export async function extractOrders(client: WpClient): Promise<WcOrder[]> {
  return await client.fetchAllPages<WcOrder>("/wc/v3/orders", {
    status: "any",
  });
}
```

- [ ] **Step 4: Write the CLI**

`packages/wp-import/scripts/extract.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import {
  extractJobs,
  extractOrders,
  extractProducts,
  parseSince,
} from "../src/extract/index";
import { WpClient } from "../src/wp/client";

const args = new Set(process.argv.slice(2));
const sinceArg =
  process.argv.slice(2).find((a) => a.startsWith("--since="))?.split("=")[1] ??
  "3m";
const only = (name: string): boolean =>
  args.has(`--${name}`) || !(args.has("--jobs") || args.has("--products") || args.has("--orders"));

const baseUrl = process.env.WP_BASE_URL ?? "https://biso.no";
const client = new WpClient({
  baseUrl,
  consumerKey: process.env.WC_CONSUMER_KEY,
  consumerSecret: process.env.WC_CONSUMER_SECRET,
});

const outputDir = new URL("../snapshots/", import.meta.url).pathname;
await mkdir(outputDir, { recursive: true });

const since = parseSince(sinceArg, new Date());
console.log(`Extracting from ${baseUrl} (since ${since})`);

const write = async (name: string, data: unknown): Promise<void> => {
  await writeFile(`${outputDir}${name}.json`, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`  ${name}: ${count} records → snapshots/${name}.json`);
};

if (only("jobs")) {
  await write("jobs", await extractJobs(client, since));
}
if (only("products")) {
  await write("products", await extractProducts(client));
}
if (only("orders")) {
  if (!(process.env.WC_CONSUMER_KEY && process.env.WC_CONSUMER_SECRET)) {
    console.error(
      "Orders need WC_CONSUMER_KEY and WC_CONSUMER_SECRET in .env — skipping."
    );
  } else {
    await write("orders", await extractOrders(client));
  }
}
```

`packages/wp-import/.env.example`:

```
WP_BASE_URL=https://biso.no
WC_CONSUMER_KEY=
WC_CONSUMER_SECRET=
NEXT_PUBLIC_APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT=
APPWRITE_API_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 5: Run the tests and a real extraction**

```bash
cd packages/wp-import
bun test src/extract/index.test.ts
cp .env.example .env   # fill WP_BASE_URL only for this step
bun run extract --since=3m --jobs --products
```

Expected: tests PASS; `snapshots/jobs.json` holds ~99 records and `snapshots/products.json` ~56.

- [ ] **Step 6: Capture fixtures for later tasks**

```bash
mkdir -p fixtures
bun -e 'const j=require("./snapshots/jobs.json"); require("fs").writeFileSync("fixtures/jobs.sample.json", JSON.stringify(j.slice(0,5),null,2))'
bun -e 'const p=require("./snapshots/products.json"); const pick=[p.find(x=>x.store?.type==="variable"), p.find(x=>x.store?.images?.length), p.find(x=>!x.acf?.campus)].filter(Boolean); require("fs").writeFileSync("fixtures/products.sample.json", JSON.stringify(pick,null,2))'
```

These fixtures are **committed** — they are the real-data test inputs for Tasks 8–10.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/extract packages/wp-import/scripts/extract.ts packages/wp-import/.env.example packages/wp-import/fixtures
git commit -m "feat(wp-import): add extract phase and CLI"
```

---

### Task 8: Product transform

**Files:**
- Create: `packages/wp-import/src/transform/products.ts`
- Test: `packages/wp-import/src/transform/products.test.ts`

**Interfaces:**
- Consumes: `WpProductPost`, `WcStoreProduct` (Task 7); `normalizeDescriptionHtml`, `decodeEntities`, `plainTextExcerpt` (Task 2); `CAMPUS_IDS` (Task 1).
- Produces:
  - `interface TransformedProduct { rowId: string; row: Record<string, unknown>; descriptionHtml: string; title: string; shortDescription: string; imageUrls: string[]; memberVariantWarning: boolean }`
  - `transformProduct(input: WpProductPost & { store: WcStoreProduct | null }): { product: TransformedProduct | null; reject: RejectRow | null; warnings: string[] }`
  - `resolveAcfCampusAndDepartment(acf: Record<string, string | false>): { campusId: string | null; departmentId: string | null }`
  - `resolvePrice(store: WcStoreProduct): number | null`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/products.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  resolveAcfCampusAndDepartment,
  resolvePrice,
  transformProduct,
} from "./products";

const baseStore = {
  categories: [],
  description: "<p>Beskrivelse</p>",
  id: 65946,
  images: [],
  name: "overlapstur",
  prices: {
    currency_minor_unit: 0,
    price: "3000",
    price_range: null,
  },
  short_description: "",
  slug: "overlapstur",
  type: "simple",
  variations: [],
};

const basePost = {
  acf: { campus: "1", department_oslo: "21" },
  content: { rendered: "<p>Beskrivelse</p>" },
  id: 65946,
  slug: "overlapstur",
  status: "publish",
  title: { rendered: "overlapstur" },
};

describe("resolveAcfCampusAndDepartment", () => {
  test("reads the campus id and the matching department field", () => {
    expect(
      resolveAcfCampusAndDepartment({ campus: "1", department_oslo: "21" })
    ).toEqual({ campusId: "1", departmentId: "21" });
  });

  test("ignores department fields for other campuses", () => {
    expect(
      resolveAcfCampusAndDepartment({
        campus: "4",
        department_oslo: "21",
        department_stavanger: "801",
      })
    ).toEqual({ campusId: "4", departmentId: "801" });
  });

  test("treats false as unset", () => {
    expect(
      resolveAcfCampusAndDepartment({ campus: "5", department_national: false })
    ).toEqual({ campusId: "5", departmentId: null });
  });

  test("returns a null campus when ACF has none", () => {
    expect(resolveAcfCampusAndDepartment({}).campusId).toBeNull();
  });
});

describe("resolvePrice", () => {
  test("reads a simple product price", () => {
    expect(resolvePrice(baseStore)).toBe(3000);
  });

  test("applies currency_minor_unit rather than assuming zero", () => {
    const store = {
      ...baseStore,
      prices: { ...baseStore.prices, currency_minor_unit: 2, price: "300000" },
    };

    expect(resolvePrice(store)).toBe(3000);
  });

  test("uses the lowest variation price for a variable product", () => {
    const store = {
      ...baseStore,
      prices: {
        currency_minor_unit: 0,
        price: "250",
        price_range: { max_amount: "1500", min_amount: "250" },
      },
      type: "variable",
    };

    expect(resolvePrice(store)).toBe(250);
  });

  test("returns null when no price can be resolved", () => {
    const store = {
      ...baseStore,
      prices: { ...baseStore.prices, price: "" },
    };

    expect(resolvePrice(store)).toBeNull();
  });
});

describe("transformProduct", () => {
  test("builds a webshop_products row from ACF and store data", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      store: baseStore,
    });

    expect(reject).toBeNull();
    expect(product?.rowId).toBe("wpprod65946");
    expect(product?.row.campus_id).toBe("1");
    expect(product?.row.departmentId).toBe("21");
    expect(product?.row.regular_price).toBe(3000);
    expect(product?.row.status).toBe("published");
    expect(product?.row.slug).toBe("overlapstur");
  });

  test("decodes numeric HTML entities in the title", () => {
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, name: "Booklocker &#8211; Campus Oslo" },
      title: { rendered: "Booklocker &#8211; Campus Oslo" },
    });

    expect(product?.title).toBe("Booklocker – Campus Oslo");
  });

  test("rejects a product with no ACF campus, because campus_id is required", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      acf: {},
      store: baseStore,
    });

    expect(product).toBeNull();
    expect(reject?.reason).toContain("campus");
  });

  test("rejects a product with no resolvable price", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      store: { ...baseStore, prices: { ...baseStore.prices, price: "" } },
    });

    expect(product).toBeNull();
    expect(reject?.reason).toContain("price");
  });

  test("stores variations as variants_json", () => {
    const store = {
      ...baseStore,
      type: "variable",
      variations: [
        {
          attributes: [{ name: "Member status", value: "BISO member" }],
          id: 63463,
        },
      ],
      prices: {
        currency_minor_unit: 0,
        price: "250",
        price_range: { max_amount: "1500", min_amount: "250" },
      },
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(JSON.parse(String(product?.row.variants_json))).toHaveLength(1);
  });

  test("flags member-status variants instead of guessing member_price", () => {
    const store = {
      ...baseStore,
      type: "variable",
      variations: [
        {
          attributes: [{ name: "Member status", value: "BISO member" }],
          id: 63463,
        },
      ],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.memberVariantWarning).toBe(true);
    expect(product?.row.member_price).toBeUndefined();
  });

  test("collects image urls for mirroring", () => {
    const store = {
      ...baseStore,
      images: [{ alt: "", id: 1, src: "https://biso.no/wp-content/a.jpg" }],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.imageUrls).toEqual(["https://biso.no/wp-content/a.jpg"]);
  });

  test("falls back to post content when the store record is missing", () => {
    const { product } = transformProduct({ ...basePost, store: null });

    expect(product?.descriptionHtml).toBe("<p>Beskrivelse</p>");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/products.test.ts`
Expected: FAIL — cannot resolve `./products`.

- [ ] **Step 3: Implement the transform**

`packages/wp-import/src/transform/products.ts`:

```ts
import type { WcStoreProduct, WpProductPost } from "../extract/index";
import type { RejectRow } from "../types";
import { decodeEntities, normalizeDescriptionHtml, plainTextExcerpt } from "./html";

/** ACF department field suffix per Appwrite campus.$id. */
const DEPARTMENT_FIELD_BY_CAMPUS: Record<string, string> = {
  "1": "department_oslo",
  "2": "department_bergen",
  "3": "department_trondheim",
  "4": "department_stavanger",
  "5": "department_national",
};

const MEMBER_ATTRIBUTE = /member/i;

export interface TransformedProduct {
  /** Normalized, studio-safe HTML — not the raw WordPress source. */
  descriptionHtml: string;
  imageUrls: string[];
  memberVariantWarning: boolean;
  row: Record<string, unknown>;
  rowId: string;
  shortDescription: string;
  title: string;
}

export function resolveAcfCampusAndDepartment(
  acf: Record<string, string | false>
): { campusId: string | null; departmentId: string | null } {
  const rawCampus = acf.campus;
  const campusId =
    typeof rawCampus === "string" && rawCampus.length > 0 ? rawCampus : null;
  if (!campusId) {
    return { campusId: null, departmentId: null };
  }

  const field = DEPARTMENT_FIELD_BY_CAMPUS[campusId];
  const rawDepartment = field ? acf[field] : false;
  const departmentId =
    typeof rawDepartment === "string" && rawDepartment.length > 0
      ? rawDepartment
      : null;

  return { campusId, departmentId };
}

export function resolvePrice(store: WcStoreProduct): number | null {
  const raw =
    store.type === "variable" && store.prices.price_range
      ? store.prices.price_range.min_amount
      : store.prices.price;
  if (!raw) {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed / 10 ** (store.prices.currency_minor_unit ?? 0);
}

export function transformProduct(
  input: WpProductPost & { store: WcStoreProduct | null }
): {
  product: TransformedProduct | null;
  reject: RejectRow | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = decodeEntities(
    input.store?.name ?? input.title.rendered ?? ""
  ).trim();
  const label = title || input.slug;

  const { campusId, departmentId } = resolveAcfCampusAndDepartment(input.acf);
  if (!campusId) {
    return {
      product: null,
      reject: {
        label,
        reason: "No ACF campus set; webshop_products.campus_id is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  if (!title) {
    return {
      product: null,
      reject: {
        label: input.slug,
        reason: "No product title; content_translations.title is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const price = input.store ? resolvePrice(input.store) : null;
  if (price === null) {
    return {
      product: null,
      reject: {
        label,
        reason: "No resolvable price; webshop_products.regular_price is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const sourceHtml = input.store?.description || input.content.rendered || "";
  const description = normalizeDescriptionHtml(sourceHtml);
  if (description.truncated) {
    warnings.push(`Product ${input.id} description truncated to 8000 chars`);
  }

  const shortDescription = plainTextExcerpt(
    input.store?.short_description || sourceHtml,
    500
  );

  const variations = input.store?.variations ?? [];
  const memberVariantWarning = variations.some((variation) =>
    variation.attributes.some((attribute) =>
      MEMBER_ATTRIBUTE.test(attribute.name)
    )
  );
  if (memberVariantWarning) {
    warnings.push(
      `Product ${input.id} has member-status variants; set member_price manually`
    );
  }

  const imageUrls = (input.store?.images ?? []).map((image) => image.src);

  const row: Record<string, unknown> = {
    campus: campusId,
    campus_id: campusId,
    category: input.store?.categories?.[0]?.name ?? null,
    department: departmentId,
    departmentId,
    inventory_mode: "unlimited",
    regular_price: price,
    slug: input.slug,
    status: input.status === "publish" ? "published" : "draft",
    ...(variations.length > 0
      ? { variants_json: JSON.stringify(variations) }
      : {}),
  };

  return {
    product: {
      descriptionHtml: description.html,
      imageUrls,
      memberVariantWarning,
      row,
      rowId: `wpprod${input.id}`,
      shortDescription,
      title,
    },
    reject: null,
    warnings,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/products.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Verify against the real snapshot**

```bash
cd packages/wp-import
bun -e '
import { transformProduct } from "./src/transform/products";
const products = require("./snapshots/products.json");
const results = products.map(transformProduct);
console.log("ok:", results.filter(r => r.product).length);
console.log("rejected:", results.filter(r => r.reject).map(r => r.reject.reason));
'
```

Expected: 55 ok, 1 rejected for a missing ACF campus — matching the survey.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/products.ts packages/wp-import/src/transform/products.test.ts
git commit -m "feat(wp-import): add WooCommerce product transform"
```

---

### Task 9: Order transform

**Files:**
- Create: `packages/wp-import/src/transform/orders.ts`
- Test: `packages/wp-import/src/transform/orders.test.ts`

**Interfaces:**
- Consumes: `WcOrder` (Task 7).
- Produces:
  - `mapOrderStatus(wooStatus: string): string | null`
  - `transformOrder(order: WcOrder, userIdByEmail: Map<string, string>): { rowId: string; row: Record<string, unknown> } | { reject: RejectRow }`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/orders.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mapOrderStatus, transformOrder } from "./orders";

const baseOrder = {
  billing: {
    email: "student@biso.no",
    first_name: "Ola",
    last_name: "Nordmann",
    phone: "+4712345678",
  },
  currency: "NOK",
  date_created: "2026-03-01T10:00:00",
  discount_total: "0.00",
  id: 1234,
  line_items: [
    {
      name: "Booklocker",
      price: 250,
      product_id: 37313,
      quantity: 1,
      total: "250.00",
    },
  ],
  payment_method_title: "Vipps",
  status: "completed",
  total: "250.00",
};

describe("mapOrderStatus", () => {
  test("maps completed and processing to paid", () => {
    expect(mapOrderStatus("completed")).toBe("paid");
    expect(mapOrderStatus("processing")).toBe("paid");
  });

  test("maps on-hold and pending to pending", () => {
    expect(mapOrderStatus("on-hold")).toBe("pending");
    expect(mapOrderStatus("pending")).toBe("pending");
  });

  test("passes through terminal statuses", () => {
    expect(mapOrderStatus("cancelled")).toBe("cancelled");
    expect(mapOrderStatus("refunded")).toBe("refunded");
    expect(mapOrderStatus("failed")).toBe("failed");
  });

  test("returns null for an unknown status rather than guessing", () => {
    expect(mapOrderStatus("checkout-draft")).toBeNull();
  });
});

describe("transformOrder", () => {
  test("builds an orders row with a deterministic id", () => {
    const result = transformOrder(baseOrder, new Map());

    expect("row" in result).toBe(true);
    if (!("row" in result)) {
      return;
    }
    expect(result.rowId).toBe("wporder1234");
    expect(result.row.status).toBe("paid");
    expect(result.row.total).toBe(250);
    expect(result.row.currency).toBe("NOK");
    expect(result.row.buyer_email).toBe("student@biso.no");
    expect(result.row.buyer_name).toBe("Ola Nordmann");
  });

  test("points items_json product_id at the new Appwrite product id", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }
    const items = JSON.parse(String(result.row.items_json));

    expect(items[0].product_id).toBe("wpprod37313");
    expect(items[0].quantity).toBe(1);
    expect(items[0].unit_price).toBe(250);
  });

  test("links a known buyer email to an Appwrite user id", () => {
    const result = transformOrder(
      baseOrder,
      new Map([["student@biso.no", "user-abc"]])
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBe("user-abc");
  });

  test("leaves userId null for an unknown buyer", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBeNull();
  });

  test("matches buyer email case-insensitively", () => {
    const result = transformOrder(
      { ...baseOrder, billing: { ...baseOrder.billing, email: "Student@BISO.no" } },
      new Map([["student@biso.no", "user-abc"]])
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBe("user-abc");
  });

  test("rejects a non-NOK order rather than coercing the currency", () => {
    const result = transformOrder({ ...baseOrder, currency: "EUR" }, new Map());

    expect("reject" in result).toBe(true);
  });

  test("rejects an order with an unmappable status", () => {
    const result = transformOrder(
      { ...baseOrder, status: "checkout-draft" },
      new Map()
    );

    expect("reject" in result).toBe(true);
  });

  test("does not set finago or lock fields", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.finago_transaction_id).toBeUndefined();
    expect(result.row.transition_lock).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/orders.test.ts`
Expected: FAIL — cannot resolve `./orders`.

- [ ] **Step 3: Implement the transform**

`packages/wp-import/src/transform/orders.ts`:

```ts
import type { WcOrder } from "../extract/index";
import type { RejectRow } from "../types";

const STATUS_MAP: Record<string, string> = {
  cancelled: "cancelled",
  completed: "paid",
  failed: "failed",
  "on-hold": "pending",
  pending: "pending",
  processing: "paid",
  refunded: "refunded",
};

export function mapOrderStatus(wooStatus: string): string | null {
  return STATUS_MAP[wooStatus] ?? null;
}

export function transformOrder(
  order: WcOrder,
  userIdByEmail: Map<string, string>
):
  | { row: Record<string, unknown>; rowId: string }
  | { reject: RejectRow } {
  const label = `Order #${order.id}`;

  if (order.currency !== "NOK") {
    return {
      reject: {
        label,
        reason: `Currency ${order.currency} is not NOK; the column is a NOK-only enum`,
        sourceId: order.id,
      },
    };
  }

  const status = mapOrderStatus(order.status);
  if (!status) {
    return {
      reject: {
        label,
        reason: `Unmappable WooCommerce status "${order.status}"`,
        sourceId: order.id,
      },
    };
  }

  const total = Number.parseFloat(order.total);
  const discountTotal = Number.parseFloat(order.discount_total || "0");
  if (Number.isNaN(total)) {
    return {
      reject: {
        label,
        reason: "Order total is not a number; orders.total is required",
        sourceId: order.id,
      },
    };
  }

  const items = order.line_items.map((item) => ({
    name: item.name,
    product_id: `wpprod${item.product_id}`,
    quantity: item.quantity,
    title: item.name,
    unit_price: item.price,
  }));

  const subtotal = order.line_items.reduce(
    (sum, item) => sum + Number.parseFloat(item.total || "0"),
    0
  );

  const email = order.billing.email?.trim().toLowerCase() ?? "";
  const buyerName = `${order.billing.first_name} ${order.billing.last_name}`.trim();

  return {
    row: {
      buyer_email: order.billing.email || null,
      buyer_name: buyerName || null,
      buyer_phone: order.billing.phone || null,
      currency: "NOK",
      discount_total: Number.isNaN(discountTotal) ? 0 : discountTotal,
      items_json: JSON.stringify(items),
      payment_provider: order.payment_method_title || null,
      status,
      subtotal: Number.isNaN(subtotal) ? total : subtotal,
      total,
      userId: userIdByEmail.get(email) ?? null,
    },
    rowId: `wporder${order.id}`,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/orders.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/orders.ts packages/wp-import/src/transform/orders.test.ts
git commit -m "feat(wp-import): add WooCommerce order transform"
```

---

### Task 10: Job transform

**Files:**
- Create: `packages/wp-import/src/transform/jobs.ts`
- Test: `packages/wp-import/src/transform/jobs.test.ts`

**Interfaces:**
- Consumes: `WpJob`, `WpJobPost` (Task 7); `normalizeDescriptionHtml`, `decodeEntities`, `plainTextExcerpt` (Task 2); `matchDepartment`, `DepartmentRecord` (Task 4); `detectLocale` (Task 5); `CAMPUS_IDS` (Task 1).
- Produces:
  - `interface TransformedJob { rowId: string; row: Record<string, unknown>; sourceLocale: ContentLocale; title: string; descriptionHtml: string; shortDescription: string; departmentName: string | null; departmentConfidence: number }`
  - `transformJob(input: WpJob & { post: WpJobPost }, departments: DepartmentRecord[], resolvedDepartments: Map<string, string>): { job: TransformedJob | null; reject: RejectRow | null; warnings: string[] }`

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/transform/jobs.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { DepartmentRecord } from "./departments";
import { transformJob } from "./jobs";

const DEPARTMENTS: DepartmentRecord[] = [
  { Id: "21", Name: "OSL Bergensbaneløpet", campus_id: "1" },
  { Id: "313", Name: "BRG Næringslivsutvalget", campus_id: "2" },
];

const baseJob = {
  campus: ["Oslo"],
  content:
    "Karrieredagene rekrutterer til en ny manager for 2026.\n\n\n\nDu vil ha ansvar for kommunikasjon og synlighet mot studentene, og du skal jobbe med sosiale medier og nettside.",
  date_posted: "2026-08-01 14:56:35",
  department: ["Bergensbaneløpet"],
  expiry_date: "2026-08-20",
  id: 63903,
  is_expired: false,
  job_type: null,
  location: null,
  post: {
    content: { rendered: "<p>Karrieredagene rekrutterer til en ny manager.</p>" },
    date: "2026-08-01T14:56:35",
    id: 63903,
    link: "https://biso.no/undergruppe/pr-manager/",
    slug: "pr-manager",
    status: "publish",
    title: { rendered: "PR Manager &#8211; Karrieredagene" },
  },
  slug: "pr-manager",
  thumbnail: [],
  title: "PR Manager – Karrieredagene",
  url: "https://biso.no/undergruppe/pr-manager/",
  verv: ["PR"],
};

describe("transformJob", () => {
  test("builds a jobs row with a deterministic id", () => {
    const { job, reject } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(reject).toBeNull();
    expect(job?.rowId).toBe("wpjob63903");
    expect(job?.row.slug).toBe("pr-manager");
    expect(job?.row.campus_id).toBe("1");
  });

  test("maps campus name to the Appwrite campus id", () => {
    const { job } = transformJob(
      { ...baseJob, campus: ["Bergen"], department: ["Næringslivsutvalget"] },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.campus_id).toBe("2");
    expect(job?.row.department_id).toBe("313");
  });

  test("rejects a job with no campus, because campus_id is required", () => {
    const { job, reject } = transformJob(
      { ...baseJob, campus: [] },
      DEPARTMENTS,
      new Map()
    );

    expect(job).toBeNull();
    expect(reject?.reason).toContain("campus");
  });

  test("marks an expired job as closed", () => {
    const { job } = transformJob(
      { ...baseJob, is_expired: true },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.status).toBe("closed");
  });

  test("marks a live job as published", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.row.status).toBe("published");
  });

  test("sets application_deadline from expiry_date", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.row.application_deadline).toBe("2026-08-20T00:00:00.000Z");
  });

  test("detects the written language rather than trusting the url locale", () => {
    const { job } = transformJob(
      { ...baseJob, url: "https://biso.no/en/undergruppe/pr-manager/" },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.sourceLocale).toBe("no");
  });

  test("decodes entities in the title", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.title).toBe("PR Manager – Karrieredagene");
  });

  test("leaves department_id null when no confident match exists", () => {
    const { job } = transformJob(
      { ...baseJob, department: ["HR advisor"] },
      DEPARTMENTS,
      new Map()
    );

    expect(job?.row.department_id).toBeNull();
  });

  test("prefers a human-resolved department over the matcher", () => {
    const resolved = new Map([["1::HR advisor", "21"]]);
    const { job } = transformJob(
      { ...baseJob, department: ["HR advisor"] },
      DEPARTMENTS,
      resolved
    );

    expect(job?.row.department_id).toBe("21");
  });

  test("stores verv values as metadata tags, capped at four", () => {
    const { job } = transformJob(
      { ...baseJob, verv: ["a", "b", "c", "d", "e"] },
      DEPARTMENTS,
      new Map()
    );
    const metadata = JSON.parse(String(job?.row.metadata));

    expect(metadata.tags).toHaveLength(4);
  });

  test("normalizes the description into the studio block subset", () => {
    const { job } = transformJob(baseJob, DEPARTMENTS, new Map());

    expect(job?.descriptionHtml.startsWith("<p>")).toBe(true);
    expect(job?.descriptionHtml).not.toContain("\n\n");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/transform/jobs.test.ts`
Expected: FAIL — cannot resolve `./jobs`.

- [ ] **Step 3: Implement the transform**

`packages/wp-import/src/transform/jobs.ts`:

```ts
import type { WpJob, WpJobPost } from "../extract/index";
import { CAMPUS_IDS, type ContentLocale, type RejectRow } from "../types";
import {
  AUTO_ACCEPT_CONFIDENCE,
  type DepartmentRecord,
  matchDepartment,
} from "./departments";
import { decodeEntities, normalizeDescriptionHtml, plainTextExcerpt } from "./html";
import { detectLocale } from "./locale";

const MAX_METADATA_TAGS = 4;
const MAX_TAG_LENGTH = 40;

export interface TransformedJob {
  departmentConfidence: number;
  departmentName: string | null;
  descriptionHtml: string;
  row: Record<string, unknown>;
  rowId: string;
  shortDescription: string;
  sourceLocale: ContentLocale;
  title: string;
}

/** Key used in the reviewed department mapping: campusId + raw WP name. */
export function departmentMappingKey(
  campusId: string,
  wpName: string
): string {
  return `${campusId}::${wpName}`;
}

export function transformJob(
  input: WpJob & { post: WpJobPost },
  departments: DepartmentRecord[],
  resolvedDepartments: Map<string, string>
): {
  job: TransformedJob | null;
  reject: RejectRow | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = decodeEntities(
    input.title || input.post.title.rendered || ""
  ).trim();
  const label = title || input.slug;

  const campusName = input.campus[0];
  const campusId = campusName ? CAMPUS_IDS[campusName] : undefined;
  if (!campusId) {
    return {
      job: null,
      reject: {
        label,
        reason: `No resolvable campus (${JSON.stringify(input.campus)}); jobs.campus_id is required`,
        sourceId: input.id,
      },
      warnings,
    };
  }

  if (!title) {
    return {
      job: null,
      reject: {
        label: input.slug,
        reason: "No job title; content_translations.title is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const departmentName = input.department[0] ?? null;
  let departmentId: string | null = null;
  let departmentConfidence = 0;

  if (departmentName) {
    const resolved = resolvedDepartments.get(
      departmentMappingKey(campusId, departmentName)
    );
    if (resolved) {
      departmentId = resolved;
      departmentConfidence = 1;
    } else {
      const match = matchDepartment(departmentName, campusId, departments);
      departmentConfidence = match.confidence;
      departmentId =
        match.confidence >= AUTO_ACCEPT_CONFIDENCE ? match.departmentId : null;
      if (!departmentId) {
        warnings.push(
          `Job ${input.id}: department "${departmentName}" unresolved (confidence ${match.confidence.toFixed(2)})`
        );
      }
    }
  }

  // The /custom/v1/jobs `content` field is plain text with blank-line breaks;
  // the wp/v2 post carries Gutenberg HTML. Prefer the richer HTML source.
  const sourceHtml = input.post.content.rendered || input.content || "";
  const description = normalizeDescriptionHtml(sourceHtml);
  if (description.truncated) {
    warnings.push(`Job ${input.id} description truncated to 8000 chars`);
  }

  // Detect from the body, not the URL: Polylang locale is unreliable, and an
  // English job title on a Norwegian body is common.
  const detection = detectLocale(
    `${title} ${plainTextExcerpt(sourceHtml, 2000)}`
  );
  if (detection.confidence < 0.6) {
    warnings.push(
      `Job ${input.id}: low language-detection confidence (${detection.confidence.toFixed(2)}), assumed ${detection.locale}`
    );
  }

  const status = input.is_expired ? "closed" : "published";
  const tags = input.verv
    .map((verv) => verv.trim())
    .filter((verv) => verv.length > 0 && verv.length <= MAX_TAG_LENGTH)
    .slice(0, MAX_METADATA_TAGS);

  const metadata = {
    auto_screen: true,
    auto_translate: false,
    company: null,
    employment_type: input.job_type,
    location: input.location,
    tags,
  };

  const row: Record<string, unknown> = {
    application_deadline: input.expiry_date
      ? new Date(`${input.expiry_date}T00:00:00.000Z`).toISOString()
      : null,
    auto_screen: true,
    campus: campusId,
    campus_id: campusId,
    department: departmentId,
    department_id: departmentId,
    metadata: JSON.stringify(metadata),
    slug: input.slug,
    status,
  };

  return {
    job: {
      departmentConfidence,
      departmentName,
      descriptionHtml: description.html,
      row,
      rowId: `wpjob${input.id}`,
      shortDescription: plainTextExcerpt(sourceHtml, 500),
      sourceLocale: detection.locale,
      title,
    },
    reject: null,
    warnings,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/transform/jobs.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/transform/jobs.ts packages/wp-import/src/transform/jobs.test.ts
git commit -m "feat(wp-import): add WP Job Openings transform"
```

---

### Task 11: Transform CLI with department review loop

Produces `mappings/departments.csv` for human review, then the transformed payloads. Running it twice — before and after the human fills `resolved_id` — is the designed workflow.

**Files:**
- Create: `packages/wp-import/scripts/transform.ts`
- Create: `packages/wp-import/src/appwrite.ts`
- Modify: `packages/wp-import/.gitignore` (keep `mappings/` tracked)

**Interfaces:**
- Consumes: all transforms (Tasks 8–10), `parseCsv`/`toCsv` (Task 3).
- Produces: `createDb(): TablesDB` and `loadDepartments(db: TablesDB): Promise<DepartmentRecord[]>` from `src/appwrite.ts`; writes `snapshots/transformed-*.json`, `mappings/departments.csv`, `reports/*.csv`.

- [ ] **Step 1: Write the Appwrite helper**

`packages/wp-import/src/appwrite.ts`:

```ts
import { Client, Query, TablesDB } from "node-appwrite";
import type { DepartmentRecord } from "./transform/departments";

export function createDb(): TablesDB {
  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!(endpoint && project && apiKey)) {
    throw new Error(
      "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT and APPWRITE_API_KEY"
    );
  }

  return new TablesDB(
    new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
  );
}

export async function loadDepartments(
  db: TablesDB
): Promise<DepartmentRecord[]> {
  const response = await db.listRows({
    databaseId: "app",
    queries: [Query.limit(500)],
    tableId: "departments",
  });

  return (response.rows as unknown as DepartmentRecord[]).map((row) => ({
    Id: String(row.Id),
    Name: String(row.Name),
    campus_id: String(row.campus_id),
  }));
}

export async function loadUserIdsByEmail(
  db: TablesDB
): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  let cursor: string | undefined;

  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const response = await db.listRows({
      databaseId: "app",
      queries,
      tableId: "user",
    });
    const rows = response.rows as unknown as Array<{
      $id: string;
      email?: string;
    }>;
    for (const row of rows) {
      if (row.email) {
        byEmail.set(row.email.trim().toLowerCase(), row.$id);
      }
    }
    if (rows.length < 100) {
      break;
    }
    cursor = rows.at(-1)?.$id;
  }

  return byEmail;
}
```

- [ ] **Step 2: Write the transform CLI**

`packages/wp-import/scripts/transform.ts`:

```ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createDb, loadDepartments, loadUserIdsByEmail } from "../src/appwrite";
import { parseCsv, toCsv } from "../src/transform/csv";
import { AUTO_ACCEPT_CONFIDENCE, matchDepartment } from "../src/transform/departments";
import { departmentMappingKey, transformJob } from "../src/transform/jobs";
import { transformOrder } from "../src/transform/orders";
import { transformProduct } from "../src/transform/products";
import type { RejectRow } from "../src/types";

const root = new URL("../", import.meta.url).pathname;
const snapshots = `${root}snapshots/`;
const mappings = `${root}mappings/`;
const reports = `${root}reports/`;
await mkdir(mappings, { recursive: true });
await mkdir(reports, { recursive: true });

const readSnapshot = async <T>(name: string): Promise<T[]> => {
  const path = `${snapshots}${name}.json`;
  if (!existsSync(path)) {
    console.log(`  (no ${name} snapshot — run extract first)`);
    return [];
  }
  return JSON.parse(await readFile(path, "utf8")) as T[];
};

const writeRejects = async (
  name: string,
  rejects: RejectRow[]
): Promise<void> => {
  if (rejects.length === 0) {
    return;
  }
  await writeFile(
    `${reports}${name}-rejects.csv`,
    toCsv(
      rejects.map((r) => ({
        label: r.label,
        reason: r.reason,
        source_id: String(r.sourceId),
      })),
      ["source_id", "label", "reason"]
    )
  );
  console.log(`  ${rejects.length} rejected → reports/${name}-rejects.csv`);
};

const db = createDb();
const departments = await loadDepartments(db);
console.log(`Loaded ${departments.length} departments from Appwrite`);

// ---- Department mapping review file -------------------------------------
const mappingPath = `${mappings}departments.csv`;
const resolved = new Map<string, string>();
if (existsSync(mappingPath)) {
  for (const row of parseCsv(await readFile(mappingPath, "utf8"))) {
    if (row.resolved_id) {
      resolved.set(
        departmentMappingKey(row.wp_campus_id ?? "", row.wp_name ?? ""),
        row.resolved_id
      );
    }
  }
  console.log(`Loaded ${resolved.size} human-resolved department mappings`);
}

// ---- Jobs ----------------------------------------------------------------
const jobSnapshots = await readSnapshot<Parameters<typeof transformJob>[0]>("jobs");
const jobResults = jobSnapshots.map((job) =>
  transformJob(job, departments, resolved)
);
const jobs = jobResults.flatMap((r) => (r.job ? [r.job] : []));
await writeRejects("jobs", jobResults.flatMap((r) => (r.reject ? [r.reject] : [])));

// Rebuild the review file from every distinct (campus, department) pair seen.
const seen = new Map<string, { campusId: string; name: string }>();
for (const job of jobSnapshots) {
  const campusId = String(
    jobResults.find((r) => r.job?.rowId === `wpjob${job.id}`)?.job?.row.campus_id ?? ""
  );
  const name = job.department?.[0];
  if (campusId && name) {
    seen.set(departmentMappingKey(campusId, name), { campusId, name });
  }
}
const mappingRows = [...seen.values()].map((entry) => {
  const key = departmentMappingKey(entry.campusId, entry.name);
  const match = matchDepartment(entry.name, entry.campusId, departments);
  return {
    confidence: match.confidence.toFixed(2),
    resolved_id: resolved.get(key) ?? "",
    suggested_id:
      match.confidence >= AUTO_ACCEPT_CONFIDENCE ? (match.departmentId ?? "") : "",
    suggested_name: match.matchedName ?? "",
    wp_campus_id: entry.campusId,
    wp_name: entry.name,
  };
});
mappingRows.sort((a, b) => Number(a.confidence) - Number(b.confidence));
await writeFile(
  mappingPath,
  toCsv(mappingRows, [
    "wp_name",
    "wp_campus_id",
    "suggested_id",
    "suggested_name",
    "confidence",
    "resolved_id",
  ])
);
const unresolved = mappingRows.filter(
  (row) => !(row.resolved_id || row.suggested_id)
).length;
console.log(
  `Jobs: ${jobs.length} transformed; ${unresolved} department names need review in mappings/departments.csv`
);

// ---- Products ------------------------------------------------------------
const productSnapshots =
  await readSnapshot<Parameters<typeof transformProduct>[0]>("products");
const productResults = productSnapshots.map(transformProduct);
const products = productResults.flatMap((r) => (r.product ? [r.product] : []));
await writeRejects(
  "products",
  productResults.flatMap((r) => (r.reject ? [r.reject] : []))
);
console.log(`Products: ${products.length} transformed`);

// ---- Orders --------------------------------------------------------------
const orderSnapshots = await readSnapshot<Parameters<typeof transformOrder>[0]>("orders");
let orders: Array<{ row: Record<string, unknown>; rowId: string }> = [];
if (orderSnapshots.length > 0) {
  const userIds = await loadUserIdsByEmail(db);
  const orderResults = orderSnapshots.map((order) =>
    transformOrder(order, userIds)
  );
  orders = orderResults.flatMap((r) => ("row" in r ? [r] : []));
  await writeRejects(
    "orders",
    orderResults.flatMap((r) => ("reject" in r ? [r.reject] : []))
  );
  console.log(`Orders: ${orders.length} transformed`);
}

// ---- Warnings ------------------------------------------------------------
const warnings = [
  ...jobResults.flatMap((r) => r.warnings),
  ...productResults.flatMap((r) => r.warnings),
];
if (warnings.length > 0) {
  await writeFile(`${reports}warnings.txt`, `${warnings.join("\n")}\n`);
  console.log(`${warnings.length} warnings → reports/warnings.txt`);
}

await writeFile(
  `${snapshots}transformed.json`,
  JSON.stringify({ jobs, orders, products }, null, 2)
);
console.log("Wrote snapshots/transformed.json");
```

- [ ] **Step 3: Keep `mappings/` tracked**

Edit `packages/wp-import/.gitignore` so it reads exactly:

```
snapshots/
reports/
.env
```

`mappings/` is deliberately absent — the reviewed CSV must be committed.

- [ ] **Step 4: Run the transform against real data**

```bash
cd packages/wp-import
bun run transform --since=3m
```

Expected: prints department counts, writes `mappings/departments.csv` sorted lowest-confidence-first, and `snapshots/transformed.json`.

- [ ] **Step 5: Verify the whole suite still passes**

```bash
cd packages/wp-import && bun test
cd ../.. && bun run check-types --filter=@repo/wp-import
```

Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/scripts/transform.ts packages/wp-import/src/appwrite.ts packages/wp-import/.gitignore packages/wp-import/mappings
git commit -m "feat(wp-import): add transform CLI with department review loop"
```

---

### Task 12: Media mirroring

**Files:**
- Create: `packages/wp-import/src/media.ts`
- Test: `packages/wp-import/src/media.test.ts`

**Interfaces:**
- Consumes: `node-appwrite` `Storage`, `ID`, `Permission`, `Role`.
- Produces: `mirrorImage(deps: MirrorDeps, sourceUrl: string): Promise<string>` returning an Appwrite file ID, and `type MirrorDeps = { upload: (file: File) => Promise<{ $id: string }>; fetchImpl?: FetchLike; cache: Map<string, string> }`.

**Note:** `fetchImpl` is typed `FetchLike` (from `../types`, added in Task 1), **not** `typeof fetch`. Bun's global `fetch` type is merged with a `fetch.preconnect` static, so a plain mock function cannot satisfy `typeof fetch` and every test double would need an `as unknown as typeof fetch` double-cast — which would suppress the very type errors that type-checking test files exists to surface.

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/media.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { mirrorImage } from "./media";

const pngResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "image/jpeg" },
    status: 200,
  });

describe("mirrorImage", () => {
  test("uploads the image and returns the new file id", async () => {
    const cache = new Map<string, string>();
    const fileId = await mirrorImage(
      {
        cache,
        fetchImpl: async () => pngResponse(),
        upload: async () => ({ $id: "file-1" }),
      },
      "https://biso.no/wp-content/uploads/a.jpg"
    );

    expect(fileId).toBe("file-1");
  });

  test("does not re-upload a url it has already mirrored", async () => {
    const cache = new Map<string, string>();
    let uploads = 0;
    const deps = {
      cache,
      fetchImpl: async () => pngResponse(),
      upload: async () => {
        uploads += 1;
        return { $id: "file-1" };
      },
    };

    await mirrorImage(deps, "https://biso.no/a.jpg");
    await mirrorImage(deps, "https://biso.no/a.jpg");

    expect(uploads).toBe(1);
  });

  test("throws when the source image cannot be downloaded", async () => {
    await expect(
      mirrorImage(
        {
          cache: new Map(),
          fetchImpl: async () => new Response("", { status: 404 }),
          upload: async () => ({ $id: "unused" }),
        },
        "https://biso.no/missing.jpg"
      )
    ).rejects.toThrow("404");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/media.test.ts`
Expected: FAIL — cannot resolve `./media`.

- [ ] **Step 3: Implement the mirror**

`packages/wp-import/src/media.ts`:

```ts
import type { FetchLike } from "./types";

export interface MirrorDeps {
  /** sourceUrl → Appwrite file id, so a re-run never re-uploads. */
  cache: Map<string, string>;
  fetchImpl?: FetchLike;
  upload: (file: File) => Promise<{ $id: string }>;
}

function fileNameFromUrl(sourceUrl: string): string {
  const path = new URL(sourceUrl).pathname;
  return path.split("/").pop() || "image";
}

export async function mirrorImage(
  deps: MirrorDeps,
  sourceUrl: string
): Promise<string> {
  const cached = deps.cache.get(sourceUrl);
  if (cached) {
    return cached;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${sourceUrl}: ${response.status}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File([bytes], fileNameFromUrl(sourceUrl), {
    type: response.headers.get("Content-Type") ?? "application/octet-stream",
  });

  const uploaded = await deps.upload(file);
  deps.cache.set(sourceUrl, uploaded.$id);
  return uploaded.$id;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/wp-import && bun test src/media.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/media.ts packages/wp-import/src/media.test.ts
git commit -m "feat(wp-import): mirror WordPress images into the media bucket"
```

---

### Task 13: Load phase

Writes to Appwrite with deterministic IDs, dry-run by default. **Every write sends a complete payload** because `db.upsertRow` validates as a full-document replace — a partial payload fails with `Missing required attribute`.

**Files:**
- Create: `packages/wp-import/src/load/index.ts`
- Create: `packages/wp-import/scripts/load.ts`
- Test: `packages/wp-import/src/load/index.test.ts`

**Interfaces:**
- Consumes: transformed payloads (Task 11), `buildJobPermissions`/`buildPublicContentPermissions` (Task 6), `mirrorImage` (Task 12).
- Produces: `buildJobUpsert(job, translations)`, `buildProductUpsert(product, translations)`, `type TranslationPayload = { content_id: string; content_type: string; locale: ContentLocale; title: string; description: string; short_description: string | null; $permissions: string[] }`.

- [ ] **Step 1: Write the failing tests**

`packages/wp-import/src/load/index.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildJobUpsert, buildTranslationRows } from "./index";

const job = {
  departmentConfidence: 1,
  departmentName: "Bergensbaneløpet",
  descriptionHtml: "<p>Tekst</p>",
  row: { campus_id: "1", slug: "pr-manager", status: "published" },
  rowId: "wpjob63903",
  shortDescription: "Tekst",
  sourceLocale: "no" as const,
  title: "PR Manager",
};

describe("buildTranslationRows", () => {
  test("creates a row for each locale with the source stored verbatim", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob63903",
      contentType: "job",
      permissions: ['read("any")'],
      source: {
        description: "<p>Tekst</p>",
        locale: "no",
        shortDescription: "Tekst",
        title: "PR Manager",
      },
      target: {
        description: "<p>Text</p>",
        locale: "en",
        shortDescription: "Text",
        title: "PR Manager EN",
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.locale).toBe("no");
    expect(rows[0]?.title).toBe("PR Manager");
    expect(rows[1]?.locale).toBe("en");
  });

  test("stamps content_type and content_id on every row", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.content_id).toBe("wpjob1");
    expect(rows[0]?.content_type).toBe("job");
  });

  test("omits the target row when translation was skipped", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows).toHaveLength(1);
  });
});

describe("buildJobUpsert", () => {
  test("includes every required column plus nested translations", () => {
    const payload = buildJobUpsert(job, [
      {
        $permissions: [],
        content_id: "wpjob63903",
        content_type: "job",
        description: "<p>Tekst</p>",
        locale: "no",
        short_description: null,
        title: "PR Manager",
      },
    ]);

    expect(payload.slug).toBe("pr-manager");
    expect(payload.status).toBe("published");
    expect(payload.campus_id).toBe("1");
    expect(Array.isArray(payload.translations)).toBe(true);
  });

  test("attaches permissions derived from status", () => {
    const payload = buildJobUpsert(job, []);

    expect(payload.$permissions).toContain('read("any")');
  });

  test("a closed job gets no public read permission", () => {
    const payload = buildJobUpsert(
      { ...job, row: { ...job.row, status: "closed" } },
      []
    );

    expect(payload.$permissions).not.toContain('read("any")');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/wp-import && bun test src/load/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement the payload builders**

`packages/wp-import/src/load/index.ts`:

```ts
import { buildJobPermissions, buildPublicContentPermissions } from "../permissions";
import type { ContentLocale } from "../types";

export interface TranslationPayload {
  $permissions: string[];
  content_id: string;
  content_type: string;
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

export interface LocaleContent {
  description: string;
  locale: ContentLocale;
  shortDescription: string | null;
  title: string;
}

export function buildTranslationRows(input: {
  contentId: string;
  contentType: string;
  permissions: string[];
  source: LocaleContent;
  target: LocaleContent | null;
}): TranslationPayload[] {
  const toRow = (content: LocaleContent): TranslationPayload => ({
    $permissions: input.permissions,
    content_id: input.contentId,
    content_type: input.contentType,
    description: content.description,
    locale: content.locale,
    short_description: content.shortDescription,
    title: content.title.slice(0, 500),
  });

  return input.target
    ? [toRow(input.source), toRow(input.target)]
    : [toRow(input.source)];
}

/**
 * db.upsertRow validates as a full-document replace, so every required column
 * must be present on every write — a partial payload fails with
 * "Missing required attribute".
 */
export function buildJobUpsert(
  job: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(job.row.status ?? "draft");
  return {
    ...job.row,
    $permissions: buildJobPermissions(status),
    translations,
  };
}

export function buildProductUpsert(
  product: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(product.row.status ?? "draft");
  return {
    ...product.row,
    $permissions: buildPublicContentPermissions(status),
    translation_refs: translations,
  };
}
```

- [ ] **Step 4: Write the load CLI**

`packages/wp-import/scripts/load.ts`:

```ts
import { readFile } from "node:fs/promises";
import { ID, Storage } from "node-appwrite";
import { createDb } from "../src/appwrite";
import { buildJobUpsert, buildProductUpsert, buildTranslationRows } from "../src/load/index";
import { buildJobPermissions, buildPublicContentPermissions } from "../src/permissions";
import { otherLocale, translateFields } from "../src/transform/locale";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const wants = (name: string): boolean => args.has(`--${name}`);

const root = new URL("../", import.meta.url).pathname;
const payload = JSON.parse(
  await readFile(`${root}snapshots/transformed.json`, "utf8")
) as {
  jobs: Array<Record<string, never>>;
  orders: Array<{ row: Record<string, unknown>; rowId: string }>;
  products: Array<Record<string, never>>;
};

const db = createDb();
console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);

const upsert = async (
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<void> => {
  if (!apply) {
    console.log(`  would upsert ${tableId}/${rowId}`);
    return;
  }
  await db.upsertRow({ databaseId: "app", data, rowId, tableId });
};

if (wants("jobs")) {
  for (const job of payload.jobs as unknown as Array<{
    descriptionHtml: string;
    row: Record<string, unknown>;
    rowId: string;
    shortDescription: string;
    sourceLocale: "no" | "en";
    title: string;
  }>) {
    const status = String(job.row.status);
    const target = otherLocale(job.sourceLocale);
    const translated = await translateFields({
      contentType: "job vacancy",
      fields: [
        { key: "title", value: job.title },
        { key: "description", value: job.descriptionHtml },
        { key: "short_description", value: job.shortDescription },
      ],
      sourceLocale: job.sourceLocale,
      targetLocale: target,
    });

    const translations = buildTranslationRows({
      contentId: job.rowId,
      contentType: "job",
      permissions: buildJobPermissions(status),
      source: {
        description: job.descriptionHtml,
        locale: job.sourceLocale,
        shortDescription: job.shortDescription || null,
        title: job.title,
      },
      target: {
        description: translated.description || job.descriptionHtml,
        locale: target,
        shortDescription: translated.short_description || null,
        title: translated.title || job.title,
      },
    });

    await upsert("jobs", job.rowId, buildJobUpsert(job, translations));
  }
  console.log(`Jobs: ${payload.jobs.length}`);
}

if (wants("products")) {
  const storage = new Storage(clientFromEnv());
  const mediaCache = new Map<string, string>();
  const uploadToMedia = async (file: File): Promise<{ $id: string }> =>
    await storage.createFile({
      bucketId: "media",
      fileId: ID.unique(),
      file,
    });

  for (const product of payload.products as unknown as Array<{
    descriptionHtml: string;
    imageUrls: string[];
    row: Record<string, unknown>;
    rowId: string;
    shortDescription: string;
    title: string;
  }>) {
    const status = String(product.row.status);

    // Mirror images BEFORE writing the row, so no imported row ever points at
    // biso.no.
    const fileIds: string[] = [];
    if (apply) {
      for (const url of product.imageUrls) {
        try {
          fileIds.push(
            await mirrorImage(
              { cache: mediaCache, upload: uploadToMedia },
              url
            )
          );
        } catch (error) {
          console.error(`  image failed for ${product.rowId}: ${String(error)}`);
        }
      }
    }

    const detection = detectLocale(
      `${product.title} ${product.descriptionHtml}`
    );
    const target = otherLocale(detection.locale);
    const translated = await translateFields({
      contentType: "webshop product",
      fields: [
        { key: "title", value: product.title },
        { key: "description", value: product.descriptionHtml },
        { key: "short_description", value: product.shortDescription },
      ],
      sourceLocale: detection.locale,
      targetLocale: target,
    });

    const translations = buildTranslationRows({
      contentId: product.rowId,
      contentType: "product",
      permissions: buildPublicContentPermissions(status),
      source: {
        description: product.descriptionHtml,
        locale: detection.locale,
        shortDescription: product.shortDescription || null,
        title: product.title,
      },
      target: {
        description: translated.description || product.descriptionHtml,
        locale: target,
        shortDescription: translated.short_description || null,
        title: translated.title || product.title,
      },
    });

    const row = {
      ...product.row,
      ...(fileIds.length > 0
        ? { image: fileIds[0], images: fileIds }
        : {}),
    };

    await upsert(
      "webshop_products",
      product.rowId,
      buildProductUpsert({ row, rowId: product.rowId }, translations)
    );
  }
  console.log(`Products: ${payload.products.length}`);
}

if (wants("orders")) {
  for (const order of payload.orders) {
    await upsert("orders", order.rowId, order.row);
  }
  console.log(`Orders: ${payload.orders.length}`);
}
```

`clientFromEnv()` is a small addition to `src/appwrite.ts` that returns the
configured `Client` (extract the client construction out of `createDb()` and
have `createDb()` call it, so both share one code path):

```ts
export function clientFromEnv(): Client {
  const endpoint =
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!(endpoint && project && apiKey)) {
    throw new Error(
      "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT and APPWRITE_API_KEY"
    );
  }

  return new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
}
```

Add these imports to the top of `scripts/load.ts`:

```ts
import { clientFromEnv, createDb } from "../src/appwrite";
import { mirrorImage } from "../src/media";
import { buildProductUpsert } from "../src/load/index";
import { detectLocale, otherLocale, translateFields } from "../src/transform/locale";
import { buildPublicContentPermissions } from "../src/permissions";
```

- [ ] **Step 5: Run the tests and a dry run**

```bash
cd packages/wp-import
bun test
bun run load --products        # dry run, prints planned writes
```

Expected: tests PASS; the dry run lists ~55 planned `webshop_products` upserts and writes nothing.

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/wp-import/src/load packages/wp-import/scripts/load.ts
git commit -m "feat(wp-import): add load phase with deterministic ids and dry-run"
```

---

### Task 14: End-to-end verification and README

**Files:**
- Create: `packages/wp-import/README.md`
- Modify: `turbo.json` (only if `check-types`/`lint` need the new package declared)

- [ ] **Step 1: Run the full pipeline against products**

```bash
cd packages/wp-import
bun run extract --since=3m --products
bun run transform --since=3m
bun run load --products --apply
```

- [ ] **Step 2: Verify in Appwrite**

```bash
cd packages/wp-import
bun -e '
import { Query } from "node-appwrite";
import { createDb } from "./src/appwrite";
const db = createDb();
const rows = await db.listRows({ databaseId: "app", tableId: "webshop_products", queries: [Query.limit(5)] });
console.log("webshop_products total:", rows.total);
for (const row of rows.rows) console.log(" ", row.$id, row.slug, row.campus_id, row.regular_price, row.status);
const tr = await db.listRows({ databaseId: "app", tableId: "content_translations", queries: [Query.equal("content_type","product"), Query.limit(4)] });
console.log("product translations:", tr.total);
for (const row of tr.rows) console.log(" ", row.content_id, row.locale, row.title);
'
```

Expected: ~55 rows with `wpprod` IDs, correct campus/price/status, and two translation rows per product.

- [ ] **Step 3: Verify idempotency**

Re-run `bun run load --products --apply` and re-check the total. Expected: **unchanged** — upserts, not duplicates.

- [ ] **Step 4: Verify in the admin UI**

Start the admin (`bun run dev --filter=admin`), open the shop studio, and confirm an imported product opens with intact paragraph formatting, the right campus and department, and both locale tabs populated. This is the check that proves the HTML round-trip works.

- [ ] **Step 5: Repeat for jobs, then orders**

```bash
bun run extract --since=3m --jobs
bun run transform --since=3m
# review mappings/departments.csv, fill resolved_id, commit it
bun run transform --since=3m
bun run load --jobs           # dry run
bun run load --jobs --apply
```

Then orders, once `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` are in `.env`.

- [ ] **Step 6: Write the README**

`packages/wp-import/README.md` documenting: prerequisites (env vars), the three commands, the department review loop, the deterministic-ID scheme, how to roll back (delete rows by `wpjob`/`wpprod`/`wporder` prefix), and the known rejects (the campus-less product).

- [ ] **Step 7: Final verification**

```bash
cd /Users/heien/Documents/Dev/BISO-Sites
bun run check-types
bun run lint
cd packages/wp-import && bun test
```

Expected: all clean. Note that `check-types` currently fails on pre-existing `* 2.ts` duplicate artifacts — remove those first (`find . -name '* [0-9]*' -not -path '*/node_modules/*'`).

- [ ] **Step 8: Commit**

```bash
git add packages/wp-import/README.md
git commit -m "docs(wp-import): document the import pipeline and runbook"
```

---

## Verification Checklist

- [ ] `bun test` passes in `packages/wp-import`
- [ ] `bun run check-types` passes repo-wide
- [ ] `bun run lint` passes
- [ ] `webshop_products` holds ~55 rows, all with `wpprod` IDs
- [ ] `jobs` holds ~99 rows, all with `wpjob` IDs
- [ ] Every imported job and product has two `content_translations` rows
- [ ] Published rows carry `read("any")`; closed jobs do not
- [ ] Re-running `load --apply` does not change row counts
- [ ] An imported product and job open correctly in the admin studios
- [ ] `mappings/departments.csv` is committed with `resolved_id` filled in
- [ ] `reports/*-rejects.csv` has been reviewed and each rejection is understood
