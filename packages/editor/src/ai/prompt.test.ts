import { expect, test } from "bun:test";
import { buildSystemPrompt } from "./prompt";

test("the copilot describes the current BISO typography and palette", () => {
  const prompt = buildSystemPrompt("empty page");

  expect(prompt).toContain("Museo Slab headings");
  expect(prompt).toContain("Museo Sans body text");
  // BISO sets everything in Museo; Inter was never the brand's.
  expect(prompt).not.toContain("Inter");
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

test("the copilot knows the props and item shapes of the v2 blocks", () => {
  const prompt = buildSystemPrompt("empty page");

  // set_prop writes these paths; a wrong shape (a string where a list
  // belongs, a value under the wrong key) renders as an empty block.
  for (const shape of [
    "heading: eyebrow, title, intro, size (small|medium|large), link? {label, href}",
    "text: body [{type: h|h3|p|li, text}]",
    "highlights: items [{text}]",
    "facts: items [{label, text, href?}]",
    "stats: items [{num, label}]",
    "cards: layout (grid|row), columns (2|3|4), style (bordered|plain), items [{title, body, eyebrow?, href?, image? {src, alt}}]",
    "timeline: heading?, items [{label, title?, text}]",
    "stepGrid: heading?, items [{title, body}]",
    "buttons: align (start|center), items [{label, href, style: primary|secondary}], at most 3",
    "ctaBand: eyebrow, title, text, buttons [{label, href, style}], at most 2",
    "image: src, alt, ratio (21/9|16/9|3/2|4/3|1/1|4/5|3/4), frame (chevron|plain), lean (left|right), caption",
    "gallery: images [{src, alt}], layout (collage|grid|row)",
    "faq: heading?, items [{q, a}]",
    "tabs: tabs [{label, body}]",
    "marquee: text (items separated by ·",
    "video: url, poster, style (featured|inline|loop), ratio (16/9|21/9), label, caption",
  ]) {
    expect(prompt).toContain(shape);
  }
  expect(prompt).toContain("items.0.label");
});
