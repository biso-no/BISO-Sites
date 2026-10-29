import { describe, expect, test } from "bun:test";
import {
  buildAssistantPrompt,
  buildComparePrompt,
  buildLabelMap,
  idsForLabels,
  restoreLabels,
} from "./recruitment-ai-prompts";

const candidates = Array.from({ length: 12 }, (_, index) => ({
  days: index,
  gaps: index === 0 ? ["Zorblax Quillfeather has no sales experience"] : [],
  id: `id-${index + 1}`,
  name: index === 0 ? "Zorblax Quillfeather" : `Firstname${index + 1} Lastname`,
  score: 80 - index,
  skills: [],
  source: null,
  stage: "applied",
  strengths: index === 0 ? ["Zorblax leads teams (zorb@example.com)"] : [],
  summary: null,
}));

describe("recruitment AI prompts", () => {
  test("compare prompt carries labels and no candidate name", () => {
    const prompt = buildComparePrompt("Barista", candidates);
    expect(prompt).toContain("Candidate 1");
    expect(prompt).not.toContain("Zorblax");
    expect(prompt).not.toContain("Quillfeather");
    expect(prompt).not.toContain("zorb@example.com");
    expect(prompt).not.toContain("Firstname5");
  });

  test("assistant prompt scrubs names from the recruiter's question", () => {
    const prompt = buildAssistantPrompt(
      "Barista",
      "Is Zorblax better than Firstname5 Lastname? Mail zorb@example.com",
      candidates
    );
    expect(prompt).not.toContain("Zorblax");
    expect(prompt).not.toContain("Firstname5");
    expect(prompt).not.toContain("Quillfeather");
    expect(prompt).not.toContain("zorb@example.com");
    expect(prompt).toContain("Is Candidate 1 better than Candidate 5");
  });

  test("labels map back to first names and ids exactly", () => {
    const map = buildLabelMap(candidates);
    expect(restoreLabels("Candidate 12 beats Candidate 1.", candidates)).toBe(
      "Firstname12 beats Zorblax."
    );
    expect(idsForLabels(["Candidate 1"], map)).toEqual(["id-1"]);
    expect(idsForLabels(["Candidate 12", "Candidate 12"], map)).toEqual([
      "id-12",
    ]);
    expect(idsForLabels(["Candidate 99", "Zorblax"], map)).toEqual([]);
  });

  test("unknown labels are left alone", () => {
    expect(restoreLabels("Candidate 99 wins", candidates)).toBe(
      "Candidate 99 wins"
    );
  });
});
