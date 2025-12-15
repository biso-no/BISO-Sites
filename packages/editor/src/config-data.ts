/**
 * Server-compatible config data export
 * This file re-exports the config without "use client" directive
 * so it can be imported in server contexts like API routes
 */

// Import the actual config (which has "use client")
// But we'll only use it to extract the data structure
import type { Config } from "@measured/puck";

// Re-export a function that returns the config
// This works around the "use client" limitation
export async function getConfigData(): Promise<Config<any, any, any>> {
  // Dynamic import to avoid "use client" issues
  const { default: config } = await import("./config");
  return config;
}
