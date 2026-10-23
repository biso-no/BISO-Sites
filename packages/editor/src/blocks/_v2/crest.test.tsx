import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Crest } from "./crest";

test("shows the logo on the sunken surface", () => {
  const html = renderToStaticMarkup(
    <Crest logoUrl="https://cdn.example/l.png" name="Fadderullan" />
  );
  expect(html).toContain("<img");
  expect(html).toContain("bg-surface-sunken");
  expect(html).toContain("rounded-biso-md");
});

test("without a logo it shows initials, no gradient", () => {
  const html = renderToStaticMarkup(<Crest name="OSL Fadderullan" />);
  expect(html).toContain("text-ink-accent");
  expect(html).toContain("bg-surface-sunken");
  expect(html).not.toContain("gradient");
  expect(html).not.toContain("<img");
  expect(html).toContain(">OF<");
});

test("a blank name renders an empty crest, not a crash", () => {
  expect(() => renderToStaticMarkup(<Crest name="" />)).not.toThrow();
});
