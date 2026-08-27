import "server-only";
import {
  buildAssistantCapabilities,
  buildAssistantSystemPrompt,
  buildAssistantTools,
  chatModel,
} from "@repo/ai/assistant";
import type { AssistantActionDeps } from "@repo/ai/assistant/types";
import { ID, type Models, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import {
  FEATURE_FLAGS,
  getFlagDef,
  mergeFlagStates,
} from "@repo/shared/utils/feature-flags";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { ORDER_ITEMS_SELECT } from "@repo/shared/utils/order-queries";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { type NextRequest, NextResponse } from "next/server";
import {
  approveRequest,
  listPendingApprovals,
  rejectRequest,
} from "@/app/(portal)/_actions/approvals";
// Server actions — content domains
import {
  createBenefit,
  getBenefit,
  listBenefits,
  updateBenefit,
} from "@/app/(portal)/_actions/benefits";
import {
  deleteDocument,
  getDocument,
  listDocuments,
} from "@/app/(portal)/_actions/documents";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  publishEvent,
  updateEvent,
} from "@/app/(portal)/_actions/events";
import { getInboxCounts as getInboxCountsAction } from "@/app/(portal)/_actions/inbox";
// Server actions — IT & approvals
import {
  createM365User,
  searchM365Users,
} from "@/app/(portal)/_actions/it-users";
import {
  createJob,
  deleteJob,
  getJob,
  listJobs,
  updateJob,
} from "@/app/(portal)/_actions/jobs";
import {
  createNews,
  deleteNews,
  getNewsArticle,
  listNews,
  updateNews,
} from "@/app/(portal)/_actions/news";
import {
  getDashboardStats,
  getPageById,
  listPages,
} from "@/app/(portal)/_actions/pages";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "@/app/(portal)/_actions/shop";
import { getLocale } from "@/app/actions/locale";
import { requireApiAuth } from "@/lib/api-auth";
import { buildAssistantOrderSearchQueries } from "@/lib/assistant-order-search";
import type { UserAuthContext } from "@/lib/authorization";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import { checkIntegrationHealth } from "@/lib/integration-health";
import { fetchRequiredTeamHealth } from "@/lib/team-health-check";
import {
  fetchEventsTotal,
  fetchStats,
  fetchTopMetrics,
} from "@/lib/umami/client";
import { assertPublishAccess } from "@/lib/utils/authorization";

export const maxDuration = 60;

interface AssistantRequestBody {
  activeFormSchemaId?: string;
  currentPath?: string;
  messages: UIMessage[];
}

export async function POST(request: NextRequest) {
  // 1. Verify auth
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }
  const { ctx } = auth;

  // 1b. Kill switch: the admin AI copilot can be disabled platform-wide.
  if (!(await isFeatureEnabled("ai_admin_copilot"))) {
    return NextResponse.json(
      { error: "The AI assistant is currently disabled." },
      { status: 403 }
    );
  }

  // 2. Locale
  const locale = await getLocale();

  // 3. Parse + validate body
  let body: AssistantRequestBody;
  try {
    body = (await request.json()) as AssistantRequestBody;
  } catch (_error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
  const { messages, currentPath = "/", activeFormSchemaId } = body;
  if (!Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Invalid request: 'messages' must be an array" },
      { status: 400 }
    );
  }

  // 4. Build capabilities from auth context
  const capabilities = buildAssistantCapabilities({
    roles: ctx.roles,
    hasDepartmentMembership: ctx.departmentTeamIds.length > 0,
    isCampusAdmin: ctx.managedCampuses.length > 0,
  });

  // 5. Human-readable role + scope summaries for the system prompt
  let roleSummary: string;
  if (ctx.roles.includes("globaladmin")) {
    roleSummary = "Global admin (full access to all campuses)";
  } else if (ctx.roles.includes("campusadmin")) {
    roleSummary = `Campus admin — manages: ${ctx.managedCampuses.join(", ")}`;
  } else if (ctx.departmentTeamIds.length > 0) {
    roleSummary = `Department member — departments: ${ctx.departmentNames.join(", ")}`;
  } else {
    roleSummary = "Read-only (no write access)";
  }

  let scopeSummary: string;
  if (ctx.roles.includes("globaladmin")) {
    scopeSummary = ctx.activeCampusId
      ? `Viewing campus: ${CAMPUS_ID_TO_NAME[ctx.activeCampusId] ?? "Unknown"}`
      : "All campuses visible";
  } else if (ctx.managedCampuses.length > 0) {
    scopeSummary = `Manages campuses: ${ctx.managedCampuses.join(", ")}`;
  } else {
    scopeSummary = `Departments: ${ctx.departmentNames.join(", ")}`;
  }

  const activeCampus = ctx.activeCampusId
    ? (CAMPUS_ID_TO_NAME[ctx.activeCampusId] ?? null)
    : null;

  // 6. Build deps — normalised interface over all server actions
  const deps = buildDeps(activeFormSchemaId, ctx);

  // 7. Build permission-gated tool set
  const tools = buildAssistantTools(capabilities, deps);

  // 8. Build system prompt with full context
  const instructions = buildAssistantSystemPrompt({
    locale,
    user: { name: ctx.name, email: ctx.email },
    roleSummary,
    scopeSummary,
    capabilities,
    currentPath,
    activeCampus,
    activeFormSchemaId: activeFormSchemaId ?? null,
  });

  // 9. Stream
  const result = streamText({
    model: chatModel,
    instructions,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(12),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools }),
  });
}

