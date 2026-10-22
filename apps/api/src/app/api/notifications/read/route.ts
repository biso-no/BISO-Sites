import type { NextRequest } from "next/server";
import { corsPreflightResponse } from "@/lib/cors";
import { notificationStateRoute } from "@/lib/notification-state-route";

export const dynamic = "force-dynamic";

/** Saves the announcements in the body as read for the signed-in student. */
export const POST = notificationStateRoute("read");

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
