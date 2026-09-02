import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deriveAccrualMonths,
  membershipAccrualStart,
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
    expect(page).toContain("title_nb");
    expect(page).toContain("title_en");
    expect(page).toContain("description_nb");
    expect(page).toContain("description_en");
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
      "NeedsBiLinkState",
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
    expect(memberPage).toContain("verifyMembershipStatus");
  });

  it("does not give the portal a second <h1>", () => {
    // `member-portal-header` renders "Welcome back, …" as the page's `<h1>`.
    // The standard `PageHeader` band would add another one.
    expect(memberPage).not.toContain("PageHeader");
    expect(memberPage).not.toContain("ShopPageShell");
    expect(memberPage).toContain("<Section");
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
 * The accrual period a membership is booked into follows the **purchase**, not
 * the catalogue row: bought in the summer half it accrues from 1 July, in the
 * spring half from 1 January. Before this, `AccrualDate` was the catalogue
 * row's own fixed `startDate`, sent to 24SevenOffice in `DD.MM.YYYY` where the
 * API documents an ISO `date`.
 */
describe("membershipAccrualStart", () => {
  it("maps each half of the year to its boundary", () => {
    expect(membershipAccrualStart("2027-02-14")).toBe("2027-01-01");
    expect(membershipAccrualStart("2026-08-12")).toBe("2026-07-01");
  });

  it("is what checkout snapshots onto the order item", () => {
    const checkout = readFileSync(
      join(
        root,
        "../../apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts"
      ),
      "utf8"
    );
    expect(checkout).toContain("membershipAccrualStart(new Date())");
    expect(checkout).not.toContain("start_date: plan.startDate");
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
