import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import { mapAllSettledWithConcurrency } from "@repo/shared/utils/concurrency";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const DELETE_CONCURRENCY = 20;

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

  const todaysDate = new Date();
  todaysDate.setHours(0, 0, 0, 0);

  const twoWeeksAgo = new Date(todaysDate.getTime() - TWO_WEEKS_MS);

  let totalDeleted = 0;
  let failedDeletes = 0;
  let hasMore = true;

  try {
    const { users } = await createAdminClient();

    while (hasMore) {
      const anonUsers = await users.list({
        queries: [
          Query.equal("emailVerification", false),
          Query.isNull("email"),
          Query.updatedBefore(twoWeeksAgo.toISOString()),
          Query.limit(PAGE_SIZE),
        ],
      });

      if (anonUsers.users.length === 0) {
        hasMore = false;
        break;
      }

      const deleteResults = await mapAllSettledWithConcurrency(
        anonUsers.users,
        DELETE_CONCURRENCY,
        (user) => users.delete(user.$id)
      );

      const successfulDeletes = deleteResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      totalDeleted += successfulDeletes;

      // If we deleted fewer than we fetched, some failed.
      // Break to avoid infinite loops if some rows consistently fail to delete.
      if (successfulDeletes < anonUsers.users.length) {
        failedDeletes += anonUsers.users.length - successfulDeletes;
        console.error(`Failed to delete ${failedDeletes} anonymous users.`);
        break;
      }
    }
  } catch (error) {
    console.error("Anonymous user cleanup failed:", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        deletedCount: totalDeleted,
        error: "Anonymous user cleanup failed",
        ok: false,
      },
      { status: 500 }
    );
  }

  if (totalDeleted > 0) {
    console.info(`Deleted ${totalDeleted} anonymous users`);
  }

  // Surface delete failures to the scheduler, which classifies target health
  // by response.ok — a 200 would report a failed run as a successful ping.
  const ok = failedDeletes === 0;
  return NextResponse.json(
    {
      deletedCount: totalDeleted,
      failedCount: failedDeletes,
      ok,
    },
    { status: ok ? 200 : 500 }
  );
}

export function GET(request: NextRequest) {
  return handleCleanup(request);
}

export function POST(request: NextRequest) {
  return handleCleanup(request);
}
