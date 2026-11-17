import type { ErrorEvent, Log, Metric, StreamedSpanJSON } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  REDACTED,
  redactHeaders,
  scrubBreadcrumb,
  scrubEvent,
  scrubLog,
  scrubMetric,
  scrubSpan,
  scrubText,
  scrubUrl,
} from "./scrub";

describe("scrubText", () => {
  it("redacts bank account numbers in all spellings", () => {
    expect(scrubText("Konto 1234.56.78903 avvist")).toBe(
      "Konto [redacted] avvist"
    );
    expect(scrubText("12345678903")).toBe(REDACTED);
    expect(scrubText("1234 56 78903")).toBe(REDACTED);
  });

  it("redacts national id numbers", () => {
    expect(scrubText("fnr 01019912345")).toBe("fnr [redacted]");
    expect(scrubText("010199 12345")).toBe(REDACTED);
  });

  it("redacts emails", () => {
    expect(scrubText("mail ola.nordmann+x@student.bi.no feilet")).toBe(
      "mail [redacted] feilet"
    );
  });

  it("leaves timestamps, ids and small numbers alone", () => {
    expect(scrubText("ts 1794913200123")).toBe("ts 1794913200123");
    expect(scrubText("6745a1b2c3d4e5f6a7b8")).toBe("6745a1b2c3d4e5f6a7b8");
    expect(scrubText("order 42")).toBe("order 42");
  });
});

describe("scrubUrl", () => {
  it("drops query and fragment", () => {
    expect(scrubUrl("https://biso.no/auth/verify?secret=abc&userId=u1#x")).toBe(
      "https://biso.no/auth/verify"
    );
    expect(scrubUrl("/api/payment/return?orderId=1&code=z")).toBe(
      "/api/payment/return"
    );
  });

  it("scrubs emails in the path", () => {
    expect(scrubUrl("https://biso.no/u/ola@biso.no")).toBe(
      "https://biso.no/u/[redacted]"
    );
  });
});

describe("redactHeaders", () => {
  it("redacts sensitive headers case-insensitively", () => {
    expect(
      redactHeaders({
        Cookie: "a",
        Authorization: "b",
        "x-appwrite-key": "c",
        accept: "d",
      })
    ).toEqual({
      Cookie: REDACTED,
      Authorization: REDACTED,
      "x-appwrite-key": REDACTED,
      accept: "d",
    });
  });

  it("handles undefined", () => {
    expect(redactHeaders(undefined)).toEqual({});
  });
});

describe("scrubEvent", () => {
  it("strips request data, user details and scrubs text", () => {
    const event = {
      type: undefined,
      message: "fnr 01019912345",
      request: {
        url: "https://biso.no/x?secret=s",
        cookies: { a: "1" },
        data: "{}",
        query_string: "secret=s",
        headers: { cookie: "x", accept: "y" },
      },
      user: {
        id: "u1",
        email: "a@b.no",
        ip_address: "1.2.3.4",
        username: "ola",
      },
      exception: { values: [{ value: "acct 1234.56.78903" }] },
      breadcrumbs: [{ message: "a@b.no", data: { url: "/x?code=1" } }],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);

    expect(out.request?.url).toBe("https://biso.no/x");
    expect(out.request).not.toHaveProperty("cookies");
    expect(out.request).not.toHaveProperty("data");
    expect(out.request).not.toHaveProperty("query_string");
    expect(out.request?.headers).toEqual({ cookie: REDACTED, accept: "y" });
    expect(out.user).toEqual({ id: "u1" });
    expect(out.message).toBe("fnr [redacted]");
    expect(out.exception?.values?.[0]?.value).toBe("acct [redacted]");
    expect(out.breadcrumbs?.[0]?.message).toBe(REDACTED);
    expect(out.breadcrumbs?.[0]?.data?.url).toBe("/x");
  });
});

describe("scrubBreadcrumb", () => {
  it("scrubs message and url data", () => {
    const out = scrubBreadcrumb({
      message: "a@b.no",
      data: { url: "/x?code=1", n: 2 },
    });
    expect(out.message).toBe(REDACTED);
    expect(out.data).toEqual({ url: "/x", n: 2 });
  });
});

describe("scrubLog", () => {
  it("scrubs message and attributes", () => {
    const log = {
      level: "error",
      message: "M365 Sync Failed: ola@biso.no",
      attributes: { url: "/a?x=1", n: 3, who: "ola@biso.no" },
    } as Log;
    const out = scrubLog(log);
    expect(String(out.message)).toBe("M365 Sync Failed: [redacted]");
    expect(out.attributes).toEqual({ url: "/a", n: 3, who: REDACTED });
  });
});

describe("scrubSpan", () => {
  it("scrubs name and attributes, including object-shaped values", () => {
    const span = {
      name: "GET /api/payment/return?code=z",
      attributes: {
        "url.full": "https://api.biso.no/x?secret=1",
        "http.query": "secret=1",
        "url.query": "secret=1",
        "db.x": "ola@biso.no",
        "db.y": { value: "ola@biso.no", unit: "none" },
        count: 3,
      },
    } as unknown as StreamedSpanJSON;
    const out = scrubSpan(span);
    expect(out.name).toBe("GET /api/payment/return");
    expect(out.attributes["url.full"]).toBe("https://api.biso.no/x");
    expect(out.attributes).not.toHaveProperty("http.query");
    expect(out.attributes).not.toHaveProperty("url.query");
    expect(out.attributes["db.x"]).toBe(REDACTED);
    expect(out.attributes["db.y"]).toEqual({ value: REDACTED, unit: "none" });
    expect(out.attributes.count).toBe(3);
  });
});

describe("scrubMetric", () => {
  it("scrubs string attribute values", () => {
    const metric = {
      name: "m",
      type: "counter",
      value: 1,
      attributes: { who: "ola@biso.no", n: 1 },
    } as Metric;
    expect(scrubMetric(metric).attributes).toEqual({ who: REDACTED, n: 1 });
  });
});
