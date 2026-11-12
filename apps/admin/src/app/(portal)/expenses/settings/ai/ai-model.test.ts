import { describe, expect, test } from "bun:test";
import {
  type EvalRow,
  keptStats,
  normalizeOwnText,
  recurringOwnTexts,
} from "./ai-model";

const NOW = new Date("2026-11-12T12:00:00Z");

function row(overrides: Partial<EvalRow> = {}): EvalRow {
  return {
    aiConfidence: 0.9,
    aiCostType: "travel",
    costType: "travel",
    costTypeText: null,
    createdAt: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

describe("keptStats", () => {
  test("counts kept, changed and own text", () => {
    const stats = keptStats(
      [
        row(),
        row({ costType: "food" }),
        row({ costType: "travel", costTypeText: "Taxi to airport" }),
      ],
      NOW,
      30
    );
    expect(stats.total).toBe(3);
    expect(stats.kept).toBe(1);
    expect(stats.keptRate).toBeCloseTo(1 / 3);
    expect(stats.perType).toHaveLength(1);
    expect(stats.perType[0]?.slug).toBe("travel");
    expect(stats.perType[0]?.correctedTo).toEqual([
      { count: 1, to: "food" },
      { count: 1, to: "own text" },
    ]);
  });

  test("excludes rows outside the window", () => {
    const old = row({ createdAt: "2026-09-01T10:00:00Z" });
    expect(keptStats([old], NOW, 30).total).toBe(0);
    expect(keptStats([old], NOW, 90).total).toBe(1);
  });

  test("excludes rows without an AI pick", () => {
    expect(keptStats([row({ aiCostType: null })], NOW, 30).total).toBe(0);
  });

  test("keptRate is null on empty", () => {
    const stats = keptStats([], NOW, 30);
    expect(stats).toEqual({ kept: 0, keptRate: null, perType: [], total: 0 });
  });

  test("correctedTo is sorted by count and capped at 3", () => {
    const rows = [
      row({ costType: "a" }),
      row({ costType: "b" }),
      row({ costType: "b" }),
      row({ costType: "c" }),
      row({ costType: "c" }),
      row({ costType: "c" }),
      row({ costType: "d" }),
    ];
    const [type] = keptStats(rows, NOW, 30).perType;
    expect(type?.correctedTo.map((entry) => entry.to)).toEqual(["c", "b", "a"]);
  });

  test("orders types by AI picks, most first", () => {
    const rows = [row({ aiCostType: "food", costType: "food" }), row(), row()];
    expect(keptStats(rows, NOW, 30).perType.map((t) => t.slug)).toEqual([
      "travel",
      "food",
    ]);
  });
});

describe("normalizeOwnText", () => {
  test("trims, lowercases and collapses whitespace", () => {
    expect(normalizeOwnText("  Taxi   To\tAirport \n")).toBe("taxi to airport");
  });
});

describe("recurringOwnTexts", () => {
  const withText = (text: string) => row({ costTypeText: text });

  test("groups case and spacing variants and picks the common spelling", () => {
    const result = recurringOwnTexts([
      withText("Taxi"),
      withText("taxi "),
      withText("Taxi"),
      withText("  TAXI"),
    ]);
    expect(result).toEqual([{ count: 4, example: "Taxi", text: "taxi" }]);
  });

  test("honours minCount", () => {
    const rows = [withText("a"), withText("a"), withText("b")];
    expect(recurringOwnTexts(rows)).toEqual([]);
    expect(recurringOwnTexts(rows, 2).map((entry) => entry.text)).toEqual([
      "a",
    ]);
  });

  test("ignores rows without own text and caps at 20", () => {
    const rows = [row()];
    for (let i = 0; i < 25; i++) {
      rows.push(withText(`text ${i}`), withText(`text ${i}`));
    }
    expect(recurringOwnTexts(rows, 2)).toHaveLength(20);
  });
});
