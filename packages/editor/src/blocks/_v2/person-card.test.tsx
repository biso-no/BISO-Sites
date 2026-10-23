import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonCard } from "./person-card";

test("an email becomes a mailto link", () => {
  const html = renderToStaticMarkup(
    // biome-ignore lint/a11y/useValidAriaRole: `role` is the job title here, not an ARIA role.
    <PersonCard email="a@biso.no" name="Ada" role="Lead" />
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
