import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMembershipInvoiceOrder } from "@repo/shared/utils/finago-membership-invoice";
import {
  deriveAccrualMonths,
  toMembershipPlan,
} from "@repo/shared/utils/membership-plans";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

function code(path: string): string {
  return readFileSync(join(root, path), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const page = code("src/components/membership/v2/membership-v2.tsx");
const listPage = code("src/app/(public)/membership/page.tsx");
const joinPage = code("src/app/(public)/membership/join/page.tsx");
const memberPage = code("src/app/(public)/member/page.tsx");

describe("prices and benefits come from the tables", () => {
  it("reads the membership catalog instead of the message bundle", () => {
    // `membership.durations` hardcodes "350 kr" / "550 kr" / "1350 kr" in two
    // locales; the real prices are administrator-controlled rows in
    // `memberships` that `syncMembershipsFrom24SO` keeps current.
    expect(listPage).toContain("getPurchasableMembershipPlans");
    expect(page).toContain("membershipPriceFormatter.format(plan.price)");
    expect(page).not.toContain("durations");
  });

  it("reads campus_benefits, which only the signed-in portal used to see", () => {
    expect(listPage).toContain("getMemberPortalBenefits");
    expect(page).toContain("b.category === category");
    expect(page).toContain("benefit.kind");
  });

  it("renders each benefit in the reader's locale with a fallback", () => {
    // Merged from main (#87): one helper resolves title, teaser and
    // description field by field across both languages, for this page and the
    // member portal alike. Its behaviour is pinned in `lib/benefit-text.test.ts`.
    expect(page).toContain("localizedBenefitText(benefit, locale)");
    expect(code("src/lib/benefit-text.ts")).toContain("title_nb");
    expect(code("src/lib/benefit-text.ts")).toContain("description_en");
  });

  it("links the three highlight cards to their project hubs", () => {
    // Merged from main (#87): the cards rendered buttons with nowhere to go.
    for (const href of [
      "/projects/fadderullan",
      "/projects/karrieredagene",
      "/projects/winter-games",
    ]) {
      expect(page).toContain(`href: "${href}"`);
    }
  });

  it("offers one price card per duration", () => {
    // Merged from main (#83/#85): in June and December the catalog offers
    // this season and next; the page labels plans by duration only and the
    // join wizard makes the season choice.
    expect(listPage).toContain("onePerDuration");
  });

  it("anchors the nav's #fordeler link", () => {
    // `nav-config.ts` points "Member benefits" at `/membership#fordeler`, and
    // no element in the app carried that id.
    expect(page).toContain('id="fordeler"');
    expect(code("src/components/nav/nav-config.ts")).toContain(
      "/membership#fordeler"
    );
  });
});

describe("the purchase flow is untouched", () => {
  it("wraps the join page in chrome and nothing else", () => {
    for (const symbol of [
      "resolveMembershipGate",
      "<JoinWizard",
      "SignedOutState",
      // Main (#94) replaced account linking with BI sign-in: the state that
      // offered "Link BI Student" now offers "Sign in with BI", and a student
      // signed in with BI whose sync failed gets a retry instead of a loop.
      "NeedsBiSignInState",
      "RetryStudentSyncState",
      "AlreadyMemberState",
      "NoPlansAvailableState",
      "MembershipCheckUnavailableState",
      "RetryDirectoryState",
    ]) {
      expect(joinPage, symbol).toContain(symbol);
    }
    // One chrome now (RD-030 removed the toggle), wrapping the same `body`.
    expect(joinPage).toContain("<ShopPageShell");
    expect(joinPage.match(/\{body\}/g)?.length).toBe(1);
    expect(joinPage).not.toContain("ShopHeroShell");
  });

  it("wraps the member portal in chrome and nothing else", () => {
    expect(memberPage).toContain("<MemberPortalContent");
    expect(memberPage.match(/\{portal\}/g)?.length).toBe(1);
    // Main (#85) reads the live status from apps/api; `verifyMembershipStatus`
    // is gone.
    expect(memberPage).toContain("getMembershipStatus");
  });

  it("does not give the portal a second <h1>", () => {
    // The portal's own header is the page's one navy band: `PageHeader`,
    // carrying "Welcome back, …" as the `<h1>`. The page adds no band of its
    // own, and the tabs sit in the paper section below it.
    expect(memberPage).not.toContain("PageHeader");
    expect(memberPage).not.toContain("ShopPageShell");
    const header = code(
      "src/components/member-portal/shared/member-portal-header.tsx"
    );
    expect(header).toContain("<PageHeader");
    expect(header).not.toContain("<h1");
    expect(code("src/app/(public)/member/member-portal-content.tsx")).toContain(
      '<Section tone="paper">'
    );
  });

  it("gives the portal tabs a visible focus indicator", () => {
    // They had none: a keyboard user could not see which tab they were on.
    // An outline rather than a ring — the active trigger sets
    // `data-[state=active]:shadow-lg`, and the winning `box-shadow`
    // declaration drops the ring layer, so `--tw-ring-shadow` computes
    // correctly (measured: `0 0 0 4px #3aa3e1`) and paints nothing.
    const tabs = code("src/components/member-portal/shared/tab-navigation.tsx");
    // `outline-solid` is load-bearing: the shared `TabsTrigger` sets
    // `focus-visible:outline-none`, and tailwind-merge keeps both because a
    // style and a width do not collide — without it the outline has a width,
    // no style, and paints nothing. Measured in a browser: `outline: solid 2px`
    // with it, `none 2px` without.
    expect(tabs).toContain("focus-visible:outline-solid");
    expect(tabs).toContain("focus-visible:outline-2");
    expect(tabs).toContain("focus-visible:outline-focus-ring");
  });

  it("keeps the portal tab bar's scroll inside the bar on a phone", () => {
    // The members-only tabs carry an `sr-only` "locked" label, which is
    // absolutely positioned. A scroll box clips such a child only when it is
    // the child's containing block, so without `relative` the labels escaped
    // it and widened `/member` to 580px at a 375px viewport (measured).
    const tabs = code("src/components/member-portal/shared/tab-navigation.tsx");
    expect(tabs).toContain('className="relative mb-8 overflow-x-auto"');
  });

  it("does not price, purchase or verify anything itself", () => {
    for (const forbidden of [
      "startMembershipCheckout",
      "createOrder",
      "verifyMembershipStatus",
      "resolveMembershipGate",
    ]) {
      expect(page, forbidden).not.toContain(forbidden);
    }
  });
});

/**
 * Was a recorded defect; now a regression guard.
 *
 * `deriveAccrualMonths` parsed `DD.MM.YYYY` with `new Date()`, which V8 does
 * not understand. The Semester plan's expiry `31.12.2026` came back as an
 * Invalid Date, so the plan was dropped from the catalogue and the 350 kr
 * membership could not be bought. The other two survived by accident:
 * `01.07.20XX` was misread as *January 7* on both sides, so the month
 * difference was still right. Anything with a day past the 12th was not.
 */
describe("the catalogue reads the dates 24SevenOffice actually stores", () => {
  const semester = {
    $id: "semester",
    membership_id: "54",
    name: "Semester",
    price: 350,
    category: "113176",
    startDate: "01.07.2026",
    expiryDate: "31.12.2026",
  };

  it("keeps the Semester plan buyable", () => {
    expect(deriveAccrualMonths("01.07.2026", "31.12.2026")).toBe(6);
    const plan = toMembershipPlan(semester as never);
    expect(plan?.duration).toBe("semester");
    expect(plan?.price).toBe(350);
  });

  it("no longer depends on the day being under 13", () => {
    expect(deriveAccrualMonths("13.07.2026", "13.01.2027")).toBe(6);
    expect(deriveAccrualMonths("31.12.2026", "30.06.2027")).toBe(6);
  });
});

/**
 * The accrual period a membership is booked into.
 *
 * Merged from main (#83, "start-date rule"): the redesign had derived the
 * accrual start from the purchase date's half-year (`membershipAccrualStart`).
 * Main's catalog sells this season's and, in June and December, next season's
 * plans, so the accrual is the **purchased plan's own start** — and that start
 * is normalised from the `DD.MM.YYYY` 24SevenOffice stores to the ISO `date`
 * its API documents. Both defects the redesign fixed stay fixed: no catalog
 * row's raw `01.07.2026` reaches 24SevenOffice, and the booked period follows
 * what was bought, snapshotted at checkout.
 */
describe("membership accrual", () => {
  it("books the plan's own start, as an ISO date", () => {
    const plan = toMembershipPlan({
      $id: "semester",
      membership_id: "54",
      name: "Semester",
      price: 350,
      category: "113176",
      startDate: "01.07.2026",
      expiryDate: "31.12.2026",
    } as never);
    expect(plan?.startDate).toBe("2026-07-01");
    if (!plan) {
      throw new Error("the Semester plan must stay buyable");
    }
    const order = buildMembershipInvoiceOrder({
      campusId: "1",
      customerId: 1,
      invoicedOn: "2026-08-12",
      plan,
    });
    expect(order.AccrualDate).toBe("2026-07-01");
    expect(order.AccrualLength).toBe(6);
  });

  it("is what checkout snapshots onto the order item", () => {
    const checkout = readFileSync(
      join(
        root,
        "../../apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts"
      ),
      "utf8"
    );
    // The plan the student chose — this season's or next — not a catalogue
    // row re-read at fulfilment time.
    expect(checkout).toContain("start_date: plan.startDate");
    expect(
      code("../../packages/shared/utils/finago-membership-invoice.ts")
    ).toContain("AccrualDate: plan.startDate");
  });
});

describe("membership message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(root, `../../packages/i18n/messages/${locale}/membership.json`),
        "utf8"
      )
    ) as Record<string, unknown>;

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });
});
