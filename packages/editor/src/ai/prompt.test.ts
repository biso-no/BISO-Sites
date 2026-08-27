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

test("the copilot is told to talk, not just call tools", () => {
  const prompt = buildSystemPrompt("empty page");

  // Volunteers see silence while blocks appear underneath them unless the
  // model narrates: a line before acting, a summary after, one follow-up.
  expect(prompt).toContain("Never reply with tool\ncalls alone");
  expect(prompt).toContain("before you call any\n   tool");
  expect(prompt).toContain("summary of what you actually did");
  expect(prompt).toContain("End with one specific, useful follow-up");

  // ...but not for plain questions.
  expect(prompt).toContain("When the request is a question");
});

test("the copilot knows the page snapshot predates its own edits", () => {
  const prompt = buildSystemPrompt("empty page");

  expect(prompt).toContain("snapshot taken before this turn");
  expect(prompt).toContain("changes you actually made");
});

test("the page context is interpolated into the prompt", () => {
  const prompt = buildSystemPrompt("== BLOCKS ==\n1. hero (blk_abc)");

  expect(prompt).toContain("1. hero (blk_abc)");
});
