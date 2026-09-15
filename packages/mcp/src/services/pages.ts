/**
 * Page documents.
 *
 * The page-editor copilot in `packages/editor/src/ai/tools/index.ts` declares
 * eight tools whose `execute` bodies return canned strings: `insert_block`
 * reports `"Inserted hero block at end"` without touching anything,
 * `generate_copy` returns the literal `"[AI-generated copy for: … — apply via
 * set_prop]"`, and `list_blocks` — advertised as *"Read-only: return the
 * current list of blocks"* — returns `"Use the page context in your system
 * prompt instead."` The real edits happen in client state, so a caller without
 * the browser open gets success messages for work that never happened.
 *
 * Everything here operates on a persisted `PageDoc` and reports what actually
 * changed. The block mutations are the editor's own pure operations from
 * `@repo/editor/operations` — the same functions the browser store calls — so
 * a document written from here is structurally identical to one written from
 * the editor. Persistence goes through `@repo/api/page-builder`'s rules, which
 * this service re-implements against the framework-independent client (see the
 * note on `savePageDraft` below).
 *
 * Two structural facts drive the design:
 *
 * - `pages` and `page_translations` have `rowSecurity: false` and a table-level
 *   `read("any")` grant, so Appwrite will happily hand a draft document to an
 *   anonymous caller. Visibility is therefore enforced here, in application
 *   code, and never delegated to row security.
 * - Those tables grant update only to Operations Unit and the four `ledelsen`
 *   department teams. A campus admin authorized to publish a page still cannot
 *   write the row under their own credential — which is exactly why
 *   `@repo/api/page-builder` uses the admin client and documents that callers
 *   MUST authorize first. The same split is kept here.
 */

import { ID, Permission, Query, Role } from "@repo/api";
import type { PageDoc } from "@repo/api/page-builder";
import type { Pages, PageTranslations } from "@repo/api/types/appwrite";
import { PagesStatus } from "@repo/api/types/appwrite";
import {
  applyAccent,
  insertBlock,
  removeBlock,
  reorder,
  setMeta,
  setProp,
  setVariant,
} from "@repo/editor/operations";
import { BRAND_ACCENT_VALUES } from "@repo/editor/theme/presets";
import type {
  Block,
  BlockType,
  PageDoc as EditorPageDoc,
} from "@repo/editor/types";
import type { BackendClients } from "../appwrite/clients";
import { MEMBERS_TEAM_ID } from "../identity/campus";
import type { Principal } from "../identity/principal";
import {
  assertPublishAccess,
  assertWriteAccess,
  canReadRow,
  relationId,
} from "../identity/scope";
import {
  DomainError,
  fromAppwriteError,
  invalidInput,
  notFound,
  staleRevision,
} from "../runtime/errors";

export const PAGE_LOCALES = ["no", "en"] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number];

/** A block as reported to a caller: identity plus a bounded prop preview. */
export interface BlockSummary {
  id: string;
  /** The block's own props, minus `id`/`type`, truncated for readability. */
  props: Record<string, unknown>;
  type: string;
  variant: string | null;
}

export interface PageSummary {
  availableLocales: PageLocale[];
  campusId: string | null;
  departmentId: string | null;
  id: string;
  links: Record<string, string>;
  slug: string;
  status: string;
  visibility: string;
}

export interface PageDocumentView {
  blockCount: number;
  blocks: BlockSummary[];
  description: string | null;
  /**
   * Which document the blocks came from.
   *
   * A principal outside the page's scope may read a *published* page, but only
   * its published document — never the draft sitting on top of it. Saying which
   * one they got keeps that distinction visible instead of silently serving a
   * different document to different callers.
   */
  documentSource: "draft" | "published";
  /**
   * True when a published document exists and differs from the draft.
   *
   * Always false for a `published` document source: whether an out-of-scope
   * page has unpublished edits pending is itself information about that page.
   */
  hasUnpublishedChanges: boolean;
  isPublished: boolean;
  locale: PageLocale;
  meta: PageDoc["meta"] | null;
  page: PageSummary;
  publishedAt: string | null;
  /**
   * The translation row's `$updatedAt`. Every mutating call takes this back as
   * `expectedRevision` and refuses if it moved.
   */
  revision: string | null;
  title: string;
}

