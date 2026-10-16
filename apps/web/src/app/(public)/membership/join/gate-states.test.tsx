import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("next-intl", () => ({
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) =>
      `${namespace}.${key}${values ? JSON.stringify(values) : ""}`,
}));

const { AlreadyMemberState } = await import("./gate-states");

test("a student whose membership has not started is told when it starts, not that they are a member", () => {
  const html = renderToStaticMarkup(
    createElement(AlreadyMemberState, {
      expiry: "2029-12-31",
      startsOn: "2027-01-01",
    })
  ).replaceAll("&quot;", '"');
  expect(html).toContain("membership.join.alreadyMember.upcomingTitle");
  expect(html).toContain(
    'upcomingBody{"end":"2029-12-31","start":"2027-01-01"}'
  );
  expect(html).not.toContain("alreadyMember.title");
});

test("a current member keeps the already-member copy, with a formatted date", () => {
  const html = renderToStaticMarkup(
    createElement(AlreadyMemberState, { expiry: "2027-06-30", startsOn: null })
  ).replaceAll("&quot;", '"');
  expect(html).toContain("membership.join.alreadyMember.title");
  expect(html).toContain('body{"expiry":"2027-06-30"}');
});
