/**
 * Page documents and the block editor.
 *
 * The contrast with the existing page-editor copilot is the point of this
 * module: `biso_page_load` returns the real blocks on a persisted document
 * (where `list_blocks` returns a note telling the model to look at its prompt),
 * and `biso_page_edit_blocks` reports per-edit what actually happened,
 * including when nothing did (where `insert_block` always reports success).
 *
 * There is deliberately no `generate_copy` equivalent. The editor's version
 * returns a placeholder string that a model can then write into a live page
 * through `set_prop`. An MCP client already has a language model — the one
 * calling these tools — so the right split is for it to write the copy and for
 * this server to persist it.
 */

import { Query } from "@repo/api";
import type { PageDoc } from "@repo/api/page-builder";
import { BRAND_ACCENT_VALUES } from "@repo/editor/theme/presets";
import { z } from "zod";
import { isAnonymous } from "../identity/principal";
import {
  assertPublishAccess,
  describeScope,
  PUBLISH_SCOPE_NOTE,
} from "../identity/scope";
import type { ToolContext } from "../runtime/context";
import { forbidden, invalidInput, notFound } from "../runtime/errors";
import { defineTool, type ToolModule } from "../runtime/register";
import { encodeCursor } from "../runtime/result";
import {
  BLOCK_TYPE_CATALOG,
  FEED_BINDING_BLOCKS,
  isKnownBlockType,
} from "../services/blocks";
import {
  type BlockEdit,
  type PageDocumentView,
  parseDoc,
  unsafePathSegment,
} from "../services/pages";
import type { Projected } from "../services/row";
import { proposalInput, proposeOrExecute } from "./content";
import {
  newRequestId,
  paginationInput,
  READ_ONLY,
  readPage,
  result,
  STAFF_PROFILES,
  WRITE_ADDITIVE,
  WRITE_IDEMPOTENT,
} from "./shared";

const localeArg = z
  .enum(["no", "en"])
  .describe("Which locale's document. `no` is authoritative.");

/**
 * The block-edit union.
 *
 * A discriminated union, not an open payload record: each operation names
 * exactly the fields it needs, so a malformed edit fails validation at the
 * protocol boundary rather than half-applying.
 */
const blockEditSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("insert"),
    blockType: z
      .string()
      .min(1)
      .describe(
        "Block type to insert, e.g. `hero`, `text`, `cta`. `biso_page_list_block_types` lists them."
      ),
    afterBlockId: z
      .string()
      .optional()
      .describe("Insert after this block id. Omit to append."),
  }),
  z.object({
    op: z.literal("remove"),
    blockId: z.string().min(1).describe("Block id to remove."),
  }),
  z.object({
    op: z.literal("move"),
    blockId: z.string().min(1).describe("Block id to move."),
    toIndex: z.number().int().min(0).describe("Zero-based destination index."),
  }),
  z.object({
    op: z.literal("set_prop"),
    blockId: z.string().min(1).describe("Block id to edit."),
    path: z
      .string()
      .min(1)
      .refine((value) => unsafePathSegment(value) === null, {
        message:
          "A prop path may not contain `__proto__`, `constructor` or `prototype`.",
      })
      .describe("Dot-notation prop path, e.g. `title` or `items.0.label`."),
    value: z
      .union([z.string(), z.number(), z.boolean(), z.null()])
      .describe("The value to set."),
  }),
  z.object({
    op: z.literal("set_variant"),
    blockId: z.string().min(1).describe("Block id."),
    variant: z.string().min(1).describe("Variant id, e.g. `split`."),
  }),
  z.object({
    op: z.literal("set_meta"),
    // `slug` is deliberately absent. It is the page's public address: the
    // canonical `savePageDraft` writes `meta.slug` to the `pages` row, which
    // carries the `page_slug_unique` index and a `resolveUniquePageSlug`
    // conflict policy, and `apps/admin` adds a unit-namespace rule on top.
    // Saving only the document would report a slug change that never reached
    // routing; doing it properly would make a `draft`-tier edit silently move a
    // live URL, which editing again does not undo.
    key: z.enum(["title", "description"]).describe("Which meta field."),
    value: z.string().describe("The new value."),
  }),
  z.object({
    op: z.literal("set_accent"),
    hex: z
      .enum(BRAND_ACCENT_VALUES)
      .describe(
        `An approved BISO accent. Only these five are permitted: ${BRAND_ACCENT_VALUES.join(", ")}.`
      ),
  }),
]);

/**
 * What to tell the caller about the document they were served.
 *
 * Two different situations produce a published document, and conflating them
 * tells an owner they are out of scope when they are not.
 */
