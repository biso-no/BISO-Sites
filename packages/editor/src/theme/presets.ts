export type AccentHue = "claret" | "gold" | "leaf" | "sky";

export const HUE_COLORS: Record<AccentHue, string> = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  leaf: "#2f5d3a",
  sky: "#2a4a7a",
};

/** Map department slugs to their brand accent. */
export const DEPARTMENT_ACCENTS: Record<string, string> = {
  esn: HUE_COLORS.claret,
  finans: HUE_COLORS.sky,
  consulting: HUE_COLORS.leaf,
  marketing: HUE_COLORS.gold,
  invest: HUE_COLORS.sky,
  hr: HUE_COLORS.claret,
};

export function accentForDepartment(department: string): string {
  return DEPARTMENT_ACCENTS[department] ?? HUE_COLORS.claret;
}
