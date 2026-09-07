import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Terminates on the first `})` sitting alone at the start of a line, which is
// how the multi-line call closes. The previous shape required `});` — a
// sequence this file has never contained, so the guard silently matched
// nothing and let the member-only regression through unnoticed.
const LIST_EVENTS_CALL_PATTERN = /listEvents\(\{[\s\S]*?^\s*\}\)/m;
const IS_MEMBER_PATTERN = /isMember/;
const FACETS_IS_MEMBER_PATTERN = /listEventFacets\(\{[^}]*isMember/;
const MEMBERSHIP_STATUS_PATTERN = /getMembershipStatus\(\)/;
const IS_MEMBER_PROP_PATTERN = /isMember=\{isMember\}/;

/**
 * Source-level guard for the two halves of the member-only rule, which a unit
 * test against `listEvents` in isolation cannot check at a specific call site.
 *
 * 1. The listing must NOT narrow its fetch by membership. Member-only events
 *    are listed to everyone and labelled instead — filtering them out here is
 *    the bug students reported (visible on the home page, missing from
 *    `/events`).
 * 2. The resolved membership status must still reach the client component,
 *    because it drives presentation: member pricing on the cards and whether
 *    the members-only notice reads "join to take part" or "your membership
 *    covers this".
 */
describe("(public)/events/page.tsx wiring", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  it("does not scope the events fetch by membership", () => {
    const call = source.match(LIST_EVENTS_CALL_PATTERN);
    expect(
      call,
      "expected a listEvents({...}) call in page.tsx"
    ).not.toBeNull();

    expect(call?.[0]).not.toMatch(IS_MEMBER_PATTERN);
    expect(source).not.toMatch(FACETS_IS_MEMBER_PATTERN);
  });

  it("still threads membership into the list client for pricing and copy", () => {
    expect(source).toMatch(MEMBERSHIP_STATUS_PATTERN);
    expect(source).toMatch(IS_MEMBER_PROP_PATTERN);
  });
});
