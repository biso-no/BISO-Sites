import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, "src", rel), "utf8");
/** Hoisted: Biome forbids building a regex inside an assertion. */
const ONE_TABS_ROOT = /<Tabs\b/g;

/**
 * RD-031 — the accessibility sweep.
 *
 * The audit itself is a browser pass (axe-core, a tab walk, and emulated
 * `prefers-reduced-motion`) recorded in STATUS.md; source cannot prove
 * contrast or focus visibility. What these tests pin is the *shape* of each
 * fix, so a later edit cannot quietly undo one.
 */
describe("focus indicators cannot be swallowed", () => {
  it("the shared Button uses an outline, not a ring", () => {
    // A ring is composed into `box-shadow`, so every variant that also sets a
    // shadow silently ate it — `/projects`' primary CTA had no indicator at
    // all while its `outline` sibling did. An outline cannot be swallowed.
    const button = codeOnly(
      readFileSync(
        join(root, "../../packages/ui/components/ui/button.tsx"),
        "utf8"
      )
    );
    expect(button).toContain("focus-visible:outline-2");
    expect(button).toContain("focus-visible:outline-focus-ring");
    expect(button).not.toContain("focus-visible:ring-2");
    expect(button).not.toContain("focus-visible:outline-none");
  });
});

describe("the sun marker is decoration, not a text background", () => {
  it("draws the stroke on a pseudo-element", () => {
    // As a `background-image` on the text span it made the marker colour the
    // text's background: axe scored white on #fecd45 at 1.49:1 wherever a
    // section heading sat on a deep band.
    const heading = read("components/ui/section-heading.tsx");
    expect(heading).toContain("after:bg-marker");
    expect(heading).toContain("after:-z-10");
    expect(codeOnly(heading)).not.toContain("bg-[length:100%_3px]");
  });
});

describe("reduced motion is respected", () => {
  it("the member portal header no longer loops three animations", () => {
    // `motion`'s JS-driven animations are not stopped by the CSS media query,
    // so these ran forever with reduced motion set. They are static now.
    const header = codeOnly(
      read("components/member-portal/shared/member-portal-header.tsx")
    );
    expect(header).not.toContain("Number.POSITIVE_INFINITY");
  });

  it("no component loops a decorative animation", () => {
    // The audit checks `document.getAnimations()` under emulated reduced
    // motion on every route; this is the cheap source-level guard against
    // reintroduction.
    //
    // The two allowed files are spinners — a reveal button and the receipt
    // scanner — which run only while an action is in flight, never on load.
    // A busy indicator that conveys progress is the one loop WCAG's
    // reduced-motion guidance does not ask you to remove, and neither does
    // the brief: "motion deliberate and sparse", not "no spinners".
    const ALLOWED = new Set([
      "components/member-portal/shared/benefit-card-parts.tsx",
      "components/expense-v3/generative-receipt-preview.tsx",
    ]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      const { readdirSync, statSync } =
        require("node:fs") as typeof import("node:fs");
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (name.endsWith(".tsx")) {
          const source = codeOnly(readFileSync(full, "utf8"));
          const rel = full.split("/src/")[1];
          if (
            source.includes("repeat: Number.POSITIVE_INFINITY") &&
            !ALLOWED.has(rel)
          ) {
            offenders.push(rel);
          }
        }
      }
    };
    walk(join(root, "src"));
    expect(offenders).toEqual([]);
  });
});

describe("controls have accessible names", () => {
  it("labels every select on the reporting form", () => {
    // Three Radix triggers with `<Label>`s that had no `htmlFor`: axe reported
    // `button-name` (critical) on the page people use to report harassment.
    const form = read("components/safety/varsling-form.tsx");
    expect(form).toContain("useId()");
    for (const id of ["submissionTypeId", "campusId", "receiverId"]) {
      expect(form).toContain(`htmlFor={${id}}`);
      expect(form).toContain(`id={${id}}`);
    }
  });

  it("names the icon-only scroll button", () => {
    const hero = read("components/about/about-hero.tsx");
    expect(hero).toContain("aria-label={scrollLabel}");
    expect(hero).toContain('aria-hidden="true"');
  });

  it("gives the select trigger a focus indicator that cannot be swallowed", () => {
    const select = readFileSync(
      join(root, "../../packages/ui/components/ui/select.tsx"),
      "utf8"
    );
    expect(select).toContain("focus-visible:outline-2");
    expect(select).not.toContain("focus-visible:ring-[3px]");
  });
});

describe("ARIA references resolve", () => {
  it("keeps the unit tabs in one Radix root", () => {
    // Two roots meant Radix generated ids independently, so every trigger's
    // `aria-controls` pointed at a panel that does not exist — critical.
    // `codeOnly`: the comment above the root says "<Tabs>" too.
    const tabs = codeOnly(
      read(
        "app/(public)/units/[...segments]/components/department-tabs-client.tsx"
      )
    );
    expect(tabs.match(ONE_TABS_ROOT)?.length).toBe(1);
    expect(tabs).toContain("<TabsList");
    expect(tabs).toContain("<TabsContent");
  });
});

describe("heading order and dark-theme contrast", () => {
  it("lets a card title declare its level", () => {
    const card = readFileSync(
      join(root, "../../packages/ui/components/ui/card.tsx"),
      "utf8"
    );
    // Default unchanged, so every existing caller renders what it did before.
    expect(card).toContain('as: Tag = "h3"');
    expect(read("components/projects/project-detail-body.tsx")).toContain(
      'CardTitle as="h2"'
    );
  });

  it("stops pairing white text with the dark theme's --brand-dark", () => {
    // In the dark block `--brand-dark` is set to the same value as `--brand`,
    // a light cyan, so `bg-brand-dark text-white` measured 2.34:1 there.
    for (const file of [
      "app/(public)/shop/checkout/checkout-page-client.tsx",
      "app/(public)/units/[...segments]/components/products-tab.tsx",
      "app/(public)/membership/join/join-wizard.tsx",
      "components/shop/cart/cart-summary.tsx",
    ]) {
      expect(codeOnly(read(file))).not.toContain("bg-brand-dark");
    }
  });
});

describe("tab bars wrap instead of overflowing", () => {
  it.each([
    ["components/profile/profile-tabs.tsx", "Linked Accounts"],
    [
      "app/(public)/units/[...segments]/components/department-tabs-client.tsx",
      "News & Updates",
    ],
  ])("%s", (file) => {
    // Both pushed their page past a 320px viewport with `whitespace-nowrap`
    // labels in a fixed grid.
    const source = read(file);
    expect(source).toContain("whitespace-normal");
    expect(source).toContain("min-w-0");
  });
});