// ---------------------------------------------------------------------------
// Deps builder — maps normalised tool inputs to existing server actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers — extracted to keep buildDeps within complexity limits
// ---------------------------------------------------------------------------

const DOMAIN_PUBLISH_TABLE: Record<string, string> = {
  benefits: "campus_benefits",
  documents: "documents",
  jobs: "jobs",
  news: "news",
  pages: "pages",
  shop: "webshop_products",
};
type GenericRow = Models.Row & Record<string, unknown>;

const DOMAIN_RESOURCE_TYPE: Record<string, string> = {
  benefits: "benefit",
  documents: "document",
  events: "event",
  jobs: "job",
  news: "news",
  pages: "page",
  shop: "product",
};

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRecordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resultDataId(result: unknown): string | null {
  const record = getRecordValue(result);
  return getStringValue(record.data);
}

function canPublishForCampus(
  ctx: UserAuthContext,
  campusId: string | null
): boolean {
  if (ctx.roles.includes("globaladmin")) {
    return true;
  }
  return Boolean(campusId && ctx.managedCampusIds.includes(campusId));
}

function approvalRequiredResult(input: {
  domain: string;
  id: string;
  payload: Record<string, unknown>;
}) {
  return {
    action: `${input.domain}.publish`,
    error: "Publish requires campus or global admin approval",
    payload: { domain: input.domain, id: input.id },
    requiresApproval: true,
    resourceId: input.id,
    resourceType: DOMAIN_RESOURCE_TYPE[input.domain] ?? input.domain,
    sourcePayload: input.payload,
  };
}

interface AssistantCreateContentInput {
  campusId?: string;
  departmentId?: string;
  domain: string;
  payload: Record<string, unknown>;
  publish?: boolean;
}

interface AssistantCreateContentContext extends AssistantCreateContentInput {
  createDraftForApproval: boolean;
  status: "draft" | "published";
}

function toCreateContentContext(
  input: unknown,
  ctx: UserAuthContext
): AssistantCreateContentContext {
  const parsed = input as AssistantCreateContentInput;
  const payloadCampusId =
    parsed.campusId ??
    getStringValue(parsed.payload.campus_id) ??
    getStringValue(parsed.payload.campusId);
  const createDraftForApproval =
    Boolean(parsed.publish) && !canPublishForCampus(ctx, payloadCampusId);

  return {
    ...parsed,
    createDraftForApproval,
    status: parsed.publish && !createDraftForApproval ? "published" : "draft",
  };
}

function approvalRequiredForCreatedContent(
  context: AssistantCreateContentContext,
  result: unknown
) {
  const id = resultDataId(result);
  if (!(context.createDraftForApproval && id)) {
    return null;
  }
  return approvalRequiredResult({
    domain: context.domain,
    id,
    payload: context.payload,
  });
}

function hasActionError(result: unknown): boolean {
  return "error" in getRecordValue(result);
}

