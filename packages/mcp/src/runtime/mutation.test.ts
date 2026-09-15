/**
 * Mutation gate tests.
 *
 * The properties under test are the ones that make a proposal token meaningful
 * rather than decorative: it binds to one actor, one action, one payload and
 * one revision, it expires, and no configuration makes a restricted operation
 * executable.
 */

import { describe, expect, test } from "bun:test";
import { CAMPUS_ADMIN, GLOBAL_ADMIN } from "../testing/index";
import {
  buildProposalToken,
  createProposal,
  diffFields,
  tierIsExecutable,
  verifyProposalToken,
} from "./mutation";

const NEVER_EXECUTED_I_RE = /never executed/i;
const DOES_NOT_MATCH_I_RE = /does not match/i;
const EXPIRED_I_RE = /expired/i;
const MALFORMED_I_RE = /malformed/i;

const SECRET = "test-server-secret";
const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

const baseToken = {
  serverSecret: SECRET,
  actorId: "user-1",
  action: "news.publish",
  payload: { id: "row-1", status: "published" },
  revision: "2026-01-01T00:00:00.000Z",
  expiresAt: FUTURE,
};

describe("tierIsExecutable", () => {
  const client = { clientSupportsElicitation: true, serverSecret: SECRET };

  test("restricted is never executable, in any write mode", () => {
    for (const writeMode of ["propose", "confirm", "operator"] as const) {
      const decision = tierIsExecutable("restricted", { ...client, writeMode });
      expect(decision.executable).toBe(false);
      expect(decision.reason).toMatch(NEVER_EXECUTED_I_RE);
    }
  });

  test("propose mode executes nothing", () => {
    expect(
      tierIsExecutable("draft", { ...client, writeMode: "propose" }).executable
    ).toBe(false);
    expect(
      tierIsExecutable("publish", { ...client, writeMode: "propose" })
        .executable
    ).toBe(false);
  });

  test("confirm mode needs an elicitation-capable client", () => {
    expect(
      tierIsExecutable("draft", {
        ...client,
        writeMode: "confirm",
        clientSupportsElicitation: false,
      }).executable
    ).toBe(false);
    expect(
      tierIsExecutable("draft", { ...client, writeMode: "confirm" }).executable
    ).toBe(true);
  });

  test("operator mode executes reversible tiers without a prompt", () => {
    expect(
      tierIsExecutable("draft", {
        ...client,
        writeMode: "operator",
        clientSupportsElicitation: false,
      }).executable
    ).toBe(true);
    expect(
      tierIsExecutable("publish", { ...client, writeMode: "operator" })
        .executable
    ).toBe(true);
  });
});

describe("verifyProposalToken", () => {
  test("accepts the exact change it was issued for", () => {
    const token = buildProposalToken(baseToken);
    expect(() => verifyProposalToken({ ...baseToken, token })).not.toThrow();
  });

  test("rejects a different payload", () => {
    const token = buildProposalToken(baseToken);
    expect(() =>
      verifyProposalToken({
        ...baseToken,
        token,
        payload: { id: "row-2", status: "published" },
      })
    ).toThrow(DOES_NOT_MATCH_I_RE);
  });

  test("rejects a different actor", () => {
    // A proposal shown to one user cannot be replayed by another.
    const token = buildProposalToken(baseToken);
    expect(() =>
      verifyProposalToken({ ...baseToken, token, actorId: "user-2" })
    ).toThrow(DOES_NOT_MATCH_I_RE);
  });

  test("rejects a different action", () => {
    const token = buildProposalToken(baseToken);
    expect(() =>
      verifyProposalToken({ ...baseToken, token, action: "news.delete" })
    ).toThrow(DOES_NOT_MATCH_I_RE);
  });

  test("rejects a different revision", () => {
    // The document moved under the proposal.
    const token = buildProposalToken(baseToken);
    expect(() =>
      verifyProposalToken({
        ...baseToken,
        token,
        revision: "2026-06-01T00:00:00.000Z",
      })
    ).toThrow(DOES_NOT_MATCH_I_RE);
  });

  test("rejects an expired proposal", () => {
    const expired = { ...baseToken, expiresAt: PAST };
    const token = buildProposalToken(expired);
    expect(() => verifyProposalToken({ ...expired, token })).toThrow(
      EXPIRED_I_RE
    );
  });

  test("rejects a token from a different server secret", () => {
    const token = buildProposalToken({
      ...baseToken,
      serverSecret: "some-other-secret",
    });
    expect(() => verifyProposalToken({ ...baseToken, token })).toThrow(
      DOES_NOT_MATCH_I_RE
    );
  });

  test("rejects a fabricated token", () => {
    expect(() =>
      verifyProposalToken({ ...baseToken, token: "not-a-real-token" })
    ).toThrow(DOES_NOT_MATCH_I_RE);
  });

  test("rejects a malformed expiry", () => {
    expect(() =>
      verifyProposalToken({
        ...baseToken,
        token: "anything",
        expiresAt: "not-a-date",
      })
    ).toThrow(MALFORMED_I_RE);
  });
});

describe("createProposal", () => {
  const options = {
    writeMode: "operator" as const,
    serverSecret: SECRET,
    clientSupportsElicitation: false,
  };

  test("produces a token that verifies against its own inputs", () => {
    const proposal = createProposal({
      action: "news.publish",
      tier: "publish",
      targets: [{ table: "news", id: "row-1" }],
      payload: { id: "row-1" },
      revision: "rev-1",
      principal: GLOBAL_ADMIN(),
      options,
    });
    expect(() =>
      verifyProposalToken({
        token: proposal.proposalToken,
        serverSecret: SECRET,
        actorId: GLOBAL_ADMIN().userId,
        action: "news.publish",
        payload: { id: "row-1" },
        revision: "rev-1",
        expiresAt: proposal.expiresAt,
      })
    ).not.toThrow();
  });

  test("two principals get different tokens for the same change", () => {
    const shared = {
      action: "news.publish",
      tier: "publish" as const,
      targets: [{ table: "news", id: "row-1" }],
      payload: { id: "row-1" },
      revision: "rev-1",
      options,
      now: new Date("2026-01-01T00:00:00.000Z"),
    };
    const a = createProposal({ ...shared, principal: GLOBAL_ADMIN() });
    const b = createProposal({ ...shared, principal: CAMPUS_ADMIN() });
    expect(a.proposalToken).not.toBe(b.proposalToken);
  });

  test("a restricted proposal reports itself as not executable", () => {
    const proposal = createProposal({
      action: "orders.refund",
      tier: "restricted",
      targets: [{ table: "orders", id: "order-1" }],
      payload: { amount: 100 },
      revision: null,
      principal: GLOBAL_ADMIN(),
      options,
    });
    expect(proposal.execution.executable).toBe(false);
  });
});

describe("diffFields", () => {
  test("reports only the keys present in the new value", () => {
    expect(diffFields({ a: 1, b: 2, c: 3 }, { a: 1, b: 99 })).toEqual([
      { path: "b", before: 2, after: 99 },
    ]);
  });

  test("handles a create, where there is no before", () => {
    expect(diffFields(null, { a: 1 })).toEqual([
      { path: "a", before: null, after: 1 },
    ]);
  });
});
