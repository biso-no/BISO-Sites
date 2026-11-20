import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { after, NextResponse } from "next/server";

/**
 * Runtime probe for `after()`. The expense AI check runs in `after()`; its
 * slowest run needs about 240 s (agent, fixed steps and notify), so before
 * relying on it the owner raises the api site's function timeout and runs
 * this once to see that a background task really lives that long on the host.
 *
 * `POST` with `Authorization: Bearer ${CRON_SECRET}`. It answers at once,
 * logs `[after-probe] alive <seconds>` every 15 s up to 285, and
 * `[after-probe] done at 290 s` at the end. If the host cuts the task short,
 * the last `alive` line shows where.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const TICK_SECONDS = 15;
/** Past the slowest check (about 240 s), within the route's 300 s. */
const TOTAL_SECONDS = 290;
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
  let elapsed = 0;
  for (; elapsed + TICK_SECONDS <= TOTAL_SECONDS; elapsed += TICK_SECONDS) {
    await sleep(TICK_SECONDS * MS_PER_SECOND);
    console.log(`[after-probe] alive ${elapsed + TICK_SECONDS}`);
  }
  // The last few seconds, short of a whole tick.
  await sleep((TOTAL_SECONDS - elapsed) * MS_PER_SECOND);
  console.log(`[after-probe] done at ${TOTAL_SECONDS} s`);
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