function loadWarnings(view: PageDocumentView): string[] | undefined {
  if (!view.canSeeDraft) {
    return [
      "This page is outside your scope, so you are reading its published document. Any draft edits in progress are not shown, and you cannot save changes to it.",
    ];
  }
  if (view.documentSource === "published") {
    return [
      "This locale has no draft document, so you are reading the published one. Editing it will create a draft from these blocks.",
    ];
  }
  return;
}

export const pagesModule: ToolModule = {
  name: "pages",
  title: "Page documents",
  description:
    "Load, inspect and edit the block documents behind BISO pages, and publish them through the existing gate.",
  tools: [
    defineTool({
      name: "biso_page_list",
      title: "List pages",
      description:
        "List pages you can see. Published pages are visible to everyone; drafts are filtered to your campus and department in application code, because the `pages` table has row security disabled and grants read to anyone.",
      inputSchema: {
        query: z.string().optional().describe("Match against the slug."),
        status: z
          .enum(["draft", "published", "archived"])
          .optional()
          .describe("Filter by page status."),
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.pages.list(context.principal, {
          query: args.query,
          status: args.status,
          limit,
          offset,
        });
        return result({
          requestId,
          summary: `${found.rows.length} page(s) visible to you.`,
          data: { pages: found.rows },
          scope: describeScope(context.principal),
          pagination: {
            count: found.rows.length,
            total: found.total,
            nextCursor:
              found.nextOffset === null ? null : encodeCursor(found.nextOffset),
            hasMore: found.nextOffset !== null,
          },
          warnings: [
            "Page visibility is decided per row after the query, so a page can come back shorter than the limit while more results remain. Follow `pagination.nextCursor` until it is null rather than stopping at the first short page.",
          ],
        });
      },
    }),

    defineTool({
      name: "biso_page_load",
      title: "Load a page document",
      description:
        "Load the real, persisted block document for a page and locale: its metadata, every block with its id, type, variant and props, and a `revision` to pass back when saving. This reads the draft when one exists, otherwise the published document.",
      inputSchema: {
        pageId: z.string().min(1).describe("The page row $id."),
        locale: localeArg,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const view = await context.services.pages.load(context.principal, {
          pageId: args.pageId,
          locale: args.locale,
        });
        return result({
          requestId,
          summary: `"${view.title}" (${args.locale}) — ${view.blockCount} blocks from the ${view.documentSource} document, ${view.isPublished ? "published" : "not published"}${view.hasUnpublishedChanges ? ", with unpublished draft changes" : ""}.`,
          data: view,
          scope: describeScope(context.principal),
          links: view.page.links,
          warnings: loadWarnings(view),
        });
      },
    }),

    defineTool({
      name: "biso_page_list_block_types",
      title: "Block types and brand accents",
      description:
        "List the block types that can be inserted, which of them bind to a live content feed, and the approved brand accent colours. Use before `biso_page_edit_blocks`.",
      inputSchema: {},
      annotations: READ_ONLY,
      unprivilegedRead:
        "Returns this package's own static block catalogue — its own schema, not BISO's data — and a forced refresh that fails would make it unreadable for nothing.",
      profiles: STAFF_PROFILES,
      handler(_args, context) {
        const requestId = newRequestId();
        return Promise.resolve(
          result({
            requestId,
            summary: `${BLOCK_TYPE_CATALOG.length} block types; ${FEED_BINDING_BLOCKS.length} of them bind to a content feed.`,
            data: {
              blockTypes: BLOCK_TYPE_CATALOG,
              feedBindingBlocks: FEED_BINDING_BLOCKS,
              brandAccents: BRAND_ACCENT_VALUES,
              note: "Only these five accents are accepted; any other hex is refused rather than written.",
            },
            scope: describeScope(context.principal),
          })
        );
      },
    }),

    defineTool({
      name: "biso_page_edit_blocks",
      title: "Edit page blocks",
      description:
        "Apply a list of block edits to a page's document. Every edit is reported individually with what actually happened — an edit naming a block id that does not exist is reported as not applied, not as success. Without a proposalToken this computes the result and writes nothing; the response shows the resulting block list so the change can be reviewed before it is saved.",
      inputSchema: {
        pageId: z.string().min(1).describe("The page row $id."),
        locale: localeArg,
        edits: z
          .array(blockEditSchema)
          .min(1)
          .max(50)
          .describe("Edits applied in order."),
        expectedRevision: z
          .string()
          .optional()
          .describe(
            "The `revision` from `biso_page_load`. Strongly recommended: the save is refused if the document changed meanwhile."
          ),
        ...proposalInput,
      },
      annotations: WRITE_ADDITIVE,
      tier: "draft",
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        if (isAnonymous(context.principal)) {
          return "No user credential is configured.";
        }
        if (!context.clients.hasElevated) {
          return "Saving a page draft needs the service key: `page_translations` grants update only to Operations Unit and the ledelsen teams, so even an authorized campus admin cannot write it under their own credential. Set BISO_MCP_APPWRITE_API_KEY.";
        }
        return true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const view = await context.services.pages.load(context.principal, {
          pageId: args.pageId,
          locale: args.locale,
        });

        if (!view.meta) {
          throw notFound(
            `Page ${args.pageId} has no ${args.locale} document to edit.`,
            { pageId: args.pageId, locale: args.locale }
          );
        }

        // Reload the full document: `load` returns truncated prop previews for
        // readability, which must never be what gets written back.
        for (const edit of args.edits) {
          if (edit.op === "insert" && !isKnownBlockType(edit.blockType)) {
            throw invalidInput(
              `"${edit.blockType}" is not a block type. Call biso_page_list_block_types for the full list.`,
              { blockType: edit.blockType }
            );
          }
        }

        // `load` above already decided, from the principal's scope, which
        // document this caller may see. A caller limited to the published one
        // cannot save an edit anyway — `saveDraft` refuses them — and building
        // a proposal for them would leak the draft's block ids, types and
        // count through `outcomes` and `resultingBlocks` before that refusal.
        // So the refusal happens here, before the document is loaded at all.
        //
        // `canSeeDraft`, not `documentSource`: an owner whose locale has only a
        // published document — a legacy row, or a draft that failed to parse —
        // also reads `documentSource: "published"`, and refusing them would
        // block the very edit that creates or repairs the draft.
        if (!view.canSeeDraft) {
          throw forbidden(
            "This page is outside your scope, so you can only read its published document.",
            { pageId: args.pageId, campusId: view.page.campusId },
            "Content is editable by the department that owns it, that campus's management team, or a global admin."
          );
        }

        const full = await loadFullDoc(context, args.pageId, args.locale);
        const { doc, outcomes } = context.services.pages.applyEdits(
          full,
          args.edits as BlockEdit[]
        );

        const applied = outcomes.filter((outcome) => outcome.applied).length;
        const rejected = outcomes.length - applied;
        if (applied === 0) {
          throw invalidInput(
            "None of the edits applied. Nothing was written.",
            { outcomes }
          );
        }

        const revision = args.expectedRevision ?? view.revision;
        const payload = {
          pageId: args.pageId,
          locale: args.locale,
          edits: args.edits,
        };

        const outcome = await proposeOrExecute({
          context,
          action: "pages.save_draft",
          tier: "draft",
          targets: [
            {
              table: "page_translations",
              id: args.pageId,
              label: `${view.title} (${args.locale})`,
            },
          ],
          payload,
          diff: [
            {
              path: "blocks",
              before: `${view.blockCount} blocks`,
              after: `${doc.blocks.length} blocks`,
            },
          ],
          revision,
          token: args.proposalToken,
          expiresAt: args.proposalExpiresAt,
          confirmation: {
            title: "Save page draft",
            message: `Apply ${applied} edit(s) to "${view.title}" (${args.locale}) and save the draft. The page's published version is not affected.`,
          },
          execute: () =>
            context.services.pages.saveDraft(context.principal, {
              pageId: args.pageId,
              locale: args.locale,
              doc,
              expectedRevision: revision,
            }),
        });

        return result({
          requestId,
          summary: `${outcome.summary} ${applied} edit(s) applied${rejected > 0 ? `, ${rejected} not applied` : ""}.`,
          effect: outcome.executed ? "executed" : "proposed",
          data: {
            outcomes,
            resultingBlocks: doc.blocks.map((block) => {
              const record = block as Record<string, unknown>;
              return { id: record.id, type: record.type };
            }),
            ...(outcome.executed
              ? { saved: outcome.data }
              : { proposal: outcome.proposal }),
            ...(outcome.executed ? { proposal: outcome.proposal } : {}),
          },
          scope: describeScope(context.principal),
          warnings:
            rejected > 0
              ? [`${rejected} edit(s) did not apply; see \`outcomes\`.`]
              : undefined,
          links: view.page.links,
        });
      },
    }),

    defineTool({
      name: "biso_page_publish",
      title: "Publish or unpublish a page",
      description: `Publish a page's draft document to the public site, or unpublish it. Publishing copies the draft into the published document — exactly what the editor's publish does. ${PUBLISH_SCOPE_NOTE}`,
      inputSchema: {
        pageId: z.string().min(1).describe("The page row $id."),
        locale: localeArg,
        publish: z.boolean().describe("True to publish, false to unpublish."),
        expectedRevision: z
          .string()
          .optional()
          .describe("The `revision` from `biso_page_load`."),
        ...proposalInput,
      },
      annotations: WRITE_IDEMPOTENT,
      tier: "publish",
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        if (isAnonymous(context.principal)) {
          return "No user credential is configured.";
        }
        if (!context.clients.hasElevated) {
          return "Publishing a page needs the service key; see `biso_page_edit_blocks`.";
        }
        return true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const view = await context.services.pages.load(context.principal, {
          pageId: args.pageId,
          locale: args.locale,
        });
        // `load` hands an out-of-scope caller the published view of a published
        // page on purpose, so reaching here proves nothing about publishing.
        // Authorize before a proposal exists: minting one says it is executable
        // and, in `confirm` mode, puts a confirmation in front of a person for
        // a change `setPublished` will refuse once the token comes back. The
        // same guard `biso_page_edit_blocks` applies.
        assertPublishAccess(
          context.principal,
          view.page.campusId,
          view.page.departmentId
        );
        const revision = args.expectedRevision ?? view.revision;
        const payload = {
          pageId: args.pageId,
          locale: args.locale,
          publish: args.publish,
        };

        const outcome = await proposeOrExecute({
          context,
          action: args.publish ? "pages.publish" : "pages.unpublish",
          tier: "publish",
          targets: [
            {
              table: "pages",
              id: args.pageId,
              label: `${view.title} (${args.locale})`,
            },
          ],
          payload,
          diff: [
            {
              path: "is_published",
              before: view.isPublished,
              after: args.publish,
            },
          ],
          revision,
          token: args.proposalToken,
          expiresAt: args.proposalExpiresAt,
          confirmation: {
            title: args.publish ? "Publish page" : "Unpublish page",
            message: args.publish
              ? `Publish "${view.title}" (${args.locale}) to the public site.`
              : `Remove "${view.title}" (${args.locale}) from the public site.`,
          },
          execute: () =>
            context.services.pages.setPublished(context.principal, {
              pageId: args.pageId,
              locale: args.locale,
              published: args.publish,
              expectedRevision: revision,
            }),
        });

        return result({
          requestId,
          summary: outcome.summary,
          effect: outcome.executed ? "executed" : "proposed",
          data: outcome.executed
            ? { applied: outcome.data, proposal: outcome.proposal }
            : { proposal: outcome.proposal },
          scope: describeScope(context.principal),
          links: view.page.links,
        });
      },
    }),
  ],
};