/** One block mutation. A discriminated union, not an open payload record. */
export type BlockEdit =
  | { op: "insert"; blockType: BlockType; afterBlockId?: string }
  | { op: "remove"; blockId: string }
  | { op: "move"; blockId: string; toIndex: number }
  | { op: "set_prop"; blockId: string; path: string; value: unknown }
  | { op: "set_variant"; blockId: string; variant: string }
  | { op: "set_meta"; key: "title" | "description" | "slug"; value: string }
  | { op: "set_accent"; hex: string };

export interface BlockEditOutcome {
  applied: boolean;
  /** What actually happened, or why nothing did. */
  detail: string;
  edit: BlockEdit;
}

export interface PageService {
  /**
   * Apply edits to a loaded document in memory and report, per edit, what
   * happened. Does not persist — the tool layer decides that.
   */
  applyEdits(
    doc: PageDoc,
    edits: readonly BlockEdit[]
  ): { doc: PageDoc; outcomes: BlockEditOutcome[] };
  list(
    principal: Principal,
    input: { query?: string; status?: string; limit: number; offset: number }
  ): Promise<{
    /**
     * Never known: counting the pages this caller may see would mean scanning
     * the whole table, and Appwrite's own total would disclose how many exist
     * that they may not see.
     */
    total: null;
    /**
     * Raw scan position to resume from, or null when the table was exhausted.
     * Carried in the opaque cursor — it is not a count of visible rows.
     */
    nextOffset: number | null;
    rows: PageSummary[];
  }>;
  load(
    principal: Principal,
    input: { pageId: string; locale: PageLocale }
  ): Promise<PageDocumentView>;
  saveDraft(
    principal: Principal,
    input: {
      pageId: string;
      locale: PageLocale;
      doc: PageDoc;
      expectedRevision: string | null;
    }
  ): Promise<{ translationId: string; revision: string }>;
  setPublished(
    principal: Principal,
    input: {
      pageId: string;
      locale: PageLocale;
      published: boolean;
      expectedRevision: string | null;
    }
  ): Promise<{ status: string; revision: string }>;
}

const MAX_PROP_CHARS = 400;
const PAGE_TABLE = "pages";
/** Rows fetched per round trip while scanning for visible pages. */
const PAGE_SCAN_BATCH = 100;
/**
 * Most rows one `list` call will examine. Bounds the work when a caller's
 * visible pages sit far behind other campuses' drafts; hitting it returns a
 * short page *with* a cursor, never a premature end.
 */
const PAGE_SCAN_CEILING = 1000;
const TRANSLATION_TABLE = "page_translations";

