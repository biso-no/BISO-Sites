/**
 * Commerce, events and recruitment reads, plus integration configuration.
 *
 * Grouped as one module because they share a shape: each is a read surface over
 * a domain whose write half is deliberately out of scope, and each states why.
 */

import { z } from "zod";
import { describeScope } from "../identity/scope";
import { defineTool, type ToolModule } from "../runtime/register";
import { buildPagination } from "../runtime/result";
import { ORDER_STATUSES } from "../services/commerce";
import { hasRecruitmentAccess } from "../services/recruitment";
import {
  newRequestId,
  OPERATOR_PROFILES,
  paginationInput,
  READ_ONLY,
  readPage,
  result,
  STAFF_PROFILES,
} from "./shared";

export const commerceModule: ToolModule = {
  name: "commerce",
  title: "Orders",
  description:
    "Look up webshop orders and explain where one stands. Reads only — refunds stay in the admin app.",
  tools: [
    defineTool({
      name: "biso_search_orders",
      title: "Search orders",
      description:
        "Search webshop orders by buyer name, email or order id, scoped to your campus. Note the `orders` table grants read to the Operations Unit team, so a campus admin may see nothing here even where campus scope would allow it.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Buyer name, email, or an exact order id."),
        status: z
          .enum(ORDER_STATUSES)
          .optional()
          .describe("Filter by order status."),
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.commerce.searchOrders(
          context.principal,
          { query: args.query, status: args.status, limit, offset }
        );
        return result({
          requestId,
          summary:
            found.rows.length === 0
              ? "No orders match."
              : `${found.rows.length} order(s).`,
          data: { orders: found.rows },
          scope: describeScope(context.principal, { departmentField: null }),
          pagination: buildPagination({
            count: found.rows.length,
            total: found.total,
            offset,
            limit,
          }),
        });
      },
    }),

    defineTool({
      name: "biso_get_order",
      title: "Order detail and diagnostics",
      description:
        "Read one order with its line items and a plain-language explanation of where it stands: whether payment completed, whether it posted to the Finago ledger, whether a refund or posting claim is held. Derived from stored state only — no payment provider is contacted.",
      inputSchema: {
        orderId: z.string().min(1).describe("The order row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const order = await context.services.commerce.getOrder(
          context.principal,
          args.orderId
        );
        return result({
          requestId,
          summary: `Order ${order.id}: ${order.status}, ${order.total} ${order.currency}, ${order.items.length} line item(s).${order.diagnostics.length > 0 ? ` ${order.diagnostics.length} note(s).` : ""}`,
          data: order,
          scope: describeScope(context.principal, { departmentField: null }),
          warnings: [
            "Refunds are not available from this server: the guard against a double refund is an atomic lock held by the admin app's refund orchestrator, and a second implementation of it would be a second thing to get wrong.",
          ],
        });
      },
    }),
  ],
};

