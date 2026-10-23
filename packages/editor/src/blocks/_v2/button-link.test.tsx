import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ButtonLink } from "./button-link";

test("primary renders the action surface", () => {
  const html = renderToStaticMarkup(
    <ButtonLink button={{ href: "/join", label: "Join", style: "primary" }} />
  );
  expect(html).toContain("bg-action");
  expect(html).not.toContain("noopener");
});

test("an external href opens safely in a new tab", () => {
  const html = renderToStaticMarkup(
    <ButtonLink
      button={{ href: "https://example.com", label: "Go", style: "secondary" }}
    />
  );
  expect(html).toContain('rel="noopener"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain("border-edge");
});
