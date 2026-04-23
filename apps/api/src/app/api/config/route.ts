import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  try {
    const configPath = join(process.cwd(), "config", "app-config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      {
        content: {
          events_source: "wordpress",
          jobs_source: "wordpress",
          products_source: "woocommerce",
        },
        features: {
          departures: true,
          expenses: false,
          marketplace: false,
        },
      },
      { status: 200 }
    );
  }
}
