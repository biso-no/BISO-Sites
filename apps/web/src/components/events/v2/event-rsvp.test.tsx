import type { EventRsvpSummary } from "@repo/shared/utils/event-rsvp";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { count?: number }) =>
    `${key}${values?.count ?? ""}`,
}));
vi.mock("@/app/actions/event-rsvp", () => ({ respondToEvent: vi.fn() }));

import { EventRsvp } from "./event-rsvp";

const summary = (
  overrides: Partial<EventRsvpSummary> = {}
): EventRsvpSummary => ({
  counts: { going: 2, maybe: 1 },
  mine: null,
  open: true,
  ...overrides,
});

const render = (props: Partial<Parameters<typeof EventRsvp>[0]> = {}): string =>
  renderToStaticMarkup(
    <EventRsvp
      canRespond
      eventId="e1"
      hasTicket={false}
      initial={summary()}
      signedIn
      signInHref="/auth/login?redirectTo=%2Fevents%2Fparty"
      {...props}
    />
  );

const BUTTON = /<button/g;
const PRESSED = /aria-pressed="true"/g;
const BUTTON_TAG = /<button[^>]*>/g;
const PRESSED_MAYBE =
  /aria-pressed="true"[^>]*>(?:(?!<\/button>).)*rsvp\.maybe</;

describe("EventRsvp", () => {
  it("signed-in student sees three answers with theirs pressed", () => {
    const html = render({ initial: summary({ mine: "maybe" }) });
    expect(html.match(BUTTON)).toHaveLength(3);
    expect(html.match(PRESSED)).toHaveLength(1);
    expect(html).toMatch(PRESSED_MAYBE);
    expect(html).toContain("rsvp.goingCount2 · rsvp.maybeCount1");
  });

  it("answers are outlined in the action colour, and the chosen one is filled", () => {
    // The first version outlined them in the 1.2:1 edge hairline, and on the
    // card they read as plain text.
    const html = render({ initial: summary({ mine: "going" }) });
    const buttons = html.match(BUTTON_TAG) ?? [];
    expect(buttons).toHaveLength(3);
    for (const tag of buttons) {
      expect(tag).toContain("border-action");
      expect(tag).not.toContain("border-edge");
    }
    expect(buttons.filter((tag) => tag.includes("bg-action"))).toEqual(
      buttons.filter((tag) => tag.includes('aria-pressed="true"'))
    );
  });

  it("signed-out visitor sees the sign-in link", () => {
    const html = render({ canRespond: false, signedIn: false });
    expect(html).toContain('href="/auth/login?redirectTo=%2Fevents%2F');
    expect(html).toContain("rsvp.signIn");
    expect(html).not.toContain("<button");
  });

  it("non-member on a members-only event sees counts only", () => {
    const html = render({ canRespond: false, signedIn: true });
    expect(html).not.toContain("<button");
    expect(html).not.toContain("/auth/login");
    expect(html).toContain("rsvp.goingCount2");
  });

  it("non-member sees no title, and nothing at all without counts", () => {
    const withCounts = render({ canRespond: false, signedIn: true });
    expect(withCounts).not.toContain("rsvp.title");
    const empty = render({
      canRespond: false,
      initial: summary({ counts: { going: 0, maybe: 0 } }),
      signedIn: true,
    });
    expect(empty).toBe("");
  });

  it("ticket hint only on ticketed events", () => {
    expect(render({ hasTicket: true })).toContain("rsvp.ticketHint");
    expect(render({ hasTicket: false })).not.toContain("rsvp.ticketHint");
  });
});