export const eventsModule: ToolModule = {
  name: "events",
  title: "Event audiences and segments",
  description:
    "Inspect an event's attendee list, its segments and their capacity. Reads only.",
  tools: [
    defineTool({
      name: "biso_event_segments",
      title: "Event segments",
      description:
        "List an event's segments with their capacity and current membership. Authorized against the parent event's campus, because the segment and attendee tables have row security disabled and cannot be scoped by Appwrite.",
      inputSchema: {
        eventId: z.string().min(1).describe("The event row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return context.clients.hasElevated
          ? true
          : "Attendee and segment-member counts need the service key: `event_attendees` grants no read to user credentials, and `segment_members` would silently undercount. Without it this tool could only return a wrong number.";
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const page = await context.services.events.listSegments(
          context.principal,
          { eventId: args.eventId }
        );
        const segments = page.rows;
        return result({
          requestId,
          summary:
            segments.length === 0
              ? "This event has no segments."
              : `${page.truncated ? "At least " : ""}${segments.length} segment(s).`,
          data: { segments, truncated: page.truncated },
          scope: describeScope(context.principal),
          warnings: page.truncated
            ? [
                `Only the first ${segments.length} segments were read; this event has more. Capacity and membership for the rest are not included.`,
              ]
            : [],
        });
      },
    }),

    defineTool({
      name: "biso_event_audience",
      title: "Event audience preview",
      description:
        "Summarise who an event would reach: attendee count, segments and their fill, and how many attendees are not yet assigned to any segment. Use this before planning a message — sending one is not available here.",
      inputSchema: {
        eventId: z.string().min(1).describe("The event row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return context.clients.hasElevated
          ? true
          : "Attendee and segment-member counts need the service key: `event_attendees` grants no read to user credentials, and `segment_members` would silently undercount. Without it this tool could only return a wrong number.";
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const audience = await context.services.events.audience(
          context.principal,
          { eventId: args.eventId }
        );
        return result({
          requestId,
          summary: `"${audience.eventTitle ?? audience.eventId}": ${audience.attendeeCount} attendee(s), ${audience.segments.length} segment(s), ${audience.unassignedCount} unassigned.`,
          data: audience,
          scope: describeScope(context.principal),
          warnings: audience.notes,
        });
      },
    }),
  ],
};

export const recruitmentModule: ToolModule = {
  name: "recruitment",
  title: "Recruitment",
  description:
    "Vacancies and applications, for HR and global admins only. Reads only: hiring decisions and candidate emails stay under human control.",
  tools: [
    defineTool({
      name: "biso_list_vacancies",
      title: "List vacancies",
      description:
        "List recruitment vacancies in your HR scope, with deadlines, scheduled publication and whether AI screening is enabled.",
      inputSchema: {
        status: z
          .enum(["draft", "published", "closed"])
          .optional()
          .describe("Filter by vacancy status."),
        campusId: z.string().optional().describe("Filter to one campus id."),
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return hasRecruitmentAccess(context.principal)
          ? true
          : "Recruitment is HR-exclusive with global-admin break-glass. This principal holds neither, so vacancy tools are not registered.";
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.recruitment.listVacancies(
          context.principal,
          { status: args.status, campusId: args.campusId, limit, offset }
        );
        return result({
          requestId,
          summary:
            found.rows.length === 0
              ? `No vacancies. ${found.scopeNote}`
              : `${found.rows.length} vacancy/vacancies. ${found.scopeNote}`,
          data: { vacancies: found.rows },
          scope: describeScope(context.principal),
          pagination: buildPagination({
            count: found.rows.length,
            total: found.total,
            offset,
            limit,
          }),
        });
      },
    }),

    defineTool({
      name: "biso_get_vacancy",
      title: "Get vacancy",
      description:
        "Read one vacancy by id, scoped by the recruitment rule rather than the general content rule — HR sees every vacancy at its campuses regardless of which department owns it. Screening rubric and interview template are reported as present or absent, never returned.",
      inputSchema: {
        jobId: z.string().min(1).describe("The vacancy row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return hasRecruitmentAccess(context.principal)
          ? true
          : "Recruitment is HR-exclusive with global-admin break-glass. This principal holds neither, so vacancy tools are not registered.";
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const vacancy = await context.services.recruitment.getVacancy(
          context.principal,
          args.jobId
        );
        return result({
          requestId,
          summary: `"${vacancy.title ?? vacancy.slug}" — ${vacancy.status}, ${vacancy.campusLabel}.`,
          data: { vacancy },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_list_applications",
      title: "Applications for a vacancy",
      description:
        "List applications for one vacancy, ordered by AI screening score. Returns each candidate's name, email, status, screening score and whether a resume exists. Cover letter bodies, phone numbers and resume files are never returned — open the candidate in the admin app to read those.",
      inputSchema: {
        jobId: z.string().min(1).describe("The vacancy row $id."),
        status: z.string().optional().describe("Filter by application status."),
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return hasRecruitmentAccess(context.principal)
          ? true
          : "Recruitment is HR-exclusive with global-admin break-glass.";
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.recruitment.listApplications(
          context.principal,
          { jobId: args.jobId, status: args.status, limit, offset }
        );
        const screened = found.rows.filter((row) => row.hasScreening).length;
        return result({
          requestId,
          summary: `${found.rows.length} application(s); ${screened} have an AI screening result.`,
          data: {
            applications: found.rows,
            note: "Screening scores are model output and are advisory. They are not a hiring decision, and an unscreened application is not a weaker one — screening only runs when the vacancy has it enabled and a provider key is configured.",
          },
          scope: describeScope(context.principal),
          pagination: buildPagination({
            count: found.rows.length,
            total: found.total,
            offset,
            limit,
          }),
          links: {
            applications: context.links.admin(
              `/jobs/${args.jobId}/applications`
            ),
          },
        });
      },
    }),
  ],
};

export const platformModule: ToolModule = {
  name: "platform",
  title: "Platform operations",
  description:
    "Which integrations this server can see configuration for. Global admins only.",
  tools: [
    defineTool({
      name: "biso_integration_configuration",
      title: "Integration configuration",
      description:
        "Report which external integrations have their required environment variables set IN THIS PROCESS. This is a configuration check, not a health check: nothing is contacted, so a configured integration may still be unreachable, and a variable set for the web apps but not for this server reports as missing.",
      inputSchema: {},
      annotations: READ_ONLY,
      profiles: OPERATOR_PROFILES,
      handler(_args, context) {
        const requestId = newRequestId();
        const integrations =
          context.services.operations.integrationConfiguration();
        const missing = integrations.filter((entry) => !entry.configured);
        return Promise.resolve(
          result({
            requestId,
            summary:
              missing.length === 0
                ? `All ${integrations.length} integrations have their variables set in this process.`
                : `${missing.length} of ${integrations.length} integrations are missing variables in this process: ${missing.map((entry) => entry.name).join(", ")}.`,
            data: {
              integrations,
              note: "Configuration presence only. No request was made to any provider, so this cannot tell you whether a provider is reachable, whether a key is still valid, or whether a tenant still grants the scopes.",
            },
            scope: describeScope(context.principal),
            warnings: [
              "This server is not the admin app. Variables are read from this process's own environment.",
            ],
          })
        );
      },
    }),
  ],
};
