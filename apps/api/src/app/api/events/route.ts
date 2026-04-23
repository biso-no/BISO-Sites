import { type NextRequest, NextResponse } from "next/server";

const WP_EVENTS_URL = "https://biso.no/wp-json/biso/v1/events";
const TIMEOUT_MS = 10_000;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { campusId, per_page = 20, page = 1, include_past = false, search } =
      body as {
        campusId?: string;
        per_page?: number;
        page?: number;
        include_past?: boolean;
        search?: string;
      };

    const url = new URL(WP_EVENTS_URL);
    if (campusId) url.searchParams.set("campus_id", String(campusId));
    url.searchParams.set("per_page", String(per_page));
    url.searchParams.set("page", String(page));
    url.searchParams.set("include_past", include_past ? "true" : "false");
    if (search) url.searchParams.set("search", search);

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "BisoApp/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WordPress error: ${response.status}`, code: "UPSTREAM_ERROR" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const events = Array.isArray(data) ? data : (data.events ?? []);
    const totalEvents =
      Number.parseInt(response.headers.get("x-wp-total") ?? "", 10) ||
      (data.total_events as number | undefined) ||
      events.length;

    return NextResponse.json({ events, total_events: totalEvents });
  } catch (err) {
    const error = err as { name?: string };
    if (error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out", code: "TIMEOUT" },
        { status: 502 }
      );
    }
    console.error("[events] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
