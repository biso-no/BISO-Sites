import { readinessResponse } from "@repo/api/server";

/** Readiness: Appwrite answers the admin client within 3 seconds. */
export function GET() {
  return readinessResponse();
}
