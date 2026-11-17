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

const throwing = (target: object, key: string) =>
  Object.defineProperty(target, key, {
    enumerable: true,
    get() {
      throw new Error("boom");
    },
  });

describe("fallbacks drop rather than leak", () => {
  it("scrubEvent keeps only identity fields", () => {
    const event = {
      event_id: "e1",
      level: "error",
      message: "secret ola@biso.no",
      user: { id: "u1", email: "a@b.no" },
      breadcrumbs: [{ message: "x" }],
      extra: { k: "v" },
      tags: { app: "web", other: "o" },
    };
    throwing(event, "request");
    const out = scrubEvent(event as unknown as ErrorEvent);
    expect(out).not.toHaveProperty("request");
    expect(out).not.toHaveProperty("user");
    expect(out).not.toHaveProperty("breadcrumbs");
    expect(out).not.toHaveProperty("extra");
    expect(out.event_id).toBe("e1");
    expect(out.tags).toEqual({ app: "web" });
    expect(out.message).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  it("scrubBreadcrumb drops data", () => {
    const crumb = { message: "secret", category: "c" };
    throwing(crumb, "data");
    const out = scrubBreadcrumb(crumb);
    expect(out).toEqual({
      category: "c",
      message: REDACTED,
      type: undefined,
      level: undefined,
      timestamp: undefined,
    });
  });

  it("scrubLog drops attributes", () => {
    const log = { level: "info", message: "secret" };
    throwing(log, "attributes");
    expect(scrubLog(log as Log)).toEqual({ level: "info", message: REDACTED });
  });

  it("scrubSpan drops attributes", () => {
    const span = { name: "secret", trace_id: "t", span_id: "s" };
    throwing(span, "attributes");
    const out = scrubSpan(span as unknown as StreamedSpanJSON);
    expect(out.name).toBe(REDACTED);
    expect(out.attributes).toEqual({});
  });

  it("scrubMetric drops attributes", () => {
    const metric = { name: "m", type: "counter", value: 1 };
    throwing(metric, "attributes");
    const out = scrubMetric(metric as Metric);
    expect(out).not.toHaveProperty("attributes");
    expect(out.name).toBe("m");
  });
});

describe("header scrubbing", () => {
  it("cleans referer, redacts IP headers, keeps benign headers", () => {
    expect(
      redactHeaders({
        referer: "https://biso.no/auth/verify?secret=abc",
        "x-forwarded-for": "1.2.3.4",
        accept: "text/html",
      })
    ).toEqual({
      referer: "https://biso.no/auth/verify",
      "x-forwarded-for": REDACTED,
      accept: "text/html",
    });
  });
});

describe("scrubEvent free-form fields", () => {
  it("scrubs extra, tags, contexts, logentry and drops frame vars", () => {
    const event = {
      extra: { who: "ola@biso.no", nested: { acct: "1234.56.78903" } },
      tags: { q: "x@y.no" },
      contexts: { app: { url: "/a?secret=1" } },
      logentry: { message: "fnr 01019912345" },
      exception: {
        values: [{ stacktrace: { frames: [{ vars: { password: "p" } }] } }],
      },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.extra).toEqual({
      who: REDACTED,
      nested: { acct: REDACTED },
    });
    expect(out.tags).toEqual({ q: REDACTED });
    expect(out.contexts).toEqual({ app: { url: "/a" } });
    expect(out.logentry?.message).toBe("fnr [redacted]");
    expect(
      out.exception?.values?.[0]?.stacktrace?.frames?.[0]
    ).not.toHaveProperty("vars");
  });
});
