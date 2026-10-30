import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "./page-header";

test("shows who and updated", () => {
  const html = renderToStaticMarkup(
    <PageHeader title="Publish a vacancy" updated="27 Oct 2026" who="HR team" />
  );
  expect(html).toContain("Who can do this:");
  expect(html).toContain("Updated 27 Oct 2026");
});

test("omits the meta line when both are missing", () => {
  const html = renderToStaticMarkup(
    <PageHeader title="Developers" updated={null} />
  );
  expect(html).not.toContain("Who can do this");
  expect(html).not.toContain("Updated");
  expect(html).not.toContain("Invalid");
});

test("renders exactly one h1", () => {
  const html = renderToStaticMarkup(
    <PageHeader crumb="Recruitment" title="X" />
  );
  expect(html.match(/<h1/g)?.length).toBe(1);
});
