import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7);
}

export function hasValidCronSecret(request: NextRequest, secret: string) {
  // Header-only: avoid the secret landing in access logs / referrers.
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];

  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

async function handleCleanup(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: "SECRET_NOT_CONFIGURED", error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { users } = await createAdminClient();

  const todaysDate = new Date();
  todaysDate.setHours(0, 0, 0, 0);

  const twoWeeksAgo = new Date(todaysDate.getTime() - 14 * 24 * 60 * 60 * 1000);

  const anonUsers = await users.list({
    queries: [
      Query.equal("emailVerification", false),
      Query.isNull("email"),
      Query.updatedBefore(twoWeeksAgo.toISOString()),
      Query.limit(5000),
    ],
  });

  const deletedUsers = await Promise.all(
    anonUsers.users.map((user) => users.delete(user.$id))
  );

  if (deletedUsers.length > 0) {
    console.info(`Deleted ${deletedUsers.length} anonymous users`);
  }
  return NextResponse.json({
    deletedCount: deletedUsers.length,
    ok: true,
  });
}

export function GET(request: NextRequest) {
  return handleCleanup(request);
}

export function POST(request: NextRequest) {
  return handleCleanup(request);
}
