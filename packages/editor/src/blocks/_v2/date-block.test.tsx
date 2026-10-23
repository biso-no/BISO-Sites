import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DateBlock } from "./date-block";

test("renders the Oslo calendar date as dateTime", () => {
  const html = renderToStaticMarkup(
    <DateBlock iso="2027-02-11T09:00:00+01:00" locale="no" />
  );
  expect(html).toContain('dateTime="2027-02-11"');
  expect(html).toContain("rounded-biso-sm");
  expect(html).toContain(">11<");
});

test("uses Oslo time, not UTC, for the day", () => {
  const html = renderToStaticMarkup(
    <DateBlock iso="2027-02-10T23:30:00Z" locale="en" />
  );
  expect(html).toContain('dateTime="2027-02-11"');
});

test("invalid input renders nothing", () => {
  expect(renderToStaticMarkup(<DateBlock iso="not a date" locale="no" />)).toBe(
    ""
  );
  expect(
    renderToStaticMarkup(<DateBlock iso={undefined as unknown as string} />)
  ).toBe("");
});
