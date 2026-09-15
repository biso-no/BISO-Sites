/**
 * Redaction tests.
 *
 * Two layers, tested separately: column stripping (what a projection is allowed
 * to contain at all) and secret scrubbing (a last-resort net over everything
 * that leaves the process).
 */

import { describe, expect, test } from "bun:test";
import { DomainError } from "./errors";
import { createLogger } from "./logger";
import {
  fingerprint,
  redactSecrets,
  redactString,
  stripSensitive,
} from "./redact";
import { toToolError } from "./result";

const UNEXPECTED_ERROR_I_RE = /unexpected error/i;

describe("stripSensitive", () => {
  test("removes payout details from a user row", () => {
    const stripped = stripSensitive("user", {
      $id: "u1",
      name: "Test",
      bank_account: "12345678901",
      swift: "DNBANOKK",
    });
    expect(stripped.name).toBe("Test");
    expect(stripped).not.toHaveProperty("bank_account");
    expect(stripped).not.toHaveProperty("swift");
  });

  test("removes the bank account from an expense", () => {
    const stripped = stripSensitive("expense", {
      $id: "e1",
      total: 100,
      bank_account: "12345678901",
    });
    expect(stripped.total).toBe(100);
    expect(stripped).not.toHaveProperty("bank_account");
  });

  test("removes the approval token hash, which is a bearer credential", () => {
    const stripped = stripSensitive("expense_approvals", {
      $id: "a1",
      status: "pending",
      token_hash: "abc123",
    });
    expect(stripped).not.toHaveProperty("token_hash");
  });

  test("removes varsling recipient addresses", () => {
    const stripped = stripSensitive("varsling_settings", {
      $id: "v1",
      role_name: "HR-sjef",
      email: "someone@biso.no",
    });
    expect(stripped.role_name).toBe("HR-sjef");
    expect(stripped).not.toHaveProperty("email");
  });

  test("applies the wildcard rules to every table", () => {
    const stripped = stripSensitive("anything", {
      $id: "x",
      secret: "s",
      token: "t",
      api_key: "k",
      keep: "yes",
    });
    expect(stripped).toEqual({ $id: "x", keep: "yes" });
  });

  test("leaves an unlisted table's ordinary columns alone", () => {
    const row = { $id: "n1", title: "Hello", status: "published" };
    expect(stripSensitive("news", row)).toEqual(row);
  });
});

describe("redactString", () => {
  test("scrubs a JWT", () => {
    const text =
      "failed with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(redactString(text)).not.toContain("eyJhbGci");
    expect(redactString(text)).toContain("[redacted]");
  });

  test("scrubs an OpenAI-style key", () => {
    expect(redactString("key sk-abcdefghijklmnopqrstuvwx")).toContain(
      "[redacted]"
    );
  });

  test("scrubs a Stripe key", () => {
    expect(redactString("sk_live_abcdefghijklmnop")).toContain("[redacted]");
  });

  test("scrubs an Appwrite key header", () => {
    expect(redactString("X-Appwrite-Key: standard_abc123def456")).toContain(
      "[redacted]"
    );
  });

  test("scrubs a key=value secret", () => {
    expect(redactString("client_secret=supersecretvalue123")).toContain(
      "[redacted]"
    );
  });

  test("leaves ordinary text alone", () => {
    const text = "Published the Oslo welcome event for 2026.";
    expect(redactString(text)).toBe(text);
  });

  test("is stable across repeated calls (global regex lastIndex)", () => {
    const text = "sk-abcdefghijklmnopqrstuvwx";
    expect(redactString(text)).toBe(redactString(text));
  });
});

describe("redactSecrets", () => {
  test("drops keys that name a secret", () => {
    const out = redactSecrets({
      userId: "u1",
      password: "hunter2",
      appwrite_session: "abc",
      bank_account: "123",
      nested: { api_key: "k", safe: 1 },
    }) as Record<string, unknown>;
    expect(out.userId).toBe("u1");
    expect(out.password).toBe("[redacted]");
    expect(out.appwrite_session).toBe("[redacted]");
    expect(out.bank_account).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).api_key).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).safe).toBe(1);
  });

  test("scrubs secret-shaped values inside arrays", () => {
    const out = redactSecrets([
      "ok",
      "sk-abcdefghijklmnopqrstuvwx",
    ]) as string[];
    expect(out[0]).toBe("ok");
    expect(out[1]).toContain("[redacted]");
  });

  test("truncates instead of recursing forever", () => {
    interface Deep {
      next?: Deep;
    }
    const deep: Deep = {};
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) {
      cursor.next = {};
      cursor = cursor.next;
    }
    expect(() => redactSecrets(deep)).not.toThrow();
  });
});

