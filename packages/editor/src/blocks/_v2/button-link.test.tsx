import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHtml } from "@/lib/test-dom";
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

test("an unsafe href renders a styled span, not a link", () => {
  const html = renderToStaticMarkup(
    <ButtonLink
      button={{ href: "javascript:alert(1)", label: "Go", style: "primary" }}
    />
  );
  expect(html).not.toContain("<a");
  expect(html).toContain("<span");
  expect(html).toContain("bg-action");
  expect(html).toContain("Go");
});

test("in the editor a button is never a link, so a click cannot navigate", () => {
  const root = parseHtml(
    renderToStaticMarkup(
      <ButtonLink
        button={{ href: "https://example.com", label: "Go", style: "primary" }}
        edit
      />
    )
  );
  expect(root.querySelectorAll("a")).toHaveLength(0);
  const span = root.querySelector("span");
  expect(span?.classList.contains("bg-action")).toBe(true);
  expect(span?.textContent).toBe("Go");
});

test("an unknown style falls back to primary", () => {
  const root = parseHtml(
    renderToStaticMarkup(
      <ButtonLink
        button={{ href: "/x", label: "Go", style: "loud" as never }}
      />
    )
  );
  expect(root.querySelector("a")?.classList.contains("bg-action")).toBe(true);
});

test("an inherited key is not a style", () => {
  const root = parseHtml(
    renderToStaticMarkup(
      <ButtonLink
        button={{ href: "/x", label: "Go", style: "constructor" as never }}
      />
    )
  );
  expect(root.querySelector("a")?.classList.contains("bg-action")).toBe(true);
});
