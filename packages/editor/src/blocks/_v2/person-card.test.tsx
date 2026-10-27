import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonCard } from "./person-card";

test("an email becomes a mailto link", () => {
  const html = renderToStaticMarkup(
    <PersonCard email="a@biso.no" name="Ada" position="Lead" />
  );
  expect(html).toContain('href="mailto:a@biso.no"');
  expect(html).toContain("Lead");
});

test("a javascript: email renders no link", () => {
  const html = renderToStaticMarkup(
    <PersonCard email="javascript:alert(1)" name="Ada" />
  );
  expect(html).not.toContain("<a");
  expect(html).not.toContain("javascript:");
});

test("a phone becomes a tel link with spaces stripped", () => {
  const html = renderToStaticMarkup(
    <PersonCard name="Ada" phone="+47 123 45 678" />
  );
  expect(html).toContain('href="tel:+4712345678"');
});

const MONOGRAM = /data-monogram="">([^<]*)</;

test("without a photo the card shows decorative initials", () => {
  const html = renderToStaticMarkup(<PersonCard name="Ada Lovelace" />);
  expect(html).toContain('<span aria-hidden="true" data-monogram="">AL</span>');
  expect(html).toContain("bg-surface-raised");
});

test("with a photo there is no monogram", () => {
  const html = renderToStaticMarkup(
    <PersonCard imageSrc="/a.jpg" name="Ada Lovelace" />
  );
  expect(html).not.toContain("data-monogram");
});

test("initials handle one name, no name, and Norwegian letters", () => {
  const initials = (name: string) =>
    renderToStaticMarkup(<PersonCard name={name} />).match(MONOGRAM)?.[1];
  expect(initials("Ada")).toBe("A");
  expect(initials("")).toBe("");
  expect(initials("æsa østby åkre")).toBe("ÆÅ");
  expect(initials("Øyvind Ås")).toBe("ØÅ");
});
