"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export interface FormSubmission {
  $createdAt: string;
  $id: string;
  accessTeamId: string | null;
  campusId: string | null;
  dataJson: string;
  formHeading: string;
  source: string;
  status: "actioned" | "archived" | "new" | "read";
  topic: string;
}

export interface SubmissionTopic {
  campusId: string | null;
  count: number;
  formHeading: string;
  latestAt: string;
  topic: string;
  unreadCount: number;
}

function mapRow(row: Record<string, unknown>): FormSubmission {
  return {
    $id: row.$id as string,
    $createdAt: row.$createdAt as string,
    accessTeamId: (row.access_team_id as string | null) ?? null,
    campusId: (row.campus_id as string | null) ?? null,
    dataJson: (row.data_json as string) ?? "{}",
    formHeading: (row.form_heading as string) ?? (row.topic as string),
    source: (row.source as string) ?? "multiStepForm",
    status: (row.status as FormSubmission["status"]) ?? "new",
    topic: row.topic as string,
  };
}

export async function listSubmissionTopics(): Promise<SubmissionTopic[]> {
  const ctx = await requireAuth();
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return [];
  }

  const { db } = await createSessionClient();

  // Scope by campus so a campus admin only sees their own campuses'
  // submissions. applyScopeQueries returns the managed-campus filter for
  // campus admins and an empty/active-campus filter for global admins
  // (department users never reach here — the role gate above returns early).
  const queries = [
    Query.orderDesc("$createdAt"),
    Query.limit(500),
    Query.notEqual("status", "archived"),
    ...applyScopeQueries(ctx),
  ];

  const result = await db.listRows("app", "form_submissions", queries);

  // Group by topic
  const byTopic = new Map<string, SubmissionTopic>();
  for (const row of result.rows as Record<string, unknown>[]) {
    const sub = mapRow(row);
    if (!byTopic.has(sub.topic)) {
      byTopic.set(sub.topic, {
        topic: sub.topic,
        formHeading: sub.formHeading,
        campusId: sub.campusId,
        count: 0,
        unreadCount: 0,
        latestAt: sub.$createdAt,
      });
    }
    const t = byTopic.get(sub.topic)!;
    t.count++;
    if (sub.status === "new") {
      t.unreadCount++;
    }
    if (sub.$createdAt > t.latestAt) {
      t.latestAt = sub.$createdAt;
    }
  }

  return [...byTopic.values()].sort((a, b) =>
    b.latestAt.localeCompare(a.latestAt)
  );
}

export async function listSubmissions(opts: {
  limit?: number;
  offset?: number;
  status?: string;
  topic: string;
}): Promise<{ rows: FormSubmission[]; total: number }> {
  const ctx = await requireAuth();
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return { rows: [], total: 0 };
  }

  const { db } = await createSessionClient();

  // Scope by campus (same rule as listSubmissionTopics) so a campus admin
  // cannot read another campus's submissions by opening a topic directly.
  const queries = [
    Query.equal("topic", opts.topic),
    Query.orderDesc("$createdAt"),
    Query.limit(opts.limit ?? 50),
    ...applyScopeQueries(ctx),
  ];

  if (opts.offset) {
    queries.push(Query.offset(opts.offset));
  }
  if (opts.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const result = await db.listRows("app", "form_submissions", queries);

  return {
    rows: (result.rows as Record<string, unknown>[]).map(mapRow),
    total: result.total,
  };
}

export async function updateSubmissionStatus(
  id: string,
  status: FormSubmission["status"],
  topic: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAuth();
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return { error: "Unauthorized" };
  }

  try {
    const { db } = await createSessionClient();
    await db.updateRow("app", "form_submissions", id, { status });
    revalidatePath(`/submissions/${topic}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update submission",
    };
  }
}

export async function deleteSubmission(
  id: string,
  topic: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAuth();
  if (!ctx.roles.includes("globaladmin")) {
    return { error: "Unauthorized" };
  }

  try {
    const { db } = await createSessionClient();
    await db.deleteRow("app", "form_submissions", id);
    revalidatePath(`/submissions/${topic}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete submission",
    };
  }
}
