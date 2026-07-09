import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";

interface AssistantOrderSearchOptions {
  limit: number;
  query?: string;
  status?: string;
}

export function buildAssistantOrderSearchQueries(
  ctx: UserAuthContext,
  options: AssistantOrderSearchOptions
): string[] {
  const queries = [
    Query.orderDesc("$createdAt"),
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];
  const status = options.status?.trim();
  if (status && status !== "all") {
    queries.push(Query.equal("status", status));
  }

  const q = options.query?.trim();
  if (q) {
    queries.push(
      Query.or([
        Query.contains("buyer_name", q),
        Query.contains("buyer_email", q),
        Query.equal("$id", q),
      ])
    );
  }

  queries.push(Query.limit(options.limit));
  return queries;
}
