import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

function titleFromRefs(refs: unknown): string {
  if (!Array.isArray(refs) || refs.length === 0) return "";
  const r = refs as Array<Record<string, unknown>>;
  const en = r.find((t) => t.locale === "en");
  return String((en ?? r[0]).title ?? "");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dept = searchParams.get("dept");

  if (!dept) {
    return Response.json({ error: "Missing dept" }, { status: 400 });
  }

  try {
    const { db } = await createAdminClient();

    const result = await db.listRows("app", "events", [
      Query.limit(6),
      Query.orderAsc("start_date"),
      Query.equal("status", "published"),
      Query.equal("department_id", dept),
    ]);

    const items = (result.rows ?? []).map((r: Record<string, unknown>) => ({
      date: r.start_date ? formatDate(String(r.start_date)) : "",
      title: titleFromRefs(r.translation_refs) || String(r.title ?? r.name ?? ""),
      where: String(r.location ?? r.where ?? r.venue ?? ""),
      going: Number(r.going ?? r.attendees ?? 0),
    }));

    return Response.json(items);
  } catch (e) {
    console.error("[GET /api/page-editor/collections/events]", e);
    return Response.json([], { status: 200 });
  }
}
