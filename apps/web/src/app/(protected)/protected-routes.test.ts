import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const root = process.cwd();
const PROTECTED = join(root, "src/app/(protected)");
const SRC = join(root, "src");

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const page = (dir: string) =>
  readFileSync(join(PROTECTED, dir, "page.tsx"), "utf8");

/**
 * RD-028 — account and protected routes.
 *
 * The gate is the thing that must not move: everything here is behind
 * `(protected)/layout.tsx`, and a restyle that loosens it would expose one
 * person's reimbursements and applications to another.
 */
describe("the auth gate is intact", () => {
  const layout = readFileSync(join(PROTECTED, "layout.tsx"), "utf8");

  it("refuses a signed-out visitor", () => {
    expect(layout).toContain("unauthorized()");
    expect(layout).toContain("if (!userData)");
  });

  it("sends a user with no profile to onboarding", () => {
    expect(layout).toContain('redirect("/onboarding?required=1")');
  });

  it("still opts the segment out of instant navigation", () => {
    // Auth reads the session on every request; the shell must not be served
    // from a prerender that predates the gate.
    expect(layout).toContain("export const instant = false");
  });

  it("keeps the site chrome, so these routes are not dead ends", () => {
    expect(layout).toContain("<SiteShell>");
  });
});

describe("the reimbursements kill switch still works", () => {
  const fs = page("fs");
  const fsNew = page("fs/new");

  it("gates the list on expenses_module", () => {
    expect(fs).toContain('isFeatureEnabled("expenses_module")');
    expect(fs).toContain("<ExpensesUnavailable />");
  });

  it("gates the composer on the same flag", () => {
    expect(fsNew).toContain("flags.expenses_module");
    expect(fsNew).toContain("<ExpensesUnavailable />");
  });

  it("gives the unavailable state a heading of its own", () => {
    // It replaces the whole page, so without one the route renders no <h1>.
    const unavailable = read("components/expense/v2/expenses-unavailable.tsx");
    expect(unavailable).toContain("<PageHeader");
  });
});

describe("expense-v3 is out of scope and untouched", () => {
  it("is still what /fs/new renders", () => {
    expect(page("fs/new")).toContain(
      'from "@/components/expense-v3/expense-split-view"'
    );
  });

  it("keeps the nav offset the split view's height math depends on", () => {
    // The split view rebases its own heights to `100dvh - 5rem`; the wrapper
    // supplies that 5rem. Removing it would push the view past the viewport.
    expect(page("fs/new")).toContain("pt-20");
  });
});

describe("the pages use the design system", () => {
  it.each([
    "profile",
    "applications",
    "fs",
    "fs/[id]",
  ])("%s renders a PageHeader and no legacy hero", (dir) => {
    const source = page(dir);
    expect(source).toContain("<PageHeader");
    expect(source).not.toContain("ImageWithFallback");
    expect(source).not.toContain("PLACEHOLDER_IMAGE");
  });

  it.each([
    "profile",
    "applications",
    "fs",
    "fs/[id]",
  ])("%s renders on the server", (dir) => {
    const source = page(dir);
    expect(source).not.toContain('"use client"');
    expect(source).toContain("export default async function");
  });
});

describe("defects this package fixed", () => {
  it("no longer fuses a status class into the next one", () => {
    // `${config.color}text-sm` produced `border-yellow-200text-sm`.
    expect(page("fs/[id]")).not.toContain("}text-sm");
  });

  it("no longer nests a <button> inside a <Link>", () => {
    const detail = page("fs/[id]");
    expect(detail).not.toContain("<button");
  });

  it("formats dates in the visitor's locale, not the server's", () => {
    // `toLocaleString(undefined, …)` on the server is the container's locale.
    for (const dir of ["applications", "fs/[id]"]) {
      const source = codeOnly(page(dir));
      expect(source).not.toContain("toLocaleString(undefined");
      expect(source).not.toContain('toLocaleDateString("no-NO"');
    }
    expect(read("components/expense/v2/expense-card.tsx")).not.toContain(
      '"no-NO"'
    );
  });

  it("clears the fixed nav on /onboarding", () => {
    // The flow's own container is `min-h-[calc(100vh-5rem)]`; nothing supplied
    // the 5rem, so its first rows sat behind the header.
    const onboarding = readFileSync(
      join(root, "src/app/(public)/onboarding/page.tsx"),
      "utf8"
    );
    expect(onboarding).toContain("pt-20");
    expect(read("components/onboarding/onboarding-flow.tsx")).toContain(
      "min-h-[calc(100vh-5rem)]"
    );
  });

  it("drops the client-only title setter the page already had", () => {
    // `<ProfileHead>` set `document.title` in a `useEffect` to the exact
    // string the page's own `metadata` export already sets.
    expect(page("profile")).not.toContain("ProfileHead");
  });

  it("stops mirroring Radix's own tab state into React state", () => {
    const tabs = codeOnly(read("components/profile/profile-tabs.tsx"));
    expect(tabs).not.toContain("useState");
    expect(tabs).toContain('defaultValue="account"');
  });

  it("removes the 401 page's logo flash and its client boundary", () => {
    const unauth = codeOnly(read("app/unauthorized.tsx"));
    expect(unauth).not.toContain("useTheme");
    expect(unauth).not.toContain("mounted");
    expect(unauth).not.toContain('"use client"');
    // The refused path is the one genuinely client-side part.
    const island = read("components/auth/sign-in-link.tsx");
    expect(island).toContain("usePathname");
    expect(island).toContain("redirectTo=");
  });

  it("reads the 401 copy that was already translated", () => {
    // The same six strings, in both locales, served apps/admin's 401 page from
    // `adminPortal.unauthorized` while apps/web hardcoded Norwegian.
    const unauth = read("app/unauthorized.tsx");
    expect(unauth).toContain('getTranslations("common.unauthorized")');
    expect(unauth).not.toContain("Du må være logget inn");
    for (const locale of ["no", "en"]) {
      const common = JSON.parse(
        readFileSync(
          join(root, `../../packages/i18n/messages/${locale}/common.json`),
          "utf8"
        )
      );
      expect(Object.keys(common.unauthorized)).toEqual([
        "tagline",
        "title",
        "description",
        "signIn",
        "goToFrontPage",
        "help",
      ]);
    }
  });
});

