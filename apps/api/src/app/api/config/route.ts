import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { NextResponse } from "next/server";
import { readAppVersions } from "@/lib/app-versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AppConfigFile {
  content: Record<string, string>;
  features: Record<string, boolean>;
}

const FALLBACK_CONFIG: AppConfigFile = {
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
};

function readStaticConfig(): AppConfigFile {
  try {
    const configPath = join(process.cwd(), "config", "app-config.json");
    return JSON.parse(readFileSync(configPath, "utf-8")) as AppConfigFile;
  } catch {
    return FALLBACK_CONFIG;
  }
}

/**
 * The student app's remote config.
 *
 * `features.expenses` follows the admin's `expenses_module` switch — the same
 * flag the expense routes enforce — so the app offers reimbursements exactly
 * when the server will accept them. `versions` carries the per-platform
 * minimum and recommended app versions the app uses to nudge outdated installs.
 */
export async function GET() {
  const config = readStaticConfig();
  const [expenses, versions] = await Promise.all([
    isFeatureEnabled("expenses_module"),
    readAppVersions(),
  ]);

  return NextResponse.json(
    { ...config, features: { ...config.features, expenses }, versions },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=15" } }
  );
}
