import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) =>
  readFileSync(join(import.meta.dir, path), "utf8");

describe("consent bar answer", () => {
  // `chooseReplayConsent` applies a "no" before saving it (tested in
  // @repo/observability), so a failed save still stops recording.
  test("is saved and applied through chooseReplayConsent", () => {
    expect(read("replay-consent.tsx")).toContain(
      'chooseReplayConsent("admin", choice, setReplayConsent)'
    );
  });
});

/** A `<ReplayConsent …/>` mount, its props captured. */
const MOUNT = /isSentryConfigured\(\) && <ReplayConsent([^/>]*)\/>/g;

const mountsIn = (layout: string): string[] =>
  [...read(layout).matchAll(MOUNT)].map((match) => (match[1] ?? "").trim());

describe("where the consent bar is mounted", () => {
  test("the wrapper passes reserveBodySpace through, padding the body by default", () => {
    const wrapper = read("replay-consent.tsx");
    expect(wrapper).toContain("reserveBodySpace = true");
    expect(wrapper).toContain("reserveBodySpace={reserveBodySpace}");
  });

  test("not by the root layout, so no page gets two bars", () => {
    expect(read("../app/layout.tsx")).not.toContain("<ReplayConsent");
  });

  test.each([
    ["(portal)", "reserveBodySpace={false}"],
    ["(editor)", "reserveBodySpace={false}"],
    ["(auth)", ""],
    ["(protected)", ""],
  ])("once by the %s layout with %p", (group, props) => {
    expect(mountsIn(`../app/${group}/layout.tsx`)).toEqual([props]);
  });

  // The guest scanner is never recorded (REPLAY_DENYLIST), so it doesn't ask.
  test("not on the guest scanner", () => {
    expect(read("../app/(scan)/scan/[token]/page.tsx")).not.toContain(
      "ReplayConsent"
    );
  });

  test("the portal's inner scroller reserves the bar height", () => {
    expect(read("../app/(portal)/_components/admin-shell.tsx")).toContain(
      "pb-[var(--replay-consent-bar-height,0px)]"
    );
  });
});
