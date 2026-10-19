import { describe, expect, it } from "vitest";
import { umamiBeforeSend, withoutAuthQuery } from "./analytics-privacy";

const VERIFY_URL =
  "https://biso.no/auth/verify?userId=user-1&secret=still-valid-secret";

describe("withoutAuthQuery", () => {
  it("drops the query string from an /auth/ page", () => {
    expect(withoutAuthQuery(VERIFY_URL)).toBe("https://biso.no/auth/verify");
    expect(withoutAuthQuery("https://biso.no/auth/login?next=/jobs#top")).toBe(
      "https://biso.no/auth/login"
    );
  });

  it("drops it from a path-only URL too", () => {
    expect(withoutAuthQuery("/auth/verify?userId=user-1&secret=s")).toBe(
      "/auth/verify"
    );
  });

  it("keeps the query string everywhere else", () => {
    const campaign =
      "https://biso.no/membership?utm_source=instagram&utm_campaign=autumn";
    expect(withoutAuthQuery(campaign)).toBe(campaign);
    expect(withoutAuthQuery("https://biso.no/authors?page=2")).toBe(
      "https://biso.no/authors?page=2"
    );
    expect(withoutAuthQuery("/jobs?campus=1")).toBe("/jobs?campus=1");
  });

  it("leaves empty and unparseable values alone", () => {
    expect(withoutAuthQuery("")).toBe("");
    expect(withoutAuthQuery("http://[broken")).toBe("http://[broken");
  });
});

describe("umamiBeforeSend", () => {
  it("scrubs the page URL and the referrer of every payload", () => {
    const payload = {
      hostname: "biso.no",
      referrer: VERIFY_URL,
      title: "BI Student Organisation",
      url: VERIFY_URL,
      website: "website-id",
    };

    expect(umamiBeforeSend("event", payload)).toEqual({
      ...payload,
      referrer: "https://biso.no/auth/verify",
      url: "https://biso.no/auth/verify",
    });
  });

  it("scrubs the referrer left by navigating away from an /auth/ page", () => {
    const payload = {
      referrer: VERIFY_URL,
      url: "https://biso.no/auth/login",
    };

    expect(umamiBeforeSend("event", payload)).toEqual({
      referrer: "https://biso.no/auth/verify",
      url: "https://biso.no/auth/login",
    });
  });

  it("never cancels a send and passes other payloads through", () => {
    const payload = {
      referrer: "",
      url: "https://biso.no/events?utm_source=newsletter",
    };

    expect(umamiBeforeSend("performance", payload)).toEqual(payload);
    expect(umamiBeforeSend("identify", { data: { campus: "1" } })).toEqual({
      data: { campus: "1" },
    });
  });
});
