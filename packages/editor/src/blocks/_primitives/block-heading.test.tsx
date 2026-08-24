import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockHeading } from "./block-heading";

test("BlockHeading uses semantic tokens on every surface", () => {
  const html = renderToStaticMarkup(
    <BlockHeading eyebrow="Student life" intro="Intro" title="Heading" />
  );

  expect(html).toContain("text-foreground");
  expect(html).toContain("text-muted-foreground");
  expect(html).not.toContain("text-brand-dark");
});
