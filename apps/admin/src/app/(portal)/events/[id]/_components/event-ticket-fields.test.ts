import { describe, expect, test } from "bun:test";
import {
  memberPriceProblem,
  ticketLinkSummary,
  ticketUrlProblem,
} from "./event-ticket-fields";

const TICKSTER =
  "https://secure.tickster.com/no/6d0g6ubjeg3tw51/products?utm_source=ig";

describe("ticketUrlProblem", () => {
  test("accepts an empty link, since it is optional", () => {
    expect(ticketUrlProblem(null)).toBeNull();
    expect(ticketUrlProblem("")).toBeNull();
    expect(ticketUrlProblem("   ")).toBeNull();
  });

  test("accepts a pasted Tickster link", () => {
    expect(ticketUrlProblem(TICKSTER)).toBeNull();
    expect(ticketUrlProblem(` ${TICKSTER} `)).toBeNull();
  });

  test("asks for the whole link when the scheme is missing", () => {
    expect(ticketUrlProblem("secure.tickster.com/no/6d0g6ubjeg3tw51")).toBe(
      "Paste the whole link, starting with https://"
    );
  });

  test("rejects links that aren't web pages", () => {
    expect(ticketUrlProblem("mailto:charity@biso.no")).toBe(
      "Use a web link that starts with https://"
    );
    expect(ticketUrlProblem("javascript:alert(1)")).toBe(
      "Use a web link that starts with https://"
    );
  });
});

describe("memberPriceProblem", () => {
  test("flags the Charity Ball swap: 650 regular, 1085 members", () => {
    expect(memberPriceProblem(650, 1085)).toBe(
      "The member price is higher than the regular price. Are they swapped?"
    );
  });

  test("accepts a lower member price, an equal one, or none", () => {
    expect(memberPriceProblem(1085, 650)).toBeNull();
    expect(memberPriceProblem(650, 650)).toBeNull();
    expect(memberPriceProblem(650, 0)).toBeNull();
    expect(memberPriceProblem(650, null)).toBeNull();
  });
});

describe("ticketLinkSummary", () => {
  test("shows the host of a valid link", () => {
    expect(ticketLinkSummary(TICKSTER)).toBe("secure.tickster.com");
  });

  test("is null when there is no link, and shows a broken one as typed", () => {
    expect(ticketLinkSummary(null)).toBeNull();
    expect(ticketLinkSummary("tickster.com/x")).toBe("tickster.com/x");
  });
});
