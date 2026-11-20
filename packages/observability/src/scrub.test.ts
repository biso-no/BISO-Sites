import type { ErrorEvent, Log, Metric, StreamedSpanJSON } from "@sentry/core";
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_PATH_PATTERNS,
  REDACTED,
  redactHeaders,
  SENSITIVE_HEADERS,
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

  it("redacts IBANs with and without spaces", () => {
    expect(scrubText("NO9386011117947")).toBe(REDACTED);
    expect(scrubText("iban NO93 8601 1117 947 avvist")).toBe(
      "iban [redacted] avvist"
    );
    expect(scrubText("DE89 3704 0044 0532 0130 00")).toBe(REDACTED);
    expect(scrubText("DE89370400440532013000")).toBe(REDACTED);
    expect(scrubText("GB29 NWBK 6016 1331 9268 19")).toBe(REDACTED);
  });

  it("keeps ids, order numbers and status codes that look nothing like an IBAN", () => {
    expect(scrubText("row 6745a1b2c3d4e5f6a7b8")).toBe(
      "row 6745a1b2c3d4e5f6a7b8"
    );
    expect(scrubText("ORDER-2026-0001")).toBe("ORDER-2026-0001");
    expect(scrubText("HTTP 504 from upstream")).toBe("HTTP 504 from upstream");
    expect(scrubText("NO93 is a prefix")).toBe("NO93 is a prefix");
  });

  it("drops the query and fragment of absolute URLs inside text", () => {
    expect(
      scrubText(
        "fetch https://biso.no/auth/verify?secret=abc&userId=u1 failed (504)"
      )
    ).toBe("fetch https://biso.no/auth/verify failed (504)");
    expect(scrubText("open http://localhost:3000/x#token=t now")).toBe(
      "open http://localhost:3000/x now"
    );
    expect(scrubText("see https://biso.no/events")).toBe(
      "see https://biso.no/events"
    );
  });

  it("redacts secret-looking key=value pairs", () => {
    expect(scrubText("/auth/verify?secret=abc&userId=u1&lang=no")).toBe(
      "/auth/verify?secret=[redacted]&userId=[redacted]&lang=no"
    );
    expect(scrubText("code=xyz state=s1 token=t password=hunter2")).toBe(
      "code=[redacted] state=[redacted] token=[redacted] password=[redacted]"
    );
    // The value runs to the next space, &, quote or #: a comma could be part
    // of a password, so it is redacted too.
    expect(scrubText("got access_token=abc, client_secret=d,e f")).toBe(
      "got access_token=[redacted] client_secret=[redacted] f"
    );
    expect(scrubText("USERID=u1")).toBe("USERID=[redacted]");
  });

  it("redacts multi-part keys ending in a secret word", () => {
    expect(
      scrubText(
        "oauth_token_secret=abc x_client_secret=abc client-secret=abc refresh_token=abc"
      )
    ).toBe(
      "oauth_token_secret=[redacted] x_client_secret=[redacted] client-secret=[redacted] refresh_token=[redacted]"
    );
    expect(scrubText("description=abc")).toBe("description=abc");
  });

  it("exports the sensitive header names", () => {
    expect(SENSITIVE_HEADERS.has("authorization")).toBe(true);
    expect(SENSITIVE_HEADERS.has("x-appwrite-key")).toBe(true);
  });

  it("keeps pairs whose key only ends in a secret word", () => {
    expect(scrubText("statusCode=500 postcode=0484")).toBe(
      "statusCode=500 postcode=0484"
    );
  });

  it.each([
    ["hyphen runs", ` ${"ab-".repeat(70_000)}`],
    ["dot runs", `a${".a".repeat(100_000)}`],
    ["an address with a hyphen-run domain", `a@${"a-".repeat(100_000)}`],
    ["repeated URL schemes", "https://".repeat(25_000)],
    ["a hyphenated key prefix", `${"a-".repeat(100_000)}token=x`],
    ["plus runs", `${"a+".repeat(100_000)}b`],
    ["encoded space runs", `a${"%20a".repeat(66_000)}`],
    ["bare plus signs", "+".repeat(200_000)],
    ["bare encoded spaces", "%20".repeat(66_000)],
    ["bare encoded at signs", "%40".repeat(66_000)],
    ["encoded at-sign runs", `a${"%40a".repeat(50_000)}`],
    ["lower-case encoded plus runs", `a${"%2ba".repeat(50_000)}`],
    ["encoded addresses without a dot", `${"a%40b ".repeat(30_000)}`],
    ["encoded plus signs before encoded at signs", "%2ba%40b".repeat(25_000)],
  ])("scrubs 200 KB of %s in well under 50 ms", (_label, text) => {
    const started = performance.now();
    scrubText(text);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it.each([
    [
      "body=Hello+my+name+is+Kari+and+I+need+a+refund+for+my+order+please+contact+kari.nordmann@biso.no",
      "kari.nordmann@biso.no",
    ],
    [
      "msg=Message%20from%20the%20student%20about%20the%20refund%20for%20ola.nordmann@biso.no",
      "ola.nordmann@biso.no",
    ],
    ["to=a%2Bb.c@biso.no&x=1", "c@biso.no"],
  ])("redacts an address in encoded text: %s", (text, address) => {
    expect(scrubText(text)).not.toContain(address);
  });

  // Form bodies and query strings as the browser encodes them: `@` becomes
  // `%40`, and the hex may be lower-case.
  it.each([
    [
      new URLSearchParams({
        body: "Please contact kari.nordmann@biso.no about my refund",
      }).toString(),
      "kari.nordmann",
    ],
    [
      `msg=${encodeURIComponent("Message from ola.nordmann@biso.no")}`,
      "ola.nordmann",
    ],
    ["to=a%2bb.c%40biso.no&x=1", "c%40biso.no"],
    ["to=a%2bb.c%40biso.no&x=1", "b.c"],
    ["q=kari%40BISO.NO", "kari"],
  ])("redacts a percent-encoded address: %s", (text, part) => {
    const scrubbed = scrubText(text);
    expect(scrubbed).not.toContain(part);
    expect(scrubbed).toContain(REDACTED);
  });

  // `+` is a local-part character, so the words joined to the address before
  // it go too; the text after it stays.
  it("keeps the text after a percent-encoded address", () => {
    expect(
      scrubText(
        new URLSearchParams({
          body: "Please contact kari.nordmann@biso.no about my refund",
        }).toString()
      )
    ).toBe(`body=${REDACTED}+about+my+refund`);
  });

  it("still redacts the longest real address and a long key prefix", () => {
    const local = "a".repeat(64);
    expect(scrubText(`to ${local}@student.bi.no`)).toBe("to [redacted]");
    expect(scrubText("a_b_c_d_e_f_token=t")).toBe(
      "a_b_c_d_e_f_token=[redacted]"
    );
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

// Links that work without signing in: the path segment is the key.
describe("capability links", () => {
  it.each([
    [
      "https://biso.no/fs/approve/abc123?x=1",
      "https://biso.no/fs/approve/[redacted]",
    ],
    ["/fs/approve/abc123?intent=approve", "/fs/approve/[redacted]"],
    [
      "https://biso.no/recruitment/book/tok_1-2.x",
      "https://biso.no/recruitment/book/[redacted]",
    ],
    ["/recruitment/book/tok123#slot", "/recruitment/book/[redacted]"],
    [
      "https://admin.biso.no/scan/tok123",
      "https://admin.biso.no/scan/[redacted]",
    ],
    [
      "http://localhost:3001/scan/tok123?_rsc=1",
      "http://localhost:3001/scan/[redacted]",
    ],
    ["/scan/tok123", "/scan/[redacted]"],
    [
      "https://biso.no/shop/order/6745a1b2c3d4?success=true",
      "https://biso.no/shop/order/[redacted]",
    ],
    ["/shop/order/6745a1b2c3d4", "/shop/order/[redacted]"],
    // The rest of the path stays, and so does the spelling of the route.
    ["/fs/approve/abc%2Fdef/receipt", "/fs/approve/[redacted]/receipt"],
    ["/FS/Approve/abc123", "/FS/Approve/[redacted]"],
    // Sign-in links carry their secret in the query.
    [
      "https://biso.no/auth/verify?userId=u1&secret=s1",
      "https://biso.no/auth/verify",
    ],
    ["/auth/verify?userId=u1&secret=s1", "/auth/verify"],
  ])("scrubUrl(%s) is %s", (url, expected) => {
    expect(scrubUrl(url)).toBe(expected);
  });

  it.each([
    "/events/123",
    "https://biso.no/events/123",
    "https://biso.no/news/students-2026",
    // Signed-in pages whose path only contains a capability route's name.
    "https://admin.biso.no/members/scan/access",
    "/members/scan/links",
    "/shop/orders/6745a1b2c3d4",
    "/fs/6745a1b2c3d4",
    "/fs/approve",
    "/scanner",
    // Next's route templates, as stack frames and route names show them.
    "/scan/[token]",
    "/app/apps/admin/.next/server/app/(scan)/scan/[token]/page.js",
    "https://biso.no/_next/static/chunks/app/(public)/fs/approve/%5Btoken%5D/page.js",
  ])("scrubUrl keeps %s", (url) => {
    expect(scrubUrl(url)).toBe(url);
  });

  it("redacts capability links inside text", () => {
    expect(scrubText("GET /fs/approve/abc123 failed")).toBe(
      "GET /fs/approve/[redacted] failed"
    );
    expect(
      scrubText(
        "fetch https://biso.no/recruitment/book/tok123?x=1 failed (504)"
      )
    ).toBe("fetch https://biso.no/recruitment/book/[redacted] failed (504)");
    expect(scrubText('{"to":"/scan/tok123","from":"/shop/order/o1"}')).toBe(
      '{"to":"/scan/[redacted]","from":"/shop/order/[redacted]"}'
    );
    expect(scrubText("redirectTo=/fs/approve/abc123&x=1")).toBe(
      "redirectTo=/fs/approve/[redacted]"
    );
    expect(scrubText("scrubbed /scan/[redacted] stays")).toBe(
      "scrubbed /scan/[redacted] stays"
    );
  });

  it("redacts them in events, breadcrumbs, spans and logs", () => {
    const event = scrubEvent({
      type: undefined,
      transaction: "/fs/approve/abc123",
      request: { url: "https://biso.no/fs/approve/abc123?intent=approve" },
      exception: {
        values: [{ value: "Not found: /recruitment/book/tok123" }],
      },
      breadcrumbs: [
        {
          category: "navigation",
          data: { from: "/fs/approve/abc123", to: "/events" },
        },
      ],
    } as unknown as ErrorEvent);
    expect(event.transaction).toBe("/fs/approve/[redacted]");
    expect(event.request?.url).toBe("https://biso.no/fs/approve/[redacted]");
    expect(event.exception?.values?.[0]?.value).toBe(
      "Not found: /recruitment/book/[redacted]"
    );
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      from: "/fs/approve/[redacted]",
      to: "/events",
    });

    const span = scrubSpan({
      name: "GET /scan/tok123",
      attributes: { "url.full": "https://admin.biso.no/scan/tok123" },
    } as unknown as StreamedSpanJSON);
    expect(span.name).toBe("GET /scan/[redacted]");
    expect(span.attributes["url.full"]).toBe(
      "https://admin.biso.no/scan/[redacted]"
    );

    const log = scrubLog({
      level: "warn",
      message: "order page failed for /shop/order/o1",
      attributes: { path: "/shop/order/o1" },
    } as Log);
    expect(String(log.message)).toBe(
      "order page failed for /shop/order/[redacted]"
    );
    expect(log.attributes).toEqual({ path: "/shop/order/[redacted]" });
  });

  it("has one pattern per capability route", () => {
    expect(CAPABILITY_PATH_PATTERNS).toHaveLength(4);
  });

  it.each([
    ["capability route runs", "/scan/".repeat(35_000)],
    ["capability links", "/fs/approve/a".repeat(15_000)],
    ["double slashes", "//".repeat(100_000)],
    ["a long host after a double slash", `//${"a".repeat(200_000)}`],
    ["double-slash hosts", "//a".repeat(66_000)],
  ])("scrubs 200 KB of %s in well under 50 ms", (_label, text) => {
    const started = performance.now();
    scrubText(text);
    expect(performance.now() - started).toBeLessThan(50);
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

describe("scrubEvent AI errors", () => {
  it("keeps only the type of AI SDK exceptions, whose messages quote model output", () => {
    const event = {
      exception: {
        values: [
          {
            type: "AI_TypeValidationError",
            value:
              'Type validation failed: Value: {"summary":"Kari Nordmann"}.',
          },
          { type: "NoObjectGeneratedError", value: "No object: Kari" },
          { type: "TypeError", value: "bad input from ola@biso.no" },
        ],
      },
    } as unknown as ErrorEvent;
    const values = scrubEvent(event).exception?.values;
    expect(values?.map((value) => value.value)).toEqual([
      "AI_TypeValidationError",
      "NoObjectGeneratedError",
      "bad input from [redacted]",
    ]);
  });
});

describe("key-aware scrubbing", () => {
  it("redacts credential and IP keys and cleans path, url and referer keys", () => {
    const event = {
      extra: {
        request: {
          headers: {
            Cookie: "a=b",
            "set-cookie": ["s=1", "t=2"],
            "X-Forwarded-For": "84.215.12.34",
            forwarded: "for=84.215.12.34",
            referer: "https://biso.no/x?userId=u1",
            accept: "text/html",
          },
          path: "/auth/verify?secret=abc",
          cookie: { session: "s" },
        },
        "url.path": "/a?b=c",
      },
    } as unknown as ErrorEvent;
    expect(scrubEvent(event).extra).toEqual({
      request: {
        headers: {
          Cookie: REDACTED,
          "set-cookie": [REDACTED, REDACTED],
          "X-Forwarded-For": REDACTED,
          forwarded: REDACTED,
          referer: "https://biso.no/x",
          accept: "text/html",
        },
        path: "/auth/verify",
        cookie: REDACTED,
      },
      "url.path": "/a",
    });
  });

  it("keeps an attribute object's shape under a credential key", () => {
    const metric = {
      name: "m",
      type: "counter",
      value: 1,
      attributes: { authorization: { value: "Bearer t", type: "string" } },
    } as unknown as Metric;
    expect(scrubMetric(metric).attributes).toEqual({
      authorization: { value: REDACTED, type: "string" },
    });
  });
});

describe("scrubBreadcrumb", () => {
  // The SDK writes both pages of a navigation as relative paths, query and
  // all, so they are scrubbed as addresses.
  it("scrubs both addresses of a navigation", () => {
    const out = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/events?q=Kari+Nordmann", to: "/fs/approve/tok?x=1" },
    });
    expect(out.data).toEqual({
      from: "/events",
      to: "/fs/approve/[redacted]",
    });
  });

  it("leaves from and to of other breadcrumbs to text scrubbing", () => {
    const out = scrubBreadcrumb({
      category: "mail",
      data: { from: "Kari? Hi", to: "Hi? kari@biso.no" },
    });
    expect(out.data).toEqual({ from: "Kari? Hi", to: `Hi? ${REDACTED}` });
  });

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

describe("scrubLog console lines", () => {
  const consoleLog = (message: string): Log =>
    ({
      level: "error",
      message,
      attributes: { "sentry.origin": "auto.log.console" },
    }) as Log;

  it("scrubs 200 KB of unclosed JSON openers in well under 50 ms", () => {
    const started = performance.now();
    scrubLog(consoleLog(" [".repeat(100_000)));
    expect(performance.now() - started).toBeLessThan(50);
  });

  it("leaves a plain console line to scrubText", () => {
    expect(scrubLog(consoleLog("sync failed for ola@biso.no")).message).toBe(
      "sync failed for [redacted]"
    );
  });

  it("re-renders a JSON argument after a string, keeping invalid JSON as text", () => {
    const out = scrubLog(
      consoleLog(
        'failed %s {"name":"AI_RetryError","message":"Kari","stack":"s"} {not json'
      )
    );
    expect(out.message).toBe("failed %s AI_RetryError {not json");
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

  it("scrubs every key of an object that has a value key", () => {
    const span = {
      name: "s",
      attributes: {
        "db.x": { value: "a@b.no", extra: "c@d.no", unit: "none" },
        "url.full": { value: "https://biso.no/x?secret=1", type: "string" },
      },
    } as unknown as StreamedSpanJSON;
    const out = scrubSpan(span);
    expect(out.attributes["db.x"]).toEqual({
      value: REDACTED,
      extra: REDACTED,
      unit: "none",
    });
    expect(out.attributes["url.full"]).toEqual({
      value: "https://biso.no/x",
      type: "string",
    });
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

  it("drops the query from stack frame paths and scrubs them", () => {
    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://biso.no/_next/static/chunks/a.js?dpl=1&token=t",
                  abs_path: "https://biso.no/u/ola@biso.no/b.js#x",
                  function: "go",
                  lineno: 3,
                },
                { function: "native" },
              ],
            },
          },
        ],
      },
    } as unknown as ErrorEvent;
    const frames = scrubEvent(event).exception?.values?.[0]?.stacktrace?.frames;
    expect(frames?.[0]).toEqual({
      filename: "https://biso.no/_next/static/chunks/a.js",
      abs_path: "https://biso.no/u/[redacted]/b.js",
      function: "go",
      lineno: 3,
    });
    expect(frames?.[1]).toEqual({ function: "native" });
  });
});