async function publishCreatedContent(
  context: AssistantCreateContentContext,
  result: unknown
) {
  if (!(context.publish && !context.createDraftForApproval)) {
    return;
  }
  const id = resultDataId(result);
  if (!id || hasActionError(result)) {
    return;
  }
  if (context.domain === "events") {
    await publishEvent(id);
    return;
  }
  const table = DOMAIN_PUBLISH_TABLE[context.domain];
  if (!table) {
    return;
  }
  const { db } = await createSessionClient();
  await db.updateRow("app", table, id, { status: "published" });
}

async function createAssistantContent(
  input: unknown,
  ctx: UserAuthContext
): Promise<unknown> {
  const context = toCreateContentContext(input, ctx);
  let result: unknown;

  switch (context.domain) {
    case "jobs":
      result = await createJobContent(
        context.payload,
        context.status,
        context.campusId,
        context.departmentId
      );
      break;
    case "events":
      result = await createEvent({ ...context.payload } as never);
      break;
    case "news":
      result = await createNews({ ...context.payload } as never);
      break;
    case "shop":
      result = await createProduct({ ...context.payload } as never);
      break;
    case "benefits":
      result = await createBenefit({ ...context.payload } as never);
      break;
    default:
      throw new Error(`Create not supported for domain: ${context.domain}`);
  }

  const approval = approvalRequiredForCreatedContent(context, result);
  if (approval) {
    return approval;
  }
  await publishCreatedContent(context, result);
  return result;
}

async function createJobContent(
  payload: Record<string, unknown>,
  status: string,
  campusId?: string,
  departmentId?: string
) {
  let campus: number | undefined;
  if (campusId) {
    campus = Number.parseInt(campusId, 10);
  } else if (typeof payload.campus === "number") {
    campus = payload.campus;
  }
  return await createJob({
    title_no: String(payload.title_no ?? ""),
    title_en: String(payload.title_en ?? ""),
    description_no: String(payload.description_no ?? ""),
    description_en: String(payload.description_en ?? ""),
    slug: String(payload.slug ?? payload.slugSuggestion ?? ""),
    status: status as "draft" | "published",
    campus_id: campusId ?? String(payload.campus_id ?? ""),
    campus,
    department_id: departmentId ?? (payload.department_id as string) ?? null,
    department: departmentId ?? (payload.department as string) ?? null,
    application_deadline: (payload.application_deadline as string) ?? null,
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
  } as never);
}

const MAX_ORDER_RESULTS = 10;
const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DEFAULT_RANGE_DAYS = 30;
const CUSTOMER_RESULT_LIMIT = 5;
const TOP_PAGES_LIMIT = 5;
const MIN_CUSTOMER_QUERY_LENGTH = 2;

function toOrderSummary(order: Orders) {
  return {
    buyerEmail: order.buyer_email ?? null,
    buyerName: order.buyer_name ?? null,
    campusId: order.campus_id ?? null,
    createdAt: order.$createdAt,
    currency: order.currency ?? "NOK",
    id: order.$id,
    paymentProvider: order.payment_provider ?? null,
    status: order.status ?? null,
    total: order.total,
  };
}

