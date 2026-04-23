import { type NextRequest, NextResponse } from "next/server";

const WC_BASE_URL = "https://biso.no/wp-json/wc/v3/products";
const TIMEOUT_MS = 10_000;

const campusToTagSlug: Record<string, string> = {
  oslo: "oslo",
  bergen: "bergen",
  trondheim: "trondheim",
  stavanger: "stavanger",
  national: "national",
};

function getTagSlug(campus: string): string {
  return campusToTagSlug[campus.toLowerCase()] ?? campus.toLowerCase();
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;

  if (!key || !secret) {
    return NextResponse.json(
      { error: "WooCommerce credentials not configured", code: "MISSING_CREDENTIALS" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { campus, perPage = 20, page = 1 } = body as {
      campus?: string;
      departmentId?: string;
      perPage?: number;
      page?: number;
    };

    const url = new URL(WC_BASE_URL);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("status", "publish");
    if (campus) url.searchParams.set("tag", getTagSlug(campus));

    const credentials = Buffer.from(`${key}:${secret}`).toString("base64");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "BisoApp/1.0",
        Authorization: `Basic ${credentials}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WooCommerce error: ${response.status}`, code: "UPSTREAM_ERROR" },
        { status: 502 }
      );
    }

    const products = await response.json();
    const totalProducts =
      Number.parseInt(response.headers.get("x-wp-total") ?? "", 10) ||
      (Array.isArray(products) ? products.length : 0);

    return NextResponse.json({ products, total_products: totalProducts });
  } catch (err) {
    const error = err as { name?: string };
    if (error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out", code: "TIMEOUT" },
        { status: 502 }
      );
    }
    console.error("[wc-products] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