/**
 * Re-read a page document without the prop truncation `load` applies.
 *
 * `load` shortens long strings so a listing stays readable; writing that back
 * would silently truncate the page's real content.
 */
/**
 * NOT an authorization boundary. This reads whichever document exists,
 * preferring the draft, and performs no scope check of its own — every caller
 * must have established the principal's access first (see the
 * `documentSource` guard in `biso_page_edit_blocks`). It exists only because
 * `load` returns truncated prop previews for readability, which must never be
 * what gets written back.
 */
async function loadFullDoc(
  context: ToolContext,
  pageId: string,
  locale: "no" | "en"
): Promise<PageDoc> {
  const result_ = await context.clients.user.db.listRows<
    Projected<{
      translation_refs?: Array<{
        locale: string;
        draft_document: string | null;
        puck_document: string | null;
      }>;
    }>
  >("app", "pages", [
    Query.equal("$id", pageId),
    Query.select(["$id", "translation_refs.*"]),
    Query.limit(1),
  ]);
  const row = result_.rows[0];
  const translation = row?.translation_refs?.find(
    (item) => item.locale === locale
  );
  if (!(translation?.draft_document || translation?.puck_document)) {
    throw notFound(`Page ${pageId} has no ${locale} document.`, {
      pageId,
      locale,
    });
  }

  // Parse before choosing, not after. Choosing on non-nullness alone picks a
  // malformed draft over a perfectly good published document — and `load` has
  // already told the owner they may edit that published fallback, so this is
  // precisely the row they came here to repair. `parseDoc` applies the same
  // "unusable means absent" rule `load` uses, so the two cannot disagree about
  // which document exists.
  const doc =
    parseDoc(translation.draft_document) ?? parseDoc(translation.puck_document);
  if (!doc) {
    throw invalidInput(`Page ${pageId}'s ${locale} document is malformed.`, {
      pageId,
      locale,
    });
  }
  return doc;
}
