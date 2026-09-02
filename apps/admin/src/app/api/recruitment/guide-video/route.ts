import { getSessionSecret } from "@repo/api/server";
import { getStorageFileUrl } from "@repo/api/storage";
import { NextResponse } from "next/server";
import {
  RECRUITMENT_GUIDE_BUCKET_ID,
  RECRUITMENT_GUIDE_FILE_ID,
} from "@/components/tours/recruitment-guide-video";
import { requireApiAuth } from "@/lib/api-auth";

/**
 * Streams the recruitment walkthrough video from Appwrite Storage.
 *
 * The browser cannot load the Appwrite URL directly: the file is team-scoped,
 * and this app keeps the Appwrite session secret in its own server-side cookie
 * rather than one Appwrite would receive, so a `<video src>` pointing straight
 * at Storage arrives as a guest and gets a 401 JSON body (which the player
 * reports as an unsupported format). Proxying here re-attaches the caller's own
 * session, so Appwrite still enforces the file's permissions — this route grants
 * nothing the user could not already read.
 *
 * `Range` is forwarded and the upstream status/headers are passed through, so
 * seeking works and Safari (which always range-requests media) can play it.
 */

/** Response headers worth passing straight through to the player. */
const FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
] as const;

export async function GET(request: Request): Promise<Response> {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const secret = await getSessionSecret();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(
    getStorageFileUrl(RECRUITMENT_GUIDE_BUCKET_ID, RECRUITMENT_GUIDE_FILE_ID),
    {
      headers: {
        "X-Appwrite-Session": secret,
        ...(range ? { Range: range } : {}),
      },
      // Appwrite streams the bytes; never let Next try to cache a video body.
      cache: "no-store",
    }
  );

  if (!(upstream.ok || upstream.status === 206)) {
    return NextResponse.json(
      { error: "Guide video unavailable" },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  // Appwrite honours ranges but only advertises it on 206 responses; say so
  // unconditionally so players keep seeking after a rangeless first request.
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
