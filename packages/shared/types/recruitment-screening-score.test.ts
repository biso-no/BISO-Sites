import { describe, expect, it } from "vitest";
import { computeScreeningNormalizedScore } from "./recruitment";

function dims(...scores: number[]) {
  return scores.map((score, index) => ({
    name: `d${index}`,
    reason: "r",
    score,
  }));
}

describe("computeScreeningNormalizedScore", () => {
  it("maps each overall score to its band anchor when there are no dimensions", () => {
    expect(
      [1, 2, 3, 4, 5].map((overall_score) =>
        computeScreeningNormalizedScore({
          dimension_scores: [],
          overall_score,
        })
      )
    ).toEqual([10, 40, 70, 82, 95]);
  });

  it("puts a strong fit in the 80+ band", () => {
    expect(
      computeScreeningNormalizedScore({
        dimension_scores: dims(4, 4, 4),
        overall_score: 4,
      })
    ).toBeGreaterThanOrEqual(80);
  });

  it("blends the mean dimension score with the overall score", () => {
    // (4 + 3.5) / 2 = 3.75 → 70 + 0.75 × 12 = 79
    expect(
      computeScreeningNormalizedScore({
        dimension_scores: dims(4, 3),
        overall_score: 4,
      })
    ).toBe(79);
  });
});