function buildDeps(
  _activeFormSchemaId: string | undefined,
  ctx: UserAuthContext
): AssistantActionDeps {
  return {
    // -------------------------------------------------------------------------
    // READ
    // -------------------------------------------------------------------------
    searchContent: async (input) => {
      const { domain, query, status } = input as {
        domain: string;
        query?: string;
        status?: string;
      };
      switch (domain) {
        case "jobs":
          return await listJobs({ status, search: query });
        case "events":
          return await listEvents({ status, search: query });
        case "news":
          return await listNews({ status });
        case "pages":
          return await listPages({ status });
        case "shop":
          return await listProducts({ status });
        case "benefits":
          return await listBenefits({ status });
        case "documents":
          return await listDocuments({ status });
        default:
          return { rows: [], total: 0 };
      }
    },

    getContent: async (input) => {
      const { domain, id } = input as { domain: string; id: string };
      switch (domain) {
        case "jobs":
          return await getJob(id);
        case "events":
          return await getEvent(id);
        case "news":
          return await getNewsArticle(id);
        case "pages":
          return await getPageById(id);
        case "shop":
          return await getProduct(id);
        case "benefits":
          return await getBenefit(id);
        case "documents":
          return await getDocument(id);
        default:
          throw new Error(`Unknown domain: ${domain}`);
      }
    },

    getDashboardStats: async () => {
      return await getDashboardStats();
    },

    listPendingApprovals: async () => {
      const result = await listPendingApprovals();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result.data;
    },

    // -------------------------------------------------------------------------
    // WRITE — create (complexity extracted to createJobContent helper)
    // -------------------------------------------------------------------------
    createContent: async (input) => await createAssistantContent(input, ctx),

    // -------------------------------------------------------------------------
    // WRITE — update
    // -------------------------------------------------------------------------
    updateContent: async (input) => {
      const { domain, id, payload } = input as {
        domain: string;
        id: string;
        payload: Record<string, unknown>;
      };
      switch (domain) {
        case "jobs":
          return await updateJob(id, payload as never);
        case "events":
          return await updateEvent(id, payload as never);
        case "news":
          return await updateNews(id, payload as never);
        case "shop":
          return await updateProduct(id, payload as never);
        case "benefits":
          return await updateBenefit(id, payload as never);
        default:
          throw new Error(`Update not supported for domain: ${domain}`);
      }
    },

    // -------------------------------------------------------------------------
    // WRITE — publish
    // -------------------------------------------------------------------------
    publishContent: async (input) => {
      const { domain, id } = input as { domain: string; id: string };
      if (domain === "events") {
        return await publishEvent(id);
      }
      // All other domains: targeted status update via session client.
      // Appwrite row-level security enforces the user's write permissions.
      const table = DOMAIN_PUBLISH_TABLE[domain];
      if (!table) {
        throw new Error(`Publish not supported for domain: ${domain}`);
      }
      const { db } = await createSessionClient();
      const row = await db.getRow<GenericRow>("app", table, id);
      assertPublishAccess(ctx, getStringValue(row.campus_id));
      await db.updateRow("app", table, id, { status: "published" });
      return { data: id };
    },

    // -------------------------------------------------------------------------
    // WRITE — delete
    // -------------------------------------------------------------------------
    deleteContent: async (input) => {
      const { domain, id } = input as { domain: string; id: string };
      switch (domain) {
        case "jobs":
          return await deleteJob(id);
        case "events":
          return await deleteEvent(id);
        case "news":
          return await deleteNews(id);
        case "shop":
          return await deleteProduct(id);
        case "documents":
          return await deleteDocument(id);
        default:
          throw new Error(`Delete not supported for domain: ${domain}`);
      }
    },

    // -------------------------------------------------------------------------
    // M365
    // -------------------------------------------------------------------------
    searchM365Users: async (input) => {
      const { query, limit } = input as { limit?: number; query: string };
      return await searchM365Users({ query, limit });
    },

    createM365User: async (input) => {
      const i = input as {
        campus: string;
        department: string;
        firstName: string;
        jobTitle?: string;
        lastName: string;
        manager?: string;
        upnPrefix: string;
      };
      return await createM365User({
        firstName: i.firstName,
        lastName: i.lastName,
        upnPrefix: i.upnPrefix,
        campus: i.campus,
        department: i.department,
        jobTitle: i.jobTitle,
        manager: i.manager,
      } as never);
    },

    getM365UserProfile: async (input) => {
      const { userId } = input as { userId: string };
      return await searchM365Users({ query: userId, limit: 1 });
    },

    // -------------------------------------------------------------------------
    // Settings / feature flags
    // -------------------------------------------------------------------------
    getFeatureFlags: async () => {
      const { db } = await createSessionClient();
      const result = await db.listRows<
        Models.Row & { key: string; enabled: boolean }
      >("app", "feature_flags", [Query.limit(200)]);
      const states = mergeFlagStates(
        result.rows.map((row) => ({ key: row.key, enabled: row.enabled }))
      );
      // The code catalog is the source of truth for which flags exist.
      return FEATURE_FLAGS.map((flag) => ({
        key: flag.key,
        title: flag.title,
        group: flag.group,
        enabled: states[flag.key],
      }));
    },

    toggleFeatureFlag: async (input) => {
      const { flagKey, enabled } = input as {
        enabled: boolean;
        flagKey: string;
      };
      const def = getFlagDef(flagKey);
      if (!def) {
        throw new Error(`Unknown feature flag: ${flagKey}`);
      }
      const { db } = await createSessionClient();
      const result = await db.listRows<Models.Row>("app", "feature_flags", [
        Query.equal("key", [flagKey]),
        Query.limit(1),
      ]);
      const existing = result.rows[0];
      if (existing) {
        await db.updateRow("app", "feature_flags", existing.$id, { enabled });
      } else {
        // Upsert: catalog flags may not have a row until first toggled.
        await db.createRow("app", "feature_flags", ID.unique(), {
          key: flagKey,
          title: def.title,
          description: null,
          enabled,
        });
      }
      return { flagKey, enabled };
    },

    // -------------------------------------------------------------------------
    // Approvals
    // -------------------------------------------------------------------------
    approveRequest: async (input) => {
      const { requestId } = input as { requestId: string };
      return await approveRequest(requestId);
    },

    rejectRequest: async (input) => {
      const { reason, requestId } = input as {
        reason: string;
        requestId: string;
      };
      return await rejectRequest(requestId, reason);
    },

    // -------------------------------------------------------------------------
    // Shop orders & customers
    // -------------------------------------------------------------------------
    searchOrders: async (input) => {
      const { query, status } = (input ?? {}) as {
        query?: string;
        status?: string;
      };
      const { db } = await createSessionClient();
      const result = await db.listRows<Orders>(
        "app",
        "orders",
        buildAssistantOrderSearchQueries(ctx, {
          limit: MAX_ORDER_RESULTS,
          query,
          status,
        })
      );
      return result.rows.map(toOrderSummary);
    },

    getOrderSummary: async (input) => {
      const { orderId } = (input ?? {}) as { orderId?: string };
      if (!orderId) {
        throw new Error("orderId is required");
      }
      // Session client — row security limits access to permitted orders.
      const { db } = await createSessionClient();
      const order = await db.getRow<Orders>("app", "orders", orderId, [
        ORDER_ITEMS_SELECT,
      ]);
      return {
        ...toOrderSummary(order),
        items: getOrderItems(order),
      };
    },

    lookupCustomer: async (input) => {
      if (!ctx.roles.includes("globaladmin")) {
        throw new Error("Forbidden: customer lookup is global-admin only");
      }
      const { query } = (input ?? {}) as { query?: string };
      const q = query?.trim();
      if (!q || q.length < MIN_CUSTOMER_QUERY_LENGTH) {
        throw new Error("query must be at least 2 characters");
      }
      const { db } = await createAdminClient();
      const result = await db.listRows("app", "user", [
        Query.or([Query.contains("name", q), Query.contains("email", q)]),
        Query.limit(CUSTOMER_RESULT_LIMIT),
      ]);
      return result.rows.map((row) => ({
        campusId: (row as { campus_id?: string }).campus_id ?? null,
        email: (row as { email?: string }).email ?? null,
        id: row.$id,
        membershipIds:
          (row as { membership_ids?: string[] }).membership_ids ?? [],
        name: (row as { name?: string }).name ?? null,
        studentId: (row as { student_id?: unknown }).student_id ?? null,
      }));
    },

    // -------------------------------------------------------------------------
    // Ops health & inbox
    // -------------------------------------------------------------------------
    getOpsHealth: async () => {
      if (!ctx.roles.includes("globaladmin")) {
        throw new Error("Forbidden: ops health is global-admin only");
      }
      const teams = await fetchRequiredTeamHealth();
      // Presence only — secret values never leave the server.
      const integrations = checkIntegrationHealth((key) =>
        Boolean(process.env[key]?.trim())
      );
      return { integrations, teams };
    },

    getInboxCounts: async () => await getInboxCountsAction(),

    // -------------------------------------------------------------------------
    // Analytics (Umami)
    // -------------------------------------------------------------------------
    getAnalyticsSummary: async (input) => {
      if (!ctx.roles.includes("globaladmin")) {
        throw new Error("Forbidden: analytics is global-admin only");
      }
      const { range } = (input ?? {}) as { range?: string };
      const days = RANGE_DAYS[range ?? "30d"] ?? DEFAULT_RANGE_DAYS;
      const endAt = Date.now();
      const umamiRange = { endAt, startAt: endAt - days * DAY_MS };
      const [stats, topPages, eventsTotal] = await Promise.all([
        fetchStats(umamiRange),
        fetchTopMetrics(umamiRange, "path", TOP_PAGES_LIMIT),
        fetchEventsTotal(umamiRange),
      ]);
      if (!stats) {
        return {
          configured: false,
          message: "Analytics (Umami) is not configured or unreachable.",
        };
      }
      return { configured: true, days, eventsTotal, stats, topPages };
    },
  };
}
