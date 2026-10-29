import { describe, expect, test } from "bun:test";
import {
  buildAssistantPrompt,
  buildComparePrompt,
  buildLabelMap,
  describeCandidates,
  idsForLabels,
  pseudonymiseMessage,
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

const BOARD_NAMES = /ola|nordmann|kari|hansen/i;
const FIRST_NAMES = /ola|kari/i;

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

  describe("names typed by the recruiter in any case", () => {
    const board = [
      {
        ...candidates[0],
        id: "a",
        name: "Ola Nordmann",
        gaps: [],
        strengths: [],
      },
      {
        ...candidates[1],
        id: "b",
        name: "Kari Hansen",
        gaps: [],
        strengths: [],
      },
      {
        ...candidates[2],
        id: "c",
        name: "Karianne Berg",
        gaps: [],
        strengths: [],
      },
    ];

    test("lowercase, possessive and mixed-case names are redacted", () => {
      const out = pseudonymiseMessage(
        "is ola better than kari? Olas CV vs OLa and KARI's",
        board
      );
      expect(out).not.toMatch(FIRST_NAMES);
      expect(out).toContain("is Candidate 1 better than Candidate 2?");
      expect(out).toContain("Candidate 1 CV vs Candidate 1 and Candidate 2's");
    });

    test("a token inside another word is not redacted", () => {
      const out = pseudonymiseMessage("what about Karianne and Olaf", board);
      expect(out).toBe("what about Candidate 3 and Olaf");
      expect(out).not.toContain("2anne");
    });

    test("full names match longest first and only as whole words", () => {
      const named = [
        { ...candidates[0], id: "a", name: "Ola Berg" },
        { ...candidates[1], id: "b", name: "Ola Bergersen" },
        { ...candidates[2], id: "c", name: "Eva" },
      ];
      expect(pseudonymiseMessage("Ola Berg and Ola Bergersen", named)).toBe(
        "Candidate 1 and Candidate 2"
      );
      expect(pseudonymiseMessage("the evaluation of Eva", named)).toBe(
        "the evaluation of Candidate 3"
      );
    });

    test("a hyphenated first name never reaches the model in parts", () => {
      const named = [{ ...candidates[0], id: "a", name: "Anne-Marie Lie" }];
      const out = pseudonymiseMessage(
        "is anne strong? what about Anne Marie and anne-marie",
        named
      );
      expect(out).not.toMatch(/anne|marie|lie/i);
    });

    test("strengths and gaps never carry another candidate's name", () => {
      const withText = board.map((c, i) => ({
        ...c,
        strengths: i === 0 ? ["Stronger than kari on sales"] : [],
        gaps: i === 1 ? ["Weaker than Ola Nordmann"] : [],
      }));
      const out = describeCandidates(withText);
      expect(out).not.toMatch(BOARD_NAMES);
      expect(out).toContain("Stronger than Candidate 2 on sales");
      expect(out).toContain("Weaker than Candidate 1");
    });
  });
});
