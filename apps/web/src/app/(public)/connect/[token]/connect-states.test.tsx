import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
vi.mock("@/app/actions/big-event-connect", () => ({
  connectTicket: vi.fn(),
}));

const { ConnectStates } = await import("./connect-states");

function render(view: Parameters<typeof ConnectStates>[0]["view"]): string {
  return renderToStaticMarkup(
    createElement(ConnectStates, { token: "t".repeat(43), view })
  );
}

test("an ended big event's link says so, with no new link to ask for", () => {
  const html = render({ state: "ended" });
  expect(html).toContain("bigEvents.connect.ended.title");
  expect(html).not.toContain("bigEvents.connect.invalid");
  expect(html).not.toContain("/connect/help");
});

test("a link that doesn't work offers a new one", () => {
  const html = render({ state: "invalid" });
  expect(html).toContain("bigEvents.connect.invalid.title");
  expect(html).toContain('href="/connect/help"');
  expect(html).toContain("bigEvents.connect.invalid.cta");
});
