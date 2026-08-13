import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { listPublicNews, type PublicLocale } from "@/lib/public-content";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => ({}));
    const {
      campusId,
      per_page = DEFAULT_PER_PAGE,
      page = 1,
      search,
      locale = "no",
    } = body as {
      campusId?: string;
      per_page?: number;
      page?: number;
      search?: string;
      locale?: string;
    };

    const perPage = Math.min(Math.max(1, Number(per_page) || 1), MAX_PER_PAGE);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLocale: PublicLocale = locale === "en" ? "en" : "no";

    const { items, total } = await listPublicNews({
      campusId: campusId ? String(campusId) : undefined,
      perPage,
      page: safePage,
      search,
      locale: safeLocale,
    });

    return applyCorsHeaders(
      NextResponse.json({
        news: items,
        total_news: total,
        page: safePage,
        per_page: perPage,
        source: "biso",
      }),
      origin
    );
  } catch (err) {
    console.error("[news] Unexpected error:", err);
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      ),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
