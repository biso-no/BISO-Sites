import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readingPaths } from "../lib/landing";
import { RolePaths } from "./role-paths";

function underArea(area: "guide" | "developers") {
  return readingPaths.filter((path) =>
    path.steps.every(
      (step) => step.href === `/${area}` || step.href.startsWith(`/${area}/`)
    )
  );
}

test("renders every guide path's role and links, in order", () => {
  const html = renderToStaticMarkup(<RolePaths area="guide" />);
  const paths = underArea("guide");
  expect(paths.length).toBeGreaterThan(1);

  let cursor = -1;
  for (const path of paths) {
    const roleAt = html.indexOf(path.role, cursor + 1);
    expect(roleAt, path.role).toBeGreaterThan(cursor);
    cursor = roleAt;
    for (const step of path.steps) {
      const hrefAt = html.indexOf(`href="${step.href}"`, cursor + 1);
      expect(hrefAt, step.href).toBeGreaterThan(cursor);
      expect(html).toContain(step.title);
      cursor = hrefAt;
    }
  }
});

test("excludes the developer path from the guide", () => {
  const html = renderToStaticMarkup(<RolePaths area="guide" />);
  expect(html).not.toContain("/developers/");
  expect(html).not.toContain("Developer or consultant");
});

test("renders the developer path for area developers", () => {
  const html = renderToStaticMarkup(<RolePaths area="developers" />);
  expect(html).toContain("Developer or consultant");
  expect(html).toContain('href="/developers/start-here/your-first-day"');
  expect(html).not.toContain("/guide/");
});
