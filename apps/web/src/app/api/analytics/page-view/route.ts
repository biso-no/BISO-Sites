import { NextResponse } from "next/server";

// Analytics ingestion is disabled until a proper analytics service is wired
// up. The previous implementation accepted unauthenticated, unrate-limited
// POSTs that recorded visitor IPs alongside user IDs — a GDPR exposure and
// a free DB-write amplification target. Return 204 so existing callers
// don't error.
export function POST() {
  return new NextResponse(null, { status: 204 });
}
