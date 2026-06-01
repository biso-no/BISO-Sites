const PUBLISH_ACTIONS = {
  benefits: {
    paths: ["/benefits"],
    table: "campus_benefits",
  },
  documents: {
    paths: ["/documents"],
    table: "documents",
  },
  events: {
    paths: ["/events"],
    table: "events",
  },
  jobs: {
    paths: ["/jobs", "/"],
    table: "jobs",
  },
  news: {
    paths: ["/news"],
    table: "news",
  },
  shop: {
    paths: ["/shop"],
    table: "webshop_products",
  },
} as const;

type PublishDomain = keyof typeof PUBLISH_ACTIONS;

export interface ApprovalExecutionInput {
  action: string;
  payload: string;
  resource_id: string | null;
}

export interface ApprovalPublishPlan {
  action: string;
  domain: PublishDomain;
  paths: string[];
  resourceId: string;
  table: string;
}

export function buildApprovalPublishPlan(
  request: ApprovalExecutionInput
): ApprovalPublishPlan {
  const payload = parseApprovalPayload(request.payload);
  const [domain, operation] = request.action.split(".");

  if (operation !== "publish" || !isPublishDomain(domain)) {
    throw new Error(`Unsupported approval action: ${request.action}`);
  }

  const resourceId =
    request.resource_id ??
    getString(payload.id) ??
    getString(payload.resourceId) ??
    getString(payload.$id);

  if (!resourceId) {
    throw new Error(`Approval action ${request.action} requires a resource ID`);
  }

  const config = PUBLISH_ACTIONS[domain];
  return {
    action: request.action,
    domain,
    paths: [...config.paths],
    resourceId,
    table: config.table,
  };
}

function parseApprovalPayload(payload: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch (_error) {
    throw new Error("Approval request payload is not valid JSON");
  }
  throw new Error("Approval request payload must be a JSON object");
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isPublishDomain(value: string | undefined): value is PublishDomain {
  return Boolean(value && value in PUBLISH_ACTIONS);
}
