import { describe, expect, it } from "vitest";
import { umamiBeforeSend, withoutSensitiveQuery } from "./analytics-privacy";

const VERIFY_URL =
  "https://biso.no/auth/verify?userId=user-1&secret=still-valid-secret";

describe("withoutSensitiveQuery", () => {
  it("drops the query string from an /auth/ page", () => {
    expect(withoutSensitiveQuery(VERIFY_URL)).toBe(
      "https://biso.no/auth/verify"
    );
    expect(
      withoutSensitiveQuery("https://biso.no/auth/login?next=/jobs#top")
    ).toBe("https://biso.no/auth/login");
  });

  it("drops it from a path-only URL too", () => {
    expect(withoutSensitiveQuery("/auth/verify?userId=user-1&secret=s")).toBe(
      "/auth/verify"
    );
  });

  it("keeps the query string everywhere else", () => {
    const campaign =
      "https://biso.no/membership?utm_source=instagram&utm_campaign=autumn";
    expect(withoutSensitiveQuery(campaign)).toBe(campaign);
    expect(withoutSensitiveQuery("https://biso.no/authors?page=2")).toBe(
      "https://biso.no/authors?page=2"
    );
    expect(withoutSensitiveQuery("/jobs?campus=1")).toBe("/jobs?campus=1");
  });

  it("leaves empty and unparseable values alone", () => {
    expect(withoutSensitiveQuery("")).toBe("");
    expect(withoutSensitiveQuery("http://[broken")).toBe("http://[broken");
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

describe("search page", () => {
  it("drops the whole query from /search", () => {
    expect(
      umamiBeforeSend("pageview", { url: "/search?q=ola+nordmann&type=job" })
        .url
    ).toBe("/search");
    expect(withoutSensitiveQuery("https://biso.no/search?q=a#b")).toBe(
      "https://biso.no/search"
    );
  });

  it("scrubs a /search referrer", () => {
    expect(
      umamiBeforeSend("pageview", { referrer: "https://biso.no/search?q=x" })
        .referrer
    ).toBe("https://biso.no/search");
  });
});
