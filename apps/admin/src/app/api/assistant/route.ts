import "server-only";
import {
  buildAssistantCapabilities,
  buildAssistantSystemPrompt,
  buildAssistantTools,
  chatModel,
} from "@repo/ai/assistant";
import type { AssistantActionDeps } from "@repo/ai/assistant/types";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { UIMessage } from "ai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { NextRequest } from "next/server";
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
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";

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

  // 2. Locale
  const locale = await getLocale();

  // 3. Parse body
  const body = (await request.json()) as AssistantRequestBody;
  const { messages, currentPath = "/", activeFormSchemaId } = body;

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
  const deps = buildDeps(activeFormSchemaId);

  // 7. Build permission-gated tool set
  const tools = buildAssistantTools(capabilities, deps);

  // 8. Build system prompt with full context
  const system = buildAssistantSystemPrompt({
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
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
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

function buildDeps(_activeFormSchemaId?: string): AssistantActionDeps {
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
    createContent: async (input) => {
      const { domain, payload, publish, campusId, departmentId } = input as {
        campusId?: string;
        departmentId?: string;
        domain: string;
        payload: Record<string, unknown>;
        publish?: boolean;
      };
      const status = publish ? "published" : "draft";
      switch (domain) {
        case "jobs":
          return await createJobContent(
            payload,
            status,
            campusId,
            departmentId
          );
        case "events":
          return await createEvent({ ...payload, status } as never);
        case "news":
          return await createNews({ ...payload, status } as never);
        case "shop":
          return await createProduct({ ...payload, status } as never);
        case "benefits":
          return await createBenefit({ ...payload } as never);
        default:
          throw new Error(`Create not supported for domain: ${domain}`);
      }
    },

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
      return await db.listRows("app", "feature_flags", [
        Query.orderAsc("key"),
        Query.limit(100),
      ]);
    },

    toggleFeatureFlag: async (input) => {
      const { flagKey, enabled } = input as {
        enabled: boolean;
        flagKey: string;
      };
      const { db } = await createSessionClient();
      const result = await db.listRows("app", "feature_flags", [
        Query.equal("key", [flagKey]),
        Query.limit(1),
      ]);
      const rows = (result as { rows: Array<{ $id: string }> }).rows;
      if (rows.length === 0) {
        throw new Error(`Feature flag not found: ${flagKey}`);
      }
      await db.updateRow("app", "feature_flags", rows[0].$id, { enabled });
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
  };
}
