import { type NextRequest, NextResponse } from "next/server";
import { readAppConfig } from "@/lib/app-config";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import type { PublicLocale } from "@/lib/public-content";
import { listPublicJobs } from "@/lib/public-jobs";
import { fetchWordPressJobs } from "@/lib/wordpress-proxy";

export const runtime = "nodejs";

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => ({}));
    const {
      campusId,
      per_page = DEFAULT_PER_PAGE,
      page = 1,
      includeExpired = false,
      departmentId,
      verv,
      search,
      locale = "no",
    } = body as {
      campusId?: string;
      per_page?: number;
      page?: number;
      includeExpired?: boolean;
      departmentId?: string;
      verv?: string;
      search?: string;
      locale?: string;
    };

    if (readAppConfig().content.jobs_source === "wordpress") {
      const wordPressResponse = await fetchWordPressJobs({
        campusId,
        per_page,
        page,
        includeExpired,
        departmentId,
        verv,
      });
      return applyCorsHeaders(wordPressResponse, origin);
    }

    const perPage = Math.min(Math.max(1, Number(per_page) || 1), MAX_PER_PAGE);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLocale: PublicLocale = locale === "en" ? "en" : "no";

    const { items, total } = await listPublicJobs({
      campusId: campusId ? String(campusId) : undefined,
      departmentId: departmentId ? String(departmentId) : undefined,
      perPage,
      page: safePage,
      includeExpired: Boolean(includeExpired),
      search,
      locale: safeLocale,
    });

    return applyCorsHeaders(
      NextResponse.json({
        jobs: items,
        total_jobs: total,
        page: safePage,
        per_page: perPage,
        source: "biso",
      }),
      origin
    );
  } catch (err) {
    console.error("[jobs] Unexpected error:", err);
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