/** Bound a prop value so a listing stays readable. */
function previewValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > MAX_PROP_CHARS
      ? `${value.slice(0, MAX_PROP_CHARS)}…`
      : value;
  }
  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[${value.length} items]`;
    }
    return value.slice(0, 5).map((item) => previewValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    if (depth >= 2) {
      return "{…}";
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>
    )) {
      out[key] = previewValue(item, depth + 1);
    }
    return out;
  }
  return value;
}

function toBlockSummary(block: unknown): BlockSummary {
  const record = (block ?? {}) as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "id" || key === "type" || key === "variant") {
      continue;
    }
    props[key] = previewValue(value);
  }
  return {
    id: typeof record.id === "string" ? record.id : "",
    type: typeof record.type === "string" ? record.type : "unknown",
    variant: typeof record.variant === "string" ? record.variant : null,
    props,
  };
}

function parseDoc(json: string | null | undefined): PageDoc | null {
  if (!json) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as PageDoc).blocks)
    ) {
      return parsed as PageDoc;
    }
    return null;
  } catch {
    return null;
  }
}

function serialiseDoc(doc: PageDoc): string {
  return JSON.stringify(doc);
}

/**
 * Mirror of `normalizeDocForSave` in `@repo/api/page-builder`: a saved draft's
 * `meta.status` is only ever `draft` or `published`, never anything else that
 * might have travelled in the document.
 */
function normalizeForSave(doc: PageDoc): PageDoc {
  return {
    ...doc,
    meta: {
      ...doc.meta,
      status: doc.meta.status === "published" ? "published" : "draft",
    },
  };
}

/**
 * Mirror of `buildPageRowPermissions`. Published+public → `read(any)`,
 * published+members → members team, anything else → service-only.
 */
function pageRowPermissions(input: {
  isPublished: boolean;
  visibility: string;
}): string[] {
  if (!input.isPublished) {
    return [];
  }
  return input.visibility === "authenticated"
    ? [Permission.read(Role.team(MEMBERS_TEAM_ID))]
    : [Permission.read(Role.any())];
}

function findBlock(doc: EditorPageDoc, id: string): Block | undefined {
  return doc.blocks.find((block: Block) => block.id === id);
}

function applyInsert(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "insert" }>
): BlockEditOutcome {
  const newId = insertBlock(doc, edit.blockType, edit.afterBlockId);
  const where = edit.afterBlockId
    ? ` after ${edit.afterBlockId}`
    : " at the end";
  return {
    edit,
    applied: true,
    detail: `Inserted a "${edit.blockType}" block with id ${newId}${where}. The page now has ${doc.blocks.length} blocks.`,
  };
}

function applyRemove(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "remove" }>
): BlockEditOutcome {
  const before = doc.blocks.length;
  removeBlock(doc, edit.blockId);
  const removed = doc.blocks.length < before;
  return {
    edit,
    applied: removed,
    detail: removed
      ? `Removed block ${edit.blockId}. The page now has ${doc.blocks.length} blocks.`
      : `No block with id ${edit.blockId} exists; nothing was removed.`,
  };
}

function applyMove(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "move" }>
): BlockEditOutcome {
  const from = doc.blocks.findIndex(
    (block: Block) => block.id === edit.blockId
  );
  if (from === -1) {
    return {
      edit,
      applied: false,
      detail: `No block with id ${edit.blockId} exists; nothing was moved.`,
    };
  }
  const to = Math.min(Math.max(edit.toIndex, 0), doc.blocks.length - 1);
  reorder(doc, from, to);
  return {
    edit,
    applied: true,
    detail: `Moved block ${edit.blockId} from index ${from} to ${to}.`,
  };
}

function applySetProp(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "set_prop" }>
): BlockEditOutcome {
  const target = findBlock(doc, edit.blockId);
  if (!target) {
    return {
      edit,
      applied: false,
      detail: `No block with id ${edit.blockId} exists; nothing was set.`,
    };
  }
  setProp(doc, edit.blockId, edit.path, edit.value);
  return {
    edit,
    applied: true,
    detail: `Set "${edit.path}" on block ${edit.blockId} (type ${target.type}).`,
  };
}

function applySetVariant(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "set_variant" }>
): BlockEditOutcome {
  if (!findBlock(doc, edit.blockId)) {
    return {
      edit,
      applied: false,
      detail: `No block with id ${edit.blockId} exists; the variant was not set.`,
    };
  }
  setVariant(doc, edit.blockId, edit.variant);
  return {
    edit,
    applied: true,
    detail: `Set variant "${edit.variant}" on block ${edit.blockId}.`,
  };
}

function applySetAccent(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "set_accent" }>
): BlockEditOutcome {
  // The approved palette is the editor's own `BRAND_ACCENT_VALUES`; an
  // off-brand hex is refused rather than written, matching the editor's
  // `apply_accent` zod guard.
  if (!(BRAND_ACCENT_VALUES as readonly string[]).includes(edit.hex)) {
    return {
      edit,
      applied: false,
      detail: `"${edit.hex}" is not an approved BISO accent. Approved: ${BRAND_ACCENT_VALUES.join(", ")}.`,
    };
  }
  applyAccent(doc, edit.hex);
  return { edit, applied: true, detail: `Applied accent ${edit.hex}.` };
}

/**
 * Apply one edit and report what actually happened.
 *
 * Every branch returns an outcome, including the ones that change nothing —
 * an edit naming a block id that does not exist is reported as not applied,
 * never as success.
 */
function applyOneEdit(doc: EditorPageDoc, edit: BlockEdit): BlockEditOutcome {
  switch (edit.op) {
    case "insert":
      return applyInsert(doc, edit);
    case "remove":
      return applyRemove(doc, edit);
    case "move":
      return applyMove(doc, edit);
    case "set_prop":
      return applySetProp(doc, edit);
    case "set_variant":
      return applySetVariant(doc, edit);
    case "set_meta":
      setMeta(doc, edit.key, edit.value);
      return { edit, applied: true, detail: `Set meta.${edit.key}.` };
    case "set_accent":
      return applySetAccent(doc, edit);
    default:
      return {
        edit,
        applied: false,
        detail: "Unrecognised edit operation.",
      };
  }
}

/**
 * Walk the `pages` table until a page of visible rows is filled.
 *
 * Appwrite applies `limit`/`offset` before this package's visibility check, so
 * a single window can filter down to nothing while the caller's own pages sit
 * just behind it. Scanning forward keeps `limit` meaning "visible rows" and
 * lets the returned offset — carried in the opaque cursor — mean "raw scan
 * position", which is the only pair of definitions that neither repeats nor
 * skips a row.
 *
 * `nextOffset` is null only when the table is genuinely exhausted. Hitting
 * `PAGE_SCAN_CEILING` returns a short page *with* an offset, so a caller that
 * follows the cursor still reaches everything.
 */
async function scanVisiblePages(input: {
  baseQueries: readonly string[];
  isVisible(row: Pages): boolean;
  limit: number;
  offset: number;
  read(queries: string[]): Promise<{ rows: Pages[] }>;
}): Promise<{ rows: Pages[]; nextOffset: number | null }> {
  const rows: Pages[] = [];
  let offset = input.offset;
  let scanned = 0;

  while (rows.length < input.limit && scanned < PAGE_SCAN_CEILING) {
    const batchSize = Math.min(PAGE_SCAN_BATCH, PAGE_SCAN_CEILING - scanned);
    const batch = await input.read([
      ...input.baseQueries,
      Query.limit(batchSize),
      Query.offset(offset),
    ]);
    if (batch.rows.length === 0) {
      return { rows, nextOffset: null };
    }

    // Advance by exactly what was examined. Advancing by the whole batch would
    // skip the rows left unread when the page fills mid-batch.
    let consumed = 0;
    for (const row of batch.rows) {
      if (rows.length >= input.limit) {
        break;
      }
      consumed += 1;
      if (input.isVisible(row)) {
        rows.push(row);
      }
    }
    scanned += consumed;
    offset += consumed;

    if (consumed === batch.rows.length && batch.rows.length < batchSize) {
      // A short batch that was read to the end means the table ended.
      return { rows, nextOffset: null };
    }
  }

  return { rows, nextOffset: offset };
}

export function createPageService(
  clients: BackendClients,
  links: { web(path: string): string; admin(path: string): string }
): PageService {
  function summarise(row: Pages): PageSummary {
    const slug = row.slug ?? "untitled";
    return {
      id: row.$id,
      slug,
      status: row.status,
      visibility: row.visibility,
      campusId: relationId(row.campus) ?? row.campus_id ?? null,
      departmentId: relationId(row.department) ?? row.department_id ?? null,
      availableLocales: [...PAGE_LOCALES],
      links: {
        admin: links.admin(`/pages/${row.$id}`),
        public: links.web(`/${slug}`),
      },
    };
  }

  /**
   * How much of a page this principal may see.
   *
   * `pages` and `page_translations` carry `rowSecurity: false` with a
   * table-level `read("any")` grant, so Appwrite enforces nothing here and this
   * function is the only gate.
   *
   * A *published* page is public by definition — but only its published
   * document is. The draft that sits on top of it is unreleased work belonging
   * to the owning department, and `load()` prefers the draft whenever one
   * exists, so treating "the page is published" as blanket access would serve
   * another campus's unpublished edits to anyone who knew the page id.
   */
  function pageVisibility(
    principal: Principal,
    row: Pages
  ): "draft" | "published-only" {
    const campusId = relationId(row.campus) ?? row.campus_id ?? null;
    const departmentId =
      relationId(row.department) ?? row.department_id ?? null;
    if (canReadRow(principal, campusId, departmentId)) {
      return "draft";
    }
    if (row.status === "published") {
      return "published-only";
    }
    throw notFound(`No page found with id ${row.$id}.`, { pageId: row.$id });
  }

  async function readPageRow(pageId: string): Promise<Pages> {
    try {
      const result = await clients.user.db.listRows<Pages>("app", PAGE_TABLE, [
        Query.equal("$id", pageId),
        Query.select([
          "*",
          "translation_refs.*",
          "campus.$id",
          "department.$id",
        ]),
        Query.limit(1),
      ]);
      const row = result.rows[0];
      if (!row) {
        throw notFound(`No page found with id ${pageId}.`, { pageId });
      }
      return row;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw fromAppwriteError(error, { operation: "read page" });
    }
  }

  function translationOf(
    row: Pages,
    locale: PageLocale
  ): PageTranslations | null {
    const refs = Array.isArray(row.translation_refs)
      ? row.translation_refs
      : [];
    return refs.find((item) => item.locale === locale) ?? null;
  }

  return {
    async list(principal, input) {
      const baseQueries: string[] = [
        Query.select([
          "$id",
          "$updatedAt",
          "slug",
          "status",
          "visibility",
          "campus_id",
          "department_id",
          "campus.$id",
          "department.$id",
        ]),
        Query.orderDesc("$updatedAt"),
      ];
      if (input.status) {
        baseQueries.push(Query.equal("status", input.status));
      }
      if (input.query?.trim()) {
        baseQueries.push(Query.contains("slug", input.query.trim()));
      }

      /**
       * `pages` has row security off with a table-level `read("any")` grant, so
       * Appwrite returns every page regardless of the caller and the
       * visibility decision has to happen here. That means Appwrite's `limit`
       * and `offset` page over *unfiltered* rows: a window that happens to hold
       * nothing but other campuses' drafts filters down to nothing, and a
       * caller who stopped there would conclude they have no pages while their
       * own sat two rows further on.
       *
       * So scan forward in batches until the page is full or the table is
       * exhausted, and let the cursor carry the raw scan position rather than a
       * count of visible rows. The cursor is opaque by design, which is what
       * makes redefining it here safe.
       *
       * The ceiling bounds the work per call. Reaching it returns a short page
       * with a cursor, never a wrong "there is nothing more".
       */
      const isVisible = (row: Pages): boolean => {
        if (row.status === "published") {
          return true;
        }
        return canReadRow(
          principal,
          relationId(row.campus) ?? row.campus_id ?? null,
          relationId(row.department) ?? row.department_id ?? null
        );
      };

      try {
        const scan = await scanVisiblePages({
          baseQueries,
          isVisible,
          limit: input.limit,
          offset: input.offset,
          read: (queries) =>
            clients.user.db.listRows<Pages>("app", PAGE_TABLE, queries),
        });

        return {
          rows: scan.rows.map(summarise),
          // The total is deliberately unknown: counting the rows this caller
          // may see would mean scanning the whole table, and reporting
          // Appwrite's own total would tell them how many pages exist that they
          // cannot see.
          total: null,
          nextOffset: scan.nextOffset,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list pages" });
      }
    },

    async load(principal, input) {
      const row = await readPageRow(input.pageId);
      const visibility = pageVisibility(principal, row);

      const translation = translationOf(row, input.locale);
      if (!translation) {
        throw notFound(
          `Page ${input.pageId} has no ${input.locale} translation.`,
          { pageId: input.pageId, locale: input.locale }
        );
      }

      const draft = parseDoc(translation.draft_document);
      const published = parseDoc(translation.puck_document);

      const canSeeDraft = visibility === "draft";
      const active = canSeeDraft ? (draft ?? published) : published;
      const documentSource: "draft" | "published" =
        canSeeDraft && draft !== null ? "draft" : "published";

      if (!canSeeDraft && published === null) {
        // The page is published but this locale has never been released. There
        // is a draft, but it is not this caller's to read.
        throw notFound(
          `Page ${input.pageId} has no published ${input.locale} document.`,
          { pageId: input.pageId, locale: input.locale }
        );
      }

      return {
        page: summarise(row),
        locale: input.locale,
        title: translation.title,
        description: translation.description ?? null,
        isPublished: translation.is_published,
        publishedAt: translation.published_at,
        revision: translation.$updatedAt,
        meta: active?.meta ?? null,
        blocks: (active?.blocks ?? []).map(toBlockSummary),
        blockCount: active?.blocks.length ?? 0,
        documentSource,
        hasUnpublishedChanges:
          canSeeDraft &&
          draft !== null &&
          published !== null &&
          serialiseDoc(draft) !== serialiseDoc(published),
      };
    },

    applyEdits(doc, edits) {
      // Work on a copy so a partial failure cannot leave the caller's document
      // half-mutated.
      const working = JSON.parse(JSON.stringify(doc)) as EditorPageDoc;
      const outcomes = edits.map((edit) => applyOneEdit(working, edit));
      return { doc: working as PageDoc, outcomes };
    },

    async saveDraft(principal, input) {
      const row = await readPageRow(input.pageId);
      const campusId = relationId(row.campus) ?? row.campus_id ?? null;
      const departmentId =
        relationId(row.department) ?? row.department_id ?? null;

      // Authorization runs on the principal, before any elevation.
      assertWriteAccess(principal, campusId, departmentId);

      const existing = translationOf(row, input.locale);
      if (input.expectedRevision) {
        if (!existing) {
          throw staleRevision(
            `Page ${input.pageId} no longer has a ${input.locale} translation.`,
            { pageId: input.pageId, locale: input.locale }
          );
        }
        if (existing.$updatedAt !== input.expectedRevision) {
          throw staleRevision(
            `The ${input.locale} document for page ${input.pageId} changed since it was read.`,
            {
              expected: input.expectedRevision,
              actual: existing.$updatedAt,
            }
          );
        }
      }

      const normalized = normalizeForSave(input.doc);
      const isPublished =
        row.status === "published" && (existing?.is_published ?? false);
      const permissions = pageRowPermissions({
        isPublished,
        visibility: row.visibility,
      });

      // `page_translations` grants update only to Operations Unit and the
      // ledelsen teams, so an authorized campus admin still needs the service
      // key here. Same reasoning and same ordering as `savePageDraft`.
      const { db } = clients.requireElevated(
        "save page draft (page_translations grants no write to campus teams)"
      );

      try {
        const saved = await db.upsertRow<PageTranslations>(
          "app",
          TRANSLATION_TABLE,
          existing?.$id ?? ID.unique(),
          {
            page_id: input.pageId,
            page: input.pageId as unknown as Pages,
            locale: input.locale as PageTranslations["locale"],
            draft_document: serialiseDoc(normalized),
            title: normalized.meta.title,
            description: normalized.meta.description ?? null,
            is_published: existing?.is_published ?? false,
          },
          permissions
        );
        return { translationId: saved.$id, revision: saved.$updatedAt };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "save page draft" });
      }
    },

    async setPublished(principal, input) {
      const row = await readPageRow(input.pageId);
      const campusId = relationId(row.campus) ?? row.campus_id ?? null;
      const departmentId =
        relationId(row.department) ?? row.department_id ?? null;

      assertPublishAccess(principal, campusId, departmentId);

      const existing = translationOf(row, input.locale);
      if (!existing) {
        throw notFound(
          `Page ${input.pageId} has no ${input.locale} translation to publish.`,
          { pageId: input.pageId, locale: input.locale }
        );
      }
      if (
        input.expectedRevision &&
        existing.$updatedAt !== input.expectedRevision
      ) {
        throw staleRevision(
          `The ${input.locale} document changed since it was read.`,
          { expected: input.expectedRevision, actual: existing.$updatedAt }
        );
      }
      if (input.published && !existing.draft_document) {
        throw invalidInput(
          `Page ${input.pageId} has no ${input.locale} draft to publish.`,
          { pageId: input.pageId, locale: input.locale }
        );
      }

      const permissions = pageRowPermissions({
        isPublished: input.published,
        visibility: row.visibility,
      });
      const { db } = clients.requireElevated(
        "publish page (page rows grant no write to campus teams)"
      );

      try {
        // Publishing copies the draft into `puck_document`, which is what the
        // public site reads — the same move `publishPage` makes.
        const updatedTranslation = await db.updateRow<PageTranslations>(
          "app",
          TRANSLATION_TABLE,
          existing.$id,
          input.published
            ? {
                puck_document: existing.draft_document,
                is_published: true,
                published_at: new Date().toISOString(),
              }
            : { is_published: false },
          permissions
        );
        await db.updateRow<Pages>(
          "app",
          PAGE_TABLE,
          input.pageId,
          {
            status: input.published ? PagesStatus.PUBLISHED : PagesStatus.DRAFT,
          },
          permissions
        );
        return {
          status: input.published ? "published" : "draft",
          revision: updatedTranslation.$updatedAt,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "publish page" });
      }
    },
  };
}
