import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isProd } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Cache-refresh endpoint called server-to-server by the admin app after an
 * editor saves benefits, partners or site logos. Same auth rules as
 * `/api/cron/cleanup-reservations`: `CRON_SECRET` via `x-cron-secret` or
 * `Authorization: Bearer`; production refuses to run without the secret.
 */
const ALLOWED_TAGS = new Set(["benefits", "membership-texts", "partners"]);

function isAuthorized(request: Request, cronSecret: string): boolean {
  const headerSecret = request.headers.get("x-cron-secret");
  if (safeSecretCompare(headerSecret, cronSecret)) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return safeSecretCompare(bearer, cronSecret);
}

async function parseTags(request: Request): Promise<string[] | null> {
  const body = (await request.json().catch(() => null)) as {
    tags?: unknown;
  } | null;
  const tags = body?.tags;
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    !tags.every((tag) => typeof tag === "string" && ALLOWED_TAGS.has(tag))
  ) {
    return null;
  }
  return tags as string[];
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (isProd && !cronSecret) {
    console.error("CRON_SECRET is not configured in production");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (cronSecret && !isAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await parseTags(request);
  if (!tags) {
    return NextResponse.json({ error: "invalid_tags" }, { status: 400 });
  }

  for (const tag of tags) {
    // `{ expire: 0 }` is the documented immediate-expiry form for route
    // handlers called by external systems.
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json(
    { revalidated: tags },
    { headers: { "Cache-Control": "no-store" } }
  );
}
