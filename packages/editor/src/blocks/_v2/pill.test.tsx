import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Pill } from "./pill";

test("a pill is semibold, never medium, and takes its tone", () => {
  const html = renderToStaticMarkup(<Pill tone="success">Open</Pill>);
  expect(html).toContain("font-semibold");
  expect(html).not.toContain("font-medium");
  expect(html).toContain("text-success");
});

test("uppercase switches to the label role", () => {
  const html = renderToStaticMarkup(<Pill uppercase>Job</Pill>);
  expect(html).toContain("type-label");
  expect(html).toContain("bg-ink-muted/8");
});

test("an unknown tone falls back to neutral", () => {
  const html = renderToStaticMarkup(
    <Pill tone={"nope" as unknown as "neutral"}>x</Pill>
  );
  expect(html).toContain("text-ink-muted");
});
