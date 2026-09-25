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
import { scanForward } from "../runtime/scan";

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
  /**
   * Whether this principal is *authorized* to see the draft.
   *
   * Deliberately separate from `documentSource`, which says which document they
   * actually got. The two differ for an authorized owner whose locale has no
   * parseable draft — a legacy row with only a published document, or a
   * `draft_document` that failed to parse. Reading `documentSource` as an
   * authorization answer refuses that owner the ability to create or repair the
   * draft, which is a decision about availability wearing a scope decision's
   * clothes.
   */
  canSeeDraft: boolean;
  description: string | null;
  /**
   * Which document the blocks came from.
   *
   * A principal outside the page's scope may read a *published* page, but only
   * its published document — never the draft sitting on top of it. Saying which
   * one they got keeps that distinction visible instead of silently serving a
   * different document to different callers.
   *
   * Not an authorization signal — see `canSeeDraft`.
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
  // No `slug`: it is the page's routing key on the parent row, and this
  // service writes only the translation. See the schema in `domains/pages.ts`.
  | { op: "set_meta"; key: "title" | "description"; value: string }
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

/**
 * Parse a stored document, treating anything unusable as absent.
 *
 * Exported because the same rule has to hold wherever a document is chosen:
 * `load` falls back from an unparseable draft to the published document and
 * authorizes the owner to edit it, so a second reader that picked the draft on
 * non-nullness alone would throw on exactly the row the owner needs to repair.
 */
