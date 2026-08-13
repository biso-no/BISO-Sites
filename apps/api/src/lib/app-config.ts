import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ContentSource = "biso" | "wordpress";

export interface AppConfig {
  content: {
    events_source: ContentSource;
    jobs_source: ContentSource;
    products_source: string;
  };
  features: Record<string, boolean>;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  content: {
    events_source: "biso",
    jobs_source: "biso",
    products_source: "woocommerce",
  },
  features: {
    departures: true,
    expenses: false,
    marketplace: false,
  },
};

export function readAppConfig(): AppConfig {
  try {
    const configPath = join(process.cwd(), "config", "app-config.json");
    return JSON.parse(readFileSync(configPath, "utf-8")) as AppConfig;
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}
