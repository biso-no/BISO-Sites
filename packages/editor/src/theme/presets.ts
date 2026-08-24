export type AccentHue = "blue" | "navy" | "sky" | "gold" | "slate";

export const BRAND_ACCENT_VALUES = [
  "#3DA9E0",
  "#001731",
  "#7CC7EC",
  "#F7D64A",
  "#33566F",
] as const;

export const HUE_COLORS: Record<AccentHue, string> = {
  blue: BRAND_ACCENT_VALUES[0],
  navy: BRAND_ACCENT_VALUES[1],
  sky: BRAND_ACCENT_VALUES[2],
  gold: BRAND_ACCENT_VALUES[3],
  slate: BRAND_ACCENT_VALUES[4],
};

/** Map department slugs to their brand accent. */
export const DEPARTMENT_ACCENTS: Record<string, string> = {
  esn: HUE_COLORS.navy,
  finans: HUE_COLORS.slate,
  consulting: HUE_COLORS.blue,
  marketing: HUE_COLORS.gold,
  invest: HUE_COLORS.slate,
  hr: HUE_COLORS.sky,
};

export function accentForDepartment(department: string): string {
  return DEPARTMENT_ACCENTS[department] ?? HUE_COLORS.blue;
}
