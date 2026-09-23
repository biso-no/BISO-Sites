/**
 * Public discovery.
 *
 * Registered for every profile including `public`, because these tools are the
 * whole capability when no credential is configured. They run on the anonymous
 * Appwrite client, so what they return is exactly what a signed-out visitor
 * would see — a draft cannot come back through here.
 */

import { z } from "zod";
import { defineTool, type ToolModule } from "../runtime/register";
import { buildPagination, encodeCursor, PUBLIC_SCOPE } from "../runtime/result";
import { PUBLIC_KINDS } from "../services/discovery";
import { DATE_FILTER_NOTE, OSLO_TIME_NOTE } from "../services/event-time";
import {
  ALL_PROFILES,
  localeInput,
  newRequestId,
  paginationInput,
  READ_ONLY,
  readPage,
  result,
} from "./shared";

export const discoveryModule: ToolModule = {
  name: "discovery",
  title: "Public discovery",
  description:
    "Search and read what BISO publishes: events, news, vacancies, pages, units, public benefit descriptions and public documents.",
  tools: [
    defineTool({
      name: "biso_public_search",
      title: "Search published content",
      description: `Search what BISO publishes publicly. Runs as an anonymous visitor, so only published, publicly visible items are returned — never drafts, and never member-only redemption codes. Filter by campus, and for events by start date. ${OSLO_TIME_NOTE}`,
      inputSchema: {
        kind: z
          .enum(PUBLIC_KINDS)
          .describe(
            "What to search: events, news, jobs (vacancies), pages, units (departments), benefits, or documents."
          ),
        query: z
          .string()
          .optional()
          .describe(
            "Free-text term. Applied where the public path supports it; the result's `notes` says when it was not."
          ),
        campusId: z
          .string()
          .optional()
          .describe("Numeric campus id, e.g. '1' for Oslo, '5' for National."),
        from: z
          .string()
          .optional()
          .describe(
            `Events only: ISO date; return events starting on or after it. ${DATE_FILTER_NOTE}`
          ),
        ...localeInput,
        ...paginationInput,
      },
      annotations: READ_ONLY,
      unprivilegedRead:
        "Answers entirely from the anonymous client, so the caller's memberships cannot change a single row of the result — and a forced refresh that failed would take public discovery down for nothing.",
      profiles: ALL_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.discovery.search({
          kind: args.kind,
          query: args.query,
          campusId: args.campusId,
          locale: args.locale,
          from: args.from,
          limit,
          offset,
        });

        const total = found.total;
        const more = total !== null && total > found.rows.length;

        // Page search decides publication per row after the query, so it
        // carries its own raw scan cursor; `buildPagination` infers the rest
        // from the count for every other kind.
        const pagination =
          found.nextOffset === undefined
            ? buildPagination({
                count: found.rows.length,
                total,
                offset,
                limit,
              })
            : {
                count: found.rows.length,
                total,
                nextCursor:
                  found.nextOffset === null
                    ? null
                    : encodeCursor(found.nextOffset),
                hasMore: found.nextOffset !== null,
              };

        const notes = [...found.notes];
        if (total === null) {
          notes.push(
            "Publication is decided per row after the query, so a page can come back shorter than the limit while more results remain. Follow `pagination.nextCursor` until it is null."
          );
        }

        return result({
          requestId,
          summary:
            found.rows.length === 0
              ? `No published ${args.kind} match that search.`
              : `${found.rows.length} published ${args.kind}${more ? ` of ${total}` : ""}.`,
          data: { items: found.rows },
          scope: PUBLIC_SCOPE,
          pagination,
          warnings: notes.length > 0 ? notes : undefined,
        });
      },
    }),

    defineTool({
      name: "biso_public_get_page",
      title: "Read a published page",
      description:
        "Read a published public page by slug: its title, description and the list of blocks it renders. Returns the PUBLISHED document, never the draft.",
      inputSchema: {
        slug: z
          .string()
          .min(1)
          .describe("The page slug, without a leading slash."),
        ...localeInput,
      },
      annotations: READ_ONLY,
      unprivilegedRead:
        "Answers entirely from the anonymous client, so the caller's memberships cannot change a single row of the result — and a forced refresh that failed would take public discovery down for nothing.",
      profiles: ALL_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const page = await context.services.discovery.getPublicPage({
          slug: args.slug,
          locale: args.locale ?? "no",
        });
        return result({
          requestId,
          summary: `"${page.title}" — ${page.blocks.length} blocks.`,
          data: page,
          scope: PUBLIC_SCOPE,
          links: { page: page.url },
        });
      },
    }),
  ],
};
