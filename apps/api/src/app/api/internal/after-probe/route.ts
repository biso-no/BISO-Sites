import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { after, NextResponse } from "next/server";

/**
 * Runtime probe for `after()`. The expense AI check runs in `after()` and can
 * take up to two minutes, so before relying on it the owner raises the api
 * site's function timeout and runs this once to see that a background task
 * really lives that long on the host.
 *
 * `POST` with `Authorization: Bearer ${CRON_SECRET}`. It answers at once and
 * keeps logging `[after-probe] alive <seconds>` every 15 s for 180 s. If the
 * host cuts the task short, the last `alive` line shows where.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const TICK_SECONDS = 15;
const TOTAL_SECONDS = 180;
const MS_PER_SECOND = 1000;

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runProbe(): Promise<void> {
  console.log(`[after-probe] start, will run ${TOTAL_SECONDS} s`);
  for (
    let elapsed = TICK_SECONDS;
    elapsed <= TOTAL_SECONDS;
    elapsed += TICK_SECONDS
  ) {
    await sleep(TICK_SECONDS * MS_PER_SECOND);
    console.log(`[after-probe] alive ${elapsed}`);
  }
  console.log("[after-probe] done");
}

export function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[after-probe] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  after(runProbe);
  return NextResponse.json({ started: true });
}
