import type { NextRequest } from "next/server";
import { corsPreflightResponse } from "@/lib/cors";
import { notificationStateRoute } from "@/lib/notification-state-route";

export const dynamic = "force-dynamic";

/**
 * Clears the announcements in the body from the signed-in student's inbox,
 * which also counts them as read. Clearing is permanent.
 */
export const POST = notificationStateRoute("clear");

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
