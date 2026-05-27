"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";

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

  const queries = [
    Query.orderDesc("$createdAt"),
    Query.limit(500),
    Query.notEqual("status", "archived"),
  ];

  if (
    ctx.roles.includes("campusadmin") &&
    !ctx.roles.includes("globaladmin") &&
    ctx.activeCampusId
  ) {
    queries.push(Query.equal("campus_id", ctx.activeCampusId));
  }

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

  const queries = [
    Query.equal("topic", opts.topic),
    Query.orderDesc("$createdAt"),
    Query.limit(opts.limit ?? 50),
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
): Promise<void> {
  const ctx = await requireAuth();
  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    throw new Error("Unauthorized");
  }

  const { db } = await createSessionClient();
  await db.updateRow("app", "form_submissions", id, { status });
  revalidatePath(`/submissions/${topic}`);
}

export async function deleteSubmission(
  id: string,
  topic: string
): Promise<void> {
  const ctx = await requireAuth();
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Unauthorized");
  }

  const { db } = await createSessionClient();
  await db.deleteRow("app", "form_submissions", id);
  revalidatePath(`/submissions/${topic}`);
}
