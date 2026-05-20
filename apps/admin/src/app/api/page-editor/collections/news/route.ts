import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";

function titleFromRefs(refs: unknown): string {
  if (!Array.isArray(refs) || refs.length === 0) {
    return "";
  }
  const r = refs as Record<string, unknown>[];
  const en = r.find((t) => t.locale === "en");
  return String((en ?? r[0]).title ?? "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dept = searchParams.get("dept");

  if (!dept) {
    return Response.json({ error: "Missing dept" }, { status: 400 });
  }

  try {
    const { db } = await createAdminClient();

    const result = await db.listRows("app", "news", [
      Query.equal("department_id", dept),
      Query.equal("status", "published"),
      Query.limit(6),
      Query.orderDesc("$createdAt"),
    ]);

    const items = (result.rows ?? []).map((r: Record<string, unknown>) => {
      const rawDate = String(r.$createdAt ?? "");
      let publishedAt = "";
      if (rawDate) {
        try {
          publishedAt = new Date(rawDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          publishedAt = rawDate;
        }
      }
      return {
        title:
          titleFromRefs(r.translation_refs) || String(r.title ?? r.name ?? ""),
        department: dept,
        publishedAt,
        summary: "",
      };
    });

    return Response.json(items);
  } catch (e) {
    console.error("[GET /api/page-editor/collections/news]", e);
    return Response.json([], { status: 200 });
  }
}
