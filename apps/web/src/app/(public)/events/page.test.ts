import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LIST_EVENTS_CALL_PATTERN = /listEvents\(\{[\s\S]*?\}\);/;
const IS_MEMBER_ARGUMENT_PATTERN = /isMember:\s*membership\.isMember/;

/**
 * Source-level guard for the member-only regression (Task 8 fix round 1,
 * finding 1): `listEvents`/`queryEvents` default `isMember` to `false`, and
 * this page is the one surface that already resolves the visitor's real
 * membership status (`getMembershipStatus()`) a few lines above the fetch.
 * Forgetting to thread that value into `listEvents` silently hides
 * member-only events from members — with no type error, since `isMember` is
 * optional. A unit test against `listEvents` in isolation can't catch a
 * missing argument at a specific call site, so this asserts against the
 * actual call in `page.tsx` instead: it fails if the argument is ever
 * deleted, renamed, or hardcoded back to a constant.
 */
describe("(public)/events/page.tsx wiring", () => {
  it("passes the resolved membership status into listEvents, not the default", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    const call = source.match(LIST_EVENTS_CALL_PATTERN);
    expect(
      call,
      "expected a listEvents({...}) call in page.tsx"
    ).not.toBeNull();

    // Must reference the membership status resolved above via
    // getMembershipStatus(), not just any `isMember` identifier — e.g. a
    // hardcoded `isMember: false` would match a looser pattern and stay
    // broken.
    expect(call?.[0]).toMatch(IS_MEMBER_ARGUMENT_PATTERN);
  });
});
