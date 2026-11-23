import type { MapContext, TranslationText } from "./common";

export function ctx(overrides: Partial<MapContext> = {}): MapContext {
  return {
    now: new Date("2026-11-23T00:00:00Z"),
    syncedAt: 1_700_000_000_000,
    departmentName: (id) => (id ? `Dept ${id}` : null),
    ...overrides,
  };
}

export const noText: TranslationText[] = [
  {
    locale: "no",
    title: "Vinterleker",
    description: "<p>Tre dager</p>",
    short_description: null,
  },
];