export function parseDoc(json: string | null | undefined): PageDoc | null {
  if (!json) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as PageDoc).blocks) &&
      hasUsableMeta(parsed as PageDoc)
    ) {
      return parsed as PageDoc;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Whether a parsed document states the metadata its own type promises.
 *
 * `PageDoc.meta` is `PageMeta`, not `PageMeta | null` — so a stored
 * `{"blocks": [], "meta": null}` is already outside the type, and returning it
 * as a `PageDoc` makes every reader's dereference a lie. They do dereference:
 * `@repo/api/page-builder` reads `normalizedDoc.meta.slug` unconditionally
 * when it publishes, and `readPage` reads `doc.meta.slug` whenever the row's
 * own `slug` column is empty.
 *
 * `slug` is the field checked because it is the one those readers require;
 * a document that has it can lose a title or a colour without anything
 * throwing. Checking more than the readers need would turn a repairable draft
 * into an unloadable one.
 *
 * This is deliberately in `parseDoc` rather than beside the publish check, so
 * the two agree by construction: `load` treats such a draft as **absent** and
 * falls back to the published document, which is the path that lets the owner
 * repair it, and `assertPublishableDraft` refuses to copy it over a working
 * page. A validity rule with two homes drifts; this one has one.
 */
function hasUsableMeta(doc: PageDoc): boolean {
  const meta: unknown = doc.meta;
  if (!meta || typeof meta !== "object") {
    return false;
  }
  return typeof (meta as { slug?: unknown }).slug === "string";
}

/**
 * Title and description as a released document states them — and from nowhere
 * else.
 *
 * The one definition behind both callers that must not serve unreleased copy:
 * this module's published-only branch, and public discovery's `publishedMeta`.
 * They were separate functions with the same fallback, and a review found one
 * of them.
 *
 * `page_translations.title`/`.description` track the *draft*: `saveDraft`
 * writes them from the draft's `meta` while `is_published` stays true. Falling
 * back to them when the released document has no `meta.title` therefore serves
 * an unreleased headline on exactly the pages whose released document cannot
 * contradict it. A document that does not state a title is reported as not
 * stating one; the caller still has the slug.
 *
 * `apps/web` does the opposite and worse — `normalizeDoc` in
 * `@repo/api/page-builder` overlays the column *over* the document's meta for
 * every page, so the live site shows a saved draft's headline on a published
 * page. Roadmap S10. It is not a reason to copy it: a model reads these
 * answers and repeats them.
 */
export function releasedHeadline(meta: unknown): {
  title: string;
  description: string | null;
} {
  const fields = meta as { title?: unknown; description?: unknown } | undefined;
  return {
    title: typeof fields?.title === "string" ? fields.title : "",
    description:
      typeof fields?.description === "string" ? fields.description : null,
  };
}

/** {@link releasedHeadline}, reading the released document's own `meta`. */
function publishedHeadline(published: PageDoc | null): {
  title: string;
  description: string | null;
} {
  return releasedHeadline(published?.meta);
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
  // A missing anchor must refuse, not relocate. `insertBlock` computes
  // `findIndex(...) + 1`, so an unknown `afterBlockId` becomes index 0 — its
  // own `idx < 0` guard can never fire — and the block lands at the *top* of
  // the page. Reporting that as "inserted after <id>" contradicts this tool's
  // contract that an unknown block id is reported as not applied, and it
  // silently reorders a live page.
  if (edit.afterBlockId && !findBlock(doc, edit.afterBlockId)) {
    return {
      edit,
      applied: false,
      detail: `No block with id ${edit.afterBlockId} exists; nothing was inserted.`,
    };
  }
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

/**
 * Path segments that must never be traversed.
 *
 * `setProp` walks the path with `node[key]`, which follows `__proto__` to the
 * real `Object.prototype` — so a path like `__proto__.polluted` writes onto
 * every object in the process. `applyEdits` deep-copies through `JSON.parse`,
 * which does not help: the copy's prototype IS `Object.prototype`.
 *
 * This is checked here rather than only in the tool schema because the service
 * is exported and a second caller must not be able to reintroduce it. The
 * underlying `setProp` in `@repo/editor` has the same weakness and is reachable
 * from the editor's own copilot; changing shared editor behaviour is outside
 * this package, so it is recorded in `docs/roadmap.md` instead.
 */
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/**
 * Most segments a prop path may have. `items.0.cta.label` is four.
 */
const MAX_PROP_PATH_SEGMENTS = 12;
/** Most characters one segment may have. */
const MAX_PROP_PATH_SEGMENT_LENGTH = 64;
/**
 * Largest array index a prop path may address.
 *
 * `setProp` creates an array when the *next* segment parses as a number, then
 * assigns `node[index]` — which sets the array's `length` to `index + 1`. A
 * path of `items.4294967294` therefore produces an array of length
 * 4,294,967,295, and saving the page serialises it: `JSON.stringify` walks
 * every slot and emits `null` for each, which is where the process dies.
 *
 * Nothing legitimate needs a four-digit index. Blocks and their prop arrays
 * are hand-authored in an editor, so this is an ample ceiling for an edit and
 * far below the point where the resulting document costs anything to write.
 */
const MAX_PROP_ARRAY_INDEX = 999;
/** A segment that is entirely digits, and therefore an array index. */
const ARRAY_INDEX_SEGMENT = /^\d+$/;

/**
 * Top-level keys `set_prop` may not address, because they are the block's
 * identity rather than its content.
 *
 * `setProp` walks from the **block**, not from `block.props`, so a path whose
 * first segment is `id` or `type` rewrites the discriminator the rest of the
 * document is keyed on. A duplicate or null `id` breaks `findBlock`, and
 * therefore every later `move`, `remove` and `set_prop` that targets it; an
 * unrecognised `type` renders as `Unknown block`. Neither is a prototype
 * escape — this is the same primitive as the `__proto__` guard above, one
 * level less exotic: what `setProp` overwrites rather than what it creates.
 *
 * Only the *first* segment is reserved. A prop legitimately named `id` or
 * `type` nested inside the block's content — `items.0.id`, `props.type` — is
 * ordinary data and stays writable.
 *
 * `layout` is deliberately not reserved: `layout.padding` is a legitimate
 * edit, and the schema's scalar-only `value` cannot replace the object with
 * anything that survives a render as identity would.
 */
const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set(["id", "type"]);

/**
 * Why this prop path may not be applied, or null when it may.
 *
 * Two separate hazards, both about what `setProp` *creates* rather than what
 * it overwrites: a prototype-bearing segment writes outside the document, and
 * an unbounded numeric segment allocates an array whose serialisation is the
 * thing that saves the page.
 */
export function propPathProblem(path: string): string | null {
  const segments = path.split(".");
  if (segments.length > MAX_PROP_PATH_SEGMENTS) {
    return `it has ${segments.length} segments; at most ${MAX_PROP_PATH_SEGMENTS} are allowed`;
  }
  const root = segments[0];
  if (root !== undefined && RESERVED_ROOT_SEGMENTS.has(root)) {
    return `\`${root}\` is the block's own identity, not one of its props`;
  }
  for (const segment of segments) {
    if (UNSAFE_PATH_SEGMENTS.has(segment)) {
      return `it traverses \`${segment}\`, which would write outside the document`;
    }
    if (segment.length > MAX_PROP_PATH_SEGMENT_LENGTH) {
      return `a segment is ${segment.length} characters; at most ${MAX_PROP_PATH_SEGMENT_LENGTH} are allowed`;
    }
    // Only a segment that is *entirely* digits becomes an array index;
    // `item2` is an ordinary key and stays one.
    if (
      ARRAY_INDEX_SEGMENT.test(segment) &&
      Number(segment) > MAX_PROP_ARRAY_INDEX
    ) {
      return `index ${segment} is beyond ${MAX_PROP_ARRAY_INDEX}, and applying it would allocate an array that large`;
    }
  }
  return null;
}

/**
 * Refuse to publish a draft that is not a usable document.
 *
 * Non-nullness is not validity, and publishing copies the draft string verbatim
 * over `puck_document`. An unparseable draft would therefore replace a working
 * public page with one the site renders as no blocks at all — and unpublishing
 * does not bring the old document back, because it has already been
 * overwritten.
 */
function assertPublishableDraft(
  pageId: string,
  locale: PageLocale,
  translation: { draft_document?: string | null }
): void {
  if (!translation.draft_document) {
    throw invalidInput(`Page ${pageId} has no ${locale} draft to publish.`, {
      pageId,
      locale,
    });
  }
  if (parseDoc(translation.draft_document) === null) {
    throw invalidInput(
      `Page ${pageId}'s ${locale} draft is malformed, so it was not published. The released document is unchanged.`,
      { pageId, locale }
    );
  }
}

function applySetProp(
  doc: EditorPageDoc,
  edit: Extract<BlockEdit, { op: "set_prop" }>
): BlockEditOutcome {
  const problem = propPathProblem(edit.path);
  if (problem) {
    return {
      edit,
      applied: false,
      detail: `"${edit.path}" was refused: ${problem}; nothing was set.`,
    };
  }
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
 * The error for a publish whose locale row committed and page row did not.
 *
 * Two rows, two requests, and Appwrite has no transaction across them. When
 * only the first lands, the operation is not the clean failure the underlying
 * error describes: the locale's draft is public *now* — certainly so when the
 * page is already published through another locale — while the caller is being
 * told nothing happened. The committed half is reported rather than
 * compensated, because a compensating write can fail exactly the same way and
 * this package does not promise rollback. The original code is kept, so a
 * permission error still reads as one.
 */
function partialPublishFailure(
  error: unknown,
  input: {
    locale: string;
    published: boolean;
    translationRowId: string;
    localeCommitted: boolean;
  }
): DomainError {
  const mapped = fromAppwriteError(error, { operation: "publish page" });
  if (!input.localeCommitted) {
    return mapped;
  }
  const verb = input.published ? "published" : "unpublished";
  return new DomainError(
    mapped.code,
    `${mapped.message} The \`${input.locale}\` translation was already ${verb} and that change is committed; only the page's own status was not updated.`,
    {
      cause: error,
      details: {
        ...mapped.details,
        committed: {
          table: TRANSLATION_TABLE,
          rowId: input.translationRowId,
          isPublished: input.published,
        },
        pageStatusUpdated: false,
      },
      remedy: input.published
        ? "The locale is live even though the page status did not change. Re-run this tool to finish the publish, or unpublish the locale to undo it."
        : "The locale is hidden even though the page status did not change. Re-run this tool to finish, or publish the locale again to undo it.",
    }
  );
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
   * How much of a page this principal may see, or nothing at all.
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
   *
   * This is the single definition behind both callers — `pageVisibility`,
   * which refuses a read, and `list`, which skips a row. They were separate
   * predicates saying the same thing until one of them was corrected and the
   * other was not: the member-only gate below was added to the load path
   * alone, leaving the listing still handing out a member-only page's slug,
   * owner and live link to any staff caller. One function with two thin
   * callers is what stops that happening a third time.
   */
  function pageAccess(
    principal: Principal,
    row: Pages
  ): "draft" | "published-only" | "none" {
    const campusId = relationId(row.campus) ?? row.campus_id ?? null;
    const departmentId =
      relationId(row.department) ?? row.department_id ?? null;
    if (canReadRow(principal, campusId, departmentId)) {
      return "draft";
    }
    if (row.status === "published") {
      // "Published" is not the same as "public". `pageRowPermissions` — and
      // `buildPageRowPermissions`, which it mirrors — grant a published page
      // with `visibility: "authenticated"` a read for the members team alone.
      // A staff principal is derived from campus and department teams and
      // proves nothing about membership, so without this a member-only page
      // is readable by any staff caller who knows its id. There is no second
      // gate to fall back on: this table has row security off and a
      // table-level `read("any")`, which is the whole reason the decision
      // happens here at all.
      if (row.visibility === "authenticated" && !principal.isMember) {
        return "none";
      }
      return "published-only";
    }
    return "none";
  }

  /** {@link pageAccess}, as a read gate: "none" is reported as absent. */
  function pageVisibility(
    principal: Principal,
    row: Pages
  ): "draft" | "published-only" {
    const access = pageAccess(principal, row);
    if (access === "none") {
      throw notFound(`No page found with id ${row.$id}.`, { pageId: row.$id });
    }
    return access;
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
      const isVisible = (row: Pages): boolean =>
        pageAccess(principal, row) !== "none";

      try {
        const scan = await scanForward<Pages, Pages>({
          ceiling: PAGE_SCAN_CEILING,
          batchSize: PAGE_SCAN_BATCH,
          limit: input.limit,
          offset: input.offset,
          read: (offset, size) =>
            clients.user.db.listRows<Pages>("app", PAGE_TABLE, [
              ...baseQueries,
              Query.limit(size),
              Query.offset(offset),
            ]),
          accept: (row) => (isVisible(row) ? row : null),
        });

        return {
          rows: scan.items.map(summarise),
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

      if (!(canSeeDraft || (published && translation.is_published))) {
        // Either this locale has never been released, or it was released and
        // then withdrawn. Unpublishing writes `is_published: false` and leaves
        // `puck_document` in place, so the document alone cannot say which —
        // and after another locale republishes the parent row, serving it
        // would hand back copy that was deliberately taken down. The public
        // route asks the same question (`translation.is_published`) before it
        // renders anything.
        throw notFound(
          `Page ${input.pageId} has no published ${input.locale} document.`,
          { pageId: input.pageId, locale: input.locale }
        );
      }

      // `saveDraft` writes the draft's `meta.title`/`meta.description` into the
      // translation row's own columns while `is_published` stays true, so those
      // columns can hold unreleased copy. A caller limited to the published
      // document must read its metadata from that document too — otherwise they
      // get released blocks under an unreleased headline.
      const headline = canSeeDraft
        ? { title: translation.title, description: translation.description }
        : publishedHeadline(published);

      return {
        page: summarise(row),
        locale: input.locale,
        title: headline.title,
        description: headline.description ?? null,
        isPublished: translation.is_published,
        publishedAt: translation.published_at,
        revision: translation.$updatedAt,
        meta: active?.meta ?? null,
        blocks: (active?.blocks ?? []).map(toBlockSummary),
        blockCount: active?.blocks.length ?? 0,
        canSeeDraft,
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
      if (input.published) {
        assertPublishableDraft(input.pageId, input.locale, existing);
      }

      const permissions = pageRowPermissions({
        isPublished: input.published,
        visibility: row.visibility,
      });
      const { db } = clients.requireElevated(
        "publish page (page rows grant no write to campus teams)"
      );

      // Two rows, two requests, and Appwrite has no transaction spanning
      // them. Which one failed decides what the caller is told, so the flag
      // is tracked rather than inferred from the error.
      let localeCommitted = false;
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
        localeCommitted = true;
        // The parent row follows the locale unconditionally, which is what
        // `unpublishPage` in `@repo/api/page-builder` does — the function the
        // editor's own unpublish button calls, with no check for a sibling
        // locale either. So unpublishing one locale of a bilingual page also
        // drafts the parent, and the still-published locale keeps its URL
        // (`getPage` resolves by slug and reads the translation) while
        // dropping out of the sitemap and every public listing, which do gate
        // on `pages.status`.
        //
        // Deliberately not corrected here. The same action would then leave
        // different state depending on whether it was done from the portal or
        // from this server, and the asymmetry is the repo's: its publish path
        // sets the parent published while its unpublish path drafts it. The
        // tool says what it does, and `docs/roadmap.md` carries the product
        // question.
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
        throw partialPublishFailure(error, {
          locale: input.locale,
          published: input.published,
          translationRowId: existing.$id,
          localeCommitted,
        });
      }
    },
  };
}
