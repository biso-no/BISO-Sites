import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { requireApiAuth } from "@/lib/api-auth";

function titleFromRefs(refs: unknown): string {
  if (!Array.isArray(refs) || refs.length === 0) {
    return "";
  }
  const r = refs as Record<string, unknown>[];
  const en = r.find((t) => t.locale === "en");
  return String((en ?? r[0]).title ?? "");
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const dept = searchParams.get("dept");

  if (!dept) {
    return Response.json({ error: "Missing dept" }, { status: 400 });
  }

  try {
    const { db } = await createAdminClient();

    const result = await db.listRows("app", "jobs", [
      Query.equal("department_id", dept),
      Query.equal("status", "published"),
      Query.limit(8),
      Query.orderDesc("$createdAt"),
    ]);

    const items = (result.rows ?? []).map((r: Record<string, unknown>) => {
      const meta = parseMeta(r.metadata);
      return {
        title: titleFromRefs(r.translations) || String(r.title ?? r.name ?? ""),
        department: dept,
        deadline: String(meta.deadline ?? r.deadline ?? ""),
        commitment: String(meta.commitment ?? r.commitment ?? ""),
      };
    });

    return Response.json(items);
  } catch (e) {
    console.error("[GET /api/page-editor/collections/jobs]", e);
    return Response.json([], { status: 200 });
  }
}
