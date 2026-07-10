"use server";

import { cookies } from "next/headers";
import { getUserAuthContext } from "@/lib/authorization";

/**
 * Hand the Appwrite session secret to the browser so the realtime WebSocket
 * can authenticate (the admin cookie is httpOnly with a custom name, so the
 * SDK cannot pick it up itself — spec §2).
 *
 * The secret already lives in the caller's own browser cookie; this only
 * makes it visible to first-party JS, behind the same auth gate. Never log
 * the returned value.
 */
export async function getRealtimeSessionSecret(): Promise<string | null> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return null;
  }
  const cookieStore = await cookies();
  const cookieName =
    process.env.APPWRITE_SESSION_COOKIE || "a_session_biso_admin";
  return cookieStore.get(cookieName)?.value ?? null;
}
