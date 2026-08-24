import { expect, test } from "bun:test";
import { buildSystemPrompt } from "./prompt";

test("the copilot describes the current BISO typography and palette", () => {
  const prompt = buildSystemPrompt("empty page");

  expect(prompt).toContain("Museo Sans headings");
  expect(prompt).toContain("Inter body text");
  expect(prompt).toContain("BISO blue");
  expect(prompt).not.toContain("Instrument Serif");
  expect(prompt).not.toContain("paper/claret");
});
