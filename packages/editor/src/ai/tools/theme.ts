import {
  type ColourCheck,
  checkTheme,
  MIN_ACCENT_ON_DARK,
  MIN_DARK_ON_WHITE,
  normalizeHex,
  type PageTheme,
} from "@repo/shared/utils/page-theme";

export type SetThemeInput = { accent: string; dark: string } | { reset: true };

export interface ToolResult {
  message: string;
  status: "applied" | "error";
  [key: string]: unknown;
}

function badInput(message: string): ToolResult {
  return { message, status: "error" };
}

/** Rounded DOWN to one decimal so 6.99 never reads as the 7 it just missed. */
export function floorRatio(ratio: number): string {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}

function describeFailure(
  label: string,
  check: ColourCheck,
  threshold: number,
  against: string
): string {
  if (check.ratio === 0) {
    return `${label} is not a valid hex colour.`;
  }
  const hint = check.suggestion
    ? ` Nearest passing shade: ${check.suggestion}.`
    : " No shade of that hue passes.";
  return `${label} has contrast ${floorRatio(check.ratio)}:1 against ${against}, below the required ${threshold}:1.${hint}`;
}

/**
 * Checks a theme the copilot wants to set. Returns the theme to write, or a
 * tool error naming each failing colour, its ratio, the threshold and the
 * suggested shade. Nothing here writes; the caller writes only on `theme`.
 */
export function validateSetTheme(
  input: unknown
): { theme: PageTheme | null } | { error: ToolResult } {
  if (typeof input !== "object" || input === null) {
    return {
      error: badInput("set_theme needs { dark, accent } or { reset: true }."),
    };
  }
  const { accent, dark, reset } = input as Record<string, unknown>;
  if (reset === true) {
    return { theme: null };
  }
  if (typeof dark !== "string" || typeof accent !== "string") {
    return {
      error: badInput(
        "set_theme needs { dark, accent } hex strings or { reset: true }."
      ),
    };
  }
  const theme: PageTheme = { accent, dark };
  const check = checkTheme(theme);
  const normalized = { accent: normalizeHex(accent), dark: normalizeHex(dark) };
  if (check.ok && normalized.accent && normalized.dark) {
    return { theme: { accent: normalized.accent, dark: normalized.dark } };
  }
  const problems: string[] = [];
  if (!check.dark.ok) {
    problems.push(
      describeFailure("dark", check.dark, MIN_DARK_ON_WHITE, "white text")
    );
  }
  if (!check.accent.ok && check.dark.ratio > 0) {
    problems.push(
      describeFailure("accent", check.accent, MIN_ACCENT_ON_DARK, "the dark")
    );
  }
  return {
    error: {
      message: `Theme not set, nothing changed. ${problems.join(" ")}`,
      status: "error",
    },
  };
}
