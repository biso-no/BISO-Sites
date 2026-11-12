import { errorSummary } from "@repo/api/errors";
import type { NextRequest } from "next/server";
import { getPublicBenefitsForCampus } from "@/lib/benefits/public-benefits";
import { corsPreflightResponse, noStoreJson } from "@/lib/cors";

export const dynamic = "force-dynamic";

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
    return noStoreJson({ benefits }, origin);
  } catch (error) {
    console.error("[Benefits] List failed:", errorSummary(error));
    return noStoreJson({ error: "unavailable" }, origin, 503);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
