import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AskField, AskFieldView } from "./ask-field";
import { RolePaths } from "./role-paths";
import { SplitHero } from "./split-hero";
import { TaskGroups } from "./task-groups";

const HANDOVER_LINK = /<a[^>]*href="\/developers"[^>]*>Start the handover/;
const BUTTON_OPEN = /^<button[^>]*type="button"/;
const INPUT_ID = /<input[^>]*id="([^"]+)"/;
const ASK_LABEL = /<label[^>]*>Ask a question or search<\/label>/;
const ASK_BUTTON = /<button[^>]*type="submit"[^>]*>Ask<\/button>/;
const ASK_BUTTON_DISABLED = /<button[^>]*disabled=""[^>]*>Ask<\/button>/;
const ONE_FORM = /<form[\s\S]*<\/form>/;
const FORM_OPEN = /<form/g;
const TEXT_INPUT = /<input[^>]*type="text"/;
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

test("with the assistant off, the ask field is the search button", () => {
  // No AssistantProvider: the assistant is off, as it is with no API key.
  const html = renderToStaticMarkup(<AskField />);
  expect(html).toMatch(BUTTON_OPEN);
  expect(html).toContain('aria-label="Search the docs"');
  expect(html).toContain(">Search<");
  expect(html).not.toContain("<input");
  expect(html).not.toContain(">Ask<");
});

test("with the assistant on, the ask field is a labelled input and an Ask button", () => {
  const html = renderToStaticMarkup(
    <AskFieldView ask={() => undefined} enabled />
  );
  const id = html.match(INPUT_ID)?.[1];
  expect(id).toBeTruthy();
  expect(html).toContain(`for="${id}"`);
  expect(html).toMatch(ASK_LABEL);
  expect(html).toContain('maxLength="500"');
  expect(html).toMatch(ASK_BUTTON);
  expect(html).toContain(">Search instead<");
  expect(html).not.toContain('aria-label="Search the docs"');
});

test("Enter in the ask input submits: the input and Ask share one form", () => {
  const html = renderToStaticMarkup(
    <AskFieldView ask={() => undefined} enabled />
  );
  const form = html.match(ONE_FORM)?.[0] ?? "";
  expect(html.match(FORM_OPEN)).toHaveLength(1);
  expect(form).toMatch(TEXT_INPUT);
  expect(form).toMatch(ASK_BUTTON);
});

test("the Ask button starts disabled, with nothing typed", () => {
  const html = renderToStaticMarkup(
    <AskFieldView ask={() => undefined} enabled />
  );
  expect(html).toMatch(ASK_BUTTON_DISABLED);
});

test("with the assistant off, the view is exactly the search button", () => {
  expect(
    renderToStaticMarkup(<AskFieldView ask={() => undefined} enabled={false} />)
  ).toBe(renderToStaticMarkup(<AskField />));
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
