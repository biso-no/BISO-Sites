import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AskField } from "./ask-field";
import { RolePaths } from "./role-paths";
import { SplitHero } from "./split-hero";
import { TaskGroups } from "./task-groups";

const HANDOVER_LINK = /<a[^>]*href="\/developers"[^>]*>Start the handover/;
const BUTTON_OPEN = /^<button[^>]*type="button"/;
const GROUP_LINK = /<a[^>]*href="\/guide\/recruitment"[^>]*>Recruitment/;
const TASK_LINK =
  /<a[^>]*href="\/guide\/recruitment\/publish"[^>]*>Publish a vacancy/;

test("empty role paths render nothing", () =>
  expect(renderToStaticMarkup(<RolePaths paths={[]} />)).toBe(""));

test("empty task groups render nothing", () =>
  expect(renderToStaticMarkup(<TaskGroups groups={[]} />)).toBe(""));

test("role paths are ordered lists", () => {
  const html = renderToStaticMarkup(
    <RolePaths
      paths={[
        { role: "HR team", steps: [{ title: "Sign in", href: "/guide" }] },
      ]}
    />
  );
  expect(html).toContain("<ol");
  expect(html).toContain("Start with your role");
});

test("hero copy", () => {
  const html = renderToStaticMarkup(<SplitHero />);
  for (const s of [
    "How BISO runs",
    "Keeping it running",
    "Start the handover",
  ]) {
    expect(html).toContain(s);
  }
});

test("the handover button links to the developer area", () => {
  const html = renderToStaticMarkup(<SplitHero />);
  expect(html).toMatch(HANDOVER_LINK);
});

test("the hero's edge is cut at 13 degrees", () => {
  expect(renderToStaticMarkup(<SplitHero />)).toContain(
    "polygon(calc(360px*0.2309)_0,100%_0,100%_100%,0_100%)"
  );
});

test("the ask field is a named button", () => {
  const html = renderToStaticMarkup(<AskField />);
  expect(html).toMatch(BUTTON_OPEN);
  expect(html).toContain('aria-label="Search the docs"');
  expect(html).toContain(">Search<");
});

test("task groups link their heading and each task", () => {
  const html = renderToStaticMarkup(
    <TaskGroups
      groups={[
        {
          title: "Recruitment",
          href: "/guide/recruitment",
          tasks: [
            { title: "Publish a vacancy", href: "/guide/recruitment/publish" },
          ],
        },
      ]}
    />
  );
  expect(html).toMatch(GROUP_LINK);
  expect(html).toMatch(TASK_LINK);
});