describe("the expense status vocabulary is shared", () => {
  it("is defined once and consumed by both in-scope surfaces", () => {
    expect(
      existsSync(join(SRC, "components/expense/v2/expense-status.ts"))
    ).toBe(true);
    for (const consumer of [
      "components/expense/v2/expense-card.tsx",
      "app/(protected)/fs/[id]/page.tsx",
    ]) {
      expect(read(consumer)).toContain("expense-status");
    }
  });

  it("covers every status the schema defines", () => {
    const source = read("components/expense/v2/expense-status.ts");
    for (const status of [
      "DRAFT",
      "PENDING",
      "SUBMITTED",
      "APPROVED",
      "SUCCESS",
      "REJECTED",
      "FAILED",
    ]) {
      expect(source).toContain(`ExpensesStatus.${status}`);
    }
  });

  it("never returns undefined for an unknown status", () => {
    // The old maps were indexed directly, so a status added in Appwrite
    // before a deploy crashed the page on `config.icon`.
    expect(read("components/expense/v2/expense-status.ts")).toContain(
      "expenseStatusVisual"
    );
  });
});

describe("the error, empty and loading surfaces", () => {
  it("share one panel shape instead of five hand-rolled ones", () => {
    for (const file of [
      "app/(protected)/error.tsx",
      "app/(protected)/fs/error.tsx",
      "app/(protected)/fs/[id]/not-found.tsx",
    ]) {
      expect(read(file)).toContain("<StatusPanel");
    }
  });

  it("head those pages with an h1, not an h2 on a page with no h1", () => {
    expect(read("components/ui/status-panel.tsx")).toContain("<h1");
  });

  it("no longer draw a hero band the page does not have", () => {
    for (const file of [
      "app/(protected)/fs/loading.tsx",
      "app/(protected)/fs/[id]/loading.tsx",
      "app/(protected)/fs/new/loading.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toContain("h-[50vh]");
      expect(source).not.toContain("h-[30vh]");
      expect(source).not.toContain("from-section");
    }
  });

  it("do not nest a second header band inside a page that has one", () => {
    // `FeedSkeleton` brings its own band and <Section>; used as the fallback of
    // a <Suspense> already inside a <Section> it renders a second band.
    for (const file of [
      "app/(protected)/fs/page.tsx",
      "app/(public)/documents/page.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("<ListSkeleton />");
      expect(source).not.toContain("<FeedSkeleton />");
    }
  });
});

describe("focus indicators that were measured dead", () => {
  it("gives every profile-form field a visible focus indicator", () => {
    // `focus:outline-none focus:ring-2 focus:ring-blue-500` computed to no
    // outline and an all-transparent box-shadow: the whole form was focusable
    // with nothing to show for it.
    // `codeOnly`: the comment above the input names both dead utilities.
    const form = codeOnly(read("components/profile/profile-form.tsx"));
    expect(form).not.toContain("focus:outline-none");
    expect(form).not.toContain("focus:ring-blue-500");
    expect(form).toContain("focus-visible:outline-2");
    expect(form).toContain("focus-visible:outline-solid");
  });

  it("gives the locale switcher one", () => {
    const switcher = codeOnly(read("components/locale-switcher.tsx"));
    expect(switcher).not.toContain("focus:ring-primary");
    expect(switcher).toContain("focus-visible:outline-2");
  });

  it("colours the outline now that it can (FINDING-F, fixed in RD-030)", () => {
    // `* { @apply outline-ring/50 }` in packages/ui/styles/globals.css used to
    // beat every outline-color utility, so these deliberately set none. RD-030
    // removed it and `outline-focus-ring` measures rgb(58,163,225).
    for (const file of [
      "components/profile/profile-form.tsx",
      "components/locale-switcher.tsx",
    ]) {
      expect(read(file)).toContain("outline-focus-ring");
    }
  });
});

describe("the components these pages replaced are gone", () => {
  it.each([
    "components/expense/expense-card.tsx",
    "components/expense/expenses-unavailable.tsx",
  ])("%s is deleted", (file) => {
    expect(existsSync(join(SRC, file))).toBe(false);
  });
});
