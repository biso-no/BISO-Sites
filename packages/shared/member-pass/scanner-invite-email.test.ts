import { describe, expect, it } from "vitest";
import { buildScannerInviteEmail } from "./scanner-invite-email";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.biso.no";
const IOS_URL = "https://apps.apple.com/no/app/biso/id123";

const base = {
  androidUrl: PLAY_URL,
  campusName: "Oslo",
  email: "guard@example.com",
  expiresAt: new Date("2026-10-01T21:59:00.000Z"),
  inviterName: "Kari Nordmann",
  iosUrl: IOS_URL,
};

describe("buildScannerInviteEmail", () => {
  it("writes Norwegian first, then English", () => {
    const { subject, text } = buildScannerInviteEmail(base);
    expect(subject).toContain("BISO");
    const norwegian = text.indexOf("Hei");
    const english = text.indexOf("Hi");
    expect(norwegian).toBeGreaterThanOrEqual(0);
    expect(english).toBeGreaterThan(norwegian);
  });

  it("names the inviter, campus, end date and sign-in address", () => {
    const { html, text } = buildScannerInviteEmail(base);
    for (const part of [text, html]) {
      expect(part).toContain("Kari Nordmann");
      expect(part).toContain("Oslo");
      expect(part).toContain("guard@example.com");
      expect(part).toContain("1. oktober 2026");
      expect(part).toContain("1 October 2026");
      expect(part).toContain("Scan memberships");
    }
  });

  it("links both app stores", () => {
    const { html, text } = buildScannerInviteEmail(base);
    expect(text).toContain(IOS_URL);
    expect(text).toContain(PLAY_URL);
    expect(html).toContain(`href="${IOS_URL}"`);
    expect(html).toContain(`href="${PLAY_URL}"`);
  });

  it("tells the reader to search the App Store when there is no iOS link", () => {
    const { html, text } = buildScannerInviteEmail({ ...base, iosUrl: null });
    expect(text).not.toContain("apps.apple.com");
    expect(html).not.toContain("apps.apple.com");
    expect(text).toContain('Søk etter "BISO" i App Store');
    expect(text).toContain('Search for "BISO" in the App Store');
    expect(html).toContain("BISO");
    expect(text).toContain(PLAY_URL);
  });

  it("describes access to all campuses and no end date", () => {
    const { text } = buildScannerInviteEmail({
      ...base,
      campusName: null,
      expiresAt: null,
    });
    expect(text).toContain("alle campuser");
    expect(text).toContain("all campuses");
    expect(text).not.toContain("oktober");
    expect(text).not.toContain("October");
  });

  it("mentions revocation and that no student numbers or emails are shown", () => {
    const { text } = buildScannerInviteEmail(base);
    expect(text).toContain("trekkes tilbake");
    expect(text).toContain("revoked at any time");
    expect(text).toContain("student numbers");
  });

  it("escapes every interpolated value in the HTML", () => {
    const { html } = buildScannerInviteEmail({
      androidUrl: 'https://play.example/"><script>x</script>',
      campusName: "<b>Campus</b>",
      email: "a&b@example.com",
      expiresAt: null,
      inviterName: "<img src=x onerror=alert(1)>",
      iosUrl: "https://ios.example/?a=1&b=<2>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Campus");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;Campus&lt;/b&gt;");
    expect(html).toContain("a&amp;b@example.com");
    expect(html).toContain('href="https://ios.example/?a=1&amp;b=&lt;2&gt;"');
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("drops a store link that is not http(s)", () => {
    const { html, text } = buildScannerInviteEmail({
      ...base,
      iosUrl: "javascript:alert(1)",
    });
    expect(html).not.toContain("javascript:");
    expect(text).not.toContain("javascript:");
    expect(text).toContain('Search for "BISO" in the App Store');
  });
});
