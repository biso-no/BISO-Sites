import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const root = process.cwd();
const AUTH = join(root, "src/app/(auth)");
const SRC = join(root, "src");
const MESSAGES = join(root, "../../packages/i18n/messages");

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const authFile = (rel: string) => readFileSync(join(AUTH, rel), "utf8");
/** Comments name the things they replaced; strip them before asserting absence. */
const authCode = (rel: string) => codeOnly(authFile(rel));

/**
 * RD-029 — the login page.
 *
 * `(auth)` is the only route group that renders outside `SiteShell`, and the
 * three route handlers beside the page are the session machinery. Neither may
 * move.
 */
describe("(auth) stays outside the site shell", () => {
  it("renders its own <main> and nothing else", () => {
    const layout = authCode("layout.tsx");
    expect(layout).toContain("<main>");
    expect(layout).not.toContain("SiteShell");
    expect(layout).not.toContain("Providers");
  });

  it("the login page adds no chrome of its own", () => {
    const page = authCode("auth/login/page.tsx");
    expect(page).not.toContain("<Section");
    expect(page).not.toContain("PageHeader");
  });
});

describe("the session machinery is untouched", () => {
  it.each([
    "auth/callback/route.ts",
    "auth/oauth/route.ts",
    "auth/invite/route.ts",
  ])("%s still writes SESSION_COOKIE and expires the legacy one", (file) => {
    const source = authFile(file);
    expect(source).toContain("SESSION_COOKIE");
    expect(source).toContain("LEGACY_SESSION_COOKIE");
    // The cookie name itself lives in one place and must stay
    // `a_session_biso_web` — never `a_session_biso`, which is byte-for-byte
    // the cookie Appwrite issues for project `biso` and broke admin sign-in
    // with 409 user_already_exists.
    expect(source).not.toContain('"a_session_biso"');
  });

  it("keeps the cookie names where they are defined", () => {
    const prefs = read("lib/cookie-prefs.ts");
    expect(prefs).toContain("a_session_biso_web");
  });
});

describe("the post-login redirect", () => {
  it("passes every candidate through safeRedirectPath", () => {
    const page = authFile("auth/login/page.tsx");
    expect(page).toContain("safeRedirectPath(redirectTo)");
    for (const file of ["auth/callback/route.ts", "auth/oauth/route.ts"]) {
      expect(authFile(file)).toContain("safeRedirectPath(");
    }
  });

  it("only renders error codes the handlers actually emit", () => {
    // Anything else — including an attacker-supplied ?error= — is ignored, so
    // the on-screen copy can never be attacker-controlled.
    const page = authFile("auth/login/page.tsx");
    expect(page).toContain("LOGIN_ERROR_CODES");
    expect(page).toContain("isKnownErrorCode");
  });
});

describe("the login card", () => {
  const login = read("components/login.tsx");

  it("names every provider button", () => {
    // Each was a bare <svg> inside a <button>: three unlabelled controls.
    expect(login).toContain("aria-label={t(");
    expect(login).toContain('aria-hidden="true"');
    for (const provider of ["Google", "Facebook", "Apple"]) {
      expect(login).toContain(`label: "${provider}"`);
    }
  });

  it("surfaces a provider failure instead of swallowing it", () => {
    // Facebook's `createOAuth2Token` is answered by Appwrite with
    // "Invalid redirect" today, and the click did nothing at all.
    expect(login).toContain("handleProviderLogin");
    expect(login).toContain('t("signInFailed")');
  });

  it("keeps the logo off the client runtime", () => {
    const code = codeOnly(login);
    expect(code).not.toContain("useTheme");
    expect(code).not.toContain("mounted");
    expect(code).toContain("dark:hidden");
    expect(code).toContain("dark:block");
  });

  it("links privacy internally", () => {
    // Was an absolute https://biso.no/privacy with target="_blank", so every
    // non-production environment sent people to the live site.
    const code = codeOnly(login);
    expect(code).not.toContain("https://biso.no/privacy");
    expect(code).not.toContain('target="_blank"');
    expect(code).toContain('href="/privacy"');
  });

  it("guards the magic-link form both ways", () => {
    expect(login).toContain("required");
    expect(login).toContain('type="email"');
    expect(login).toContain('t("emailRequired")');
  });
});

describe("the login copy is translated", () => {
  it.each(["no", "en"])("common.auth exists in %s", (locale) => {
    const common = JSON.parse(
      readFileSync(join(MESSAGES, locale, "common.json"), "utf8")
    );
    const auth = common.auth as Record<string, unknown>;
    expect(auth).toBeDefined();
    for (const key of [
      "welcomeBack",
      "signInSubtitle",
      "emailLabel",
      "sendLink",
      "orContinueWith",
      "continueWith",
      "signInFailed",
      "privacyPolicy",
      "copyright",
    ]) {
      expect(auth[key]).toBeTruthy();
    }
    // The four codes the callback handlers emit each need a message.
    for (const code of [
      "invalid_parameters",
      "invitation_failed",
      "server_configuration",
      "unexpected_error",
    ]) {
      expect((auth.errors as Record<string, string>)[code]).toBeTruthy();
    }
  });

  it("no longer hardcodes English in the component", () => {
    const code = codeOnly(read("components/login.tsx"));
    expect(code).not.toContain("Welcome Back");
    expect(code).not.toContain("Send Login Link");
    expect(code).not.toContain("Or continue with");
  });
});
