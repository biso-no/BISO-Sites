import { type NextRequest, NextResponse } from "next/server";
import { getPublicBenefitsForCampus } from "@/lib/benefits/public-benefits";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

export const dynamic = "force-dynamic";

function json(body: unknown, origin: string | null, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/**
 * The benefits the website lists, for the app. Anonymous read of published,
 * currently visible rows; codes are never part of the list. A missing or
 * invalid `campus` means national benefits only.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const campus = new URL(req.url).searchParams.get("campus");
  try {
    const benefits = await getPublicBenefitsForCampus(campus, new Date());
    return json({ benefits }, origin);
  } catch (error) {
    console.error("[Benefits] List failed:", errorSummary(error));
    return json({ error: "unavailable" }, origin, 503);
  }
}

function errorSummary(error: unknown): string {
  const { code, message } = (error ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  return `${String(code ?? "")} ${String(message ?? "")}`.trim();
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
