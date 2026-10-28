import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AskAboutPage, AskAboutPageView } from "./ask-about-page";

const URL = "/guide/recruitment/publish";
const TOGGLE = /<button[^>]*type="button"[^>]*>.*Ask about this page<\/button>/;

test("AskAboutPage renders nothing with the assistant off", () => {
  // No AssistantProvider: the assistant is off, as it is with no API key.
  expect(renderToStaticMarkup(<AskAboutPage url={URL} />)).toBe("");
});

test("the view renders nothing when disabled", () => {
  expect(
    renderToStaticMarkup(
      <AskAboutPageView ask={() => undefined} enabled={false} url={URL} />
    )
  ).toBe("");
});

test("when enabled it renders a named, collapsed button", () => {
  const html = renderToStaticMarkup(
    <AskAboutPageView ask={() => undefined} enabled url={URL} />
  );
  expect(html).toMatch(TOGGLE);
  expect(html).toContain('aria-expanded="false"');
  // The question field opens only on a click.
  expect(html).not.toContain("<input");
});
