import { readinessResponse } from "@repo/api/server";

export const dynamic = "force-dynamic";

/** Readiness: Appwrite answers the admin client within 3 seconds. */
export function GET() {
  return readinessResponse();
}