describe("error surfacing", () => {
  test("a DomainError keeps its code, message and remedy", () => {
    const error = new DomainError("forbidden", "You do not manage Bergen.", {
      details: { campusId: "2" },
      remedy: "Ask a campus admin.",
    });
    const surfaced = toToolError(error, "req-1");
    expect(surfaced.error.code).toBe("forbidden");
    expect(surfaced.error.message).toBe("You do not manage Bergen.");
    expect(surfaced.error.remedy).toBe("Ask a campus admin.");
  });

  test("an unexpected error's message is NOT surfaced", () => {
    // An unexpected throw can carry a connection string, a token, or a row the
    // caller may not read, so only a fixed message goes back to the model.
    const error = new Error(
      "connect ECONNREFUSED appwrite-internal.biso.local:8080 key=standard_abc123"
    );
    const surfaced = toToolError(error, "req-1");
    expect(surfaced.error.code).toBe("internal");
    expect(surfaced.error.message).not.toContain("appwrite-internal");
    expect(surfaced.error.message).not.toContain("standard_abc123");
    expect(surfaced.error.message).toMatch(UNEXPECTED_ERROR_I_RE);
  });

  test("DomainError details are redacted on the way out", () => {
    const error = new DomainError("invalid_input", "Bad request", {
      details: { token: "supersecret", field: "slug" },
    });
    const surfaced = toToolError(error, "req-1");
    expect(surfaced.error.details.token).toBe("[redacted]");
    expect(surfaced.error.details.field).toBe("slug");
  });
});

describe("logger", () => {
  test("writes JSON lines with secrets redacted", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "debug",
      write: (line) => lines.push(line),
    });
    logger.info("test", { password: "hunter2", userId: "u1" });
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.userId).toBe("u1");
    expect(parsed.level).toBe("info");
  });

  test("respects the level threshold", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "warn",
      write: (line) => lines.push(line),
    });
    logger.debug("quiet");
    logger.info("also quiet");
    logger.warn("loud");
    expect(lines).toHaveLength(1);
  });

  test("a child logger stamps its bound fields", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "debug",
      write: (line) => lines.push(line),
    }).child({ requestId: "req-1" });
    logger.info("hello");
    expect(JSON.parse(lines[0]).requestId).toBe("req-1");
  });

  test("never throws on an unserialisable value", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "debug",
      write: (line) => lines.push(line),
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => logger.info("cyclic", cyclic)).not.toThrow();
    expect(lines).toHaveLength(1);
  });
});

describe("redaction must not eat legitimate output", () => {
  // Regression: the proposal's own fields were originally named `token` and
  // `authorization`, both of which the key-drop pattern matches, so every
  // proposal came back with the one field the caller has to echo replaced by
  // "[redacted]" — and the failure was silent, because "[redacted]" is truthy.
  test("a proposal survives redaction intact", () => {
    const proposal = {
      proposalId: "p1",
      action: "news.publish",
      proposalToken: "abc123def456",
      expiresAt: "2026-01-01T00:00:00.000Z",
      execution: { mode: "operator", executable: true, reason: "because" },
    };
    const out = redactSecrets(proposal) as Record<string, unknown>;
    expect(out.proposalToken).toBe("abc123def456");
    expect(out.execution).toEqual(proposal.execution);
  });

  test("ordinary domain fields are not mistaken for secrets", () => {
    const row = {
      $id: "news-1",
      title: "Welcome week",
      slug: "welcome-week",
      status: "published",
      campusId: "1",
      requestId: "r-1",
      revision: "2026-01-01T00:00:00.000Z",
    };
    expect(redactSecrets(row)).toEqual(row);
  });
});

describe("fingerprint", () => {
  test("is stable and non-reversible", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc"));
    expect(fingerprint("abc")).not.toBe(fingerprint("abd"));
    expect(fingerprint("abc")).not.toContain("abc");
  });
});
