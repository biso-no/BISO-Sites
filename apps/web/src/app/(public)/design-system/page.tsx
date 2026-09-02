import type { Metadata } from "next";
import Image from "next/image";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame, type ChevronRatio } from "@/components/ui/chevron-frame";
import { Container } from "@/components/ui/container";
import { DateBlock } from "@/components/ui/date-block";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { PersonCard } from "@/components/ui/person-card";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatRow } from "@/components/ui/stat-row";
import { LiveValues } from "./_components/live-values";
import { MotionDemo } from "./_components/motion-demo";
import { Swatch } from "./_components/swatch";

/**
 * Living showcase of the redesign's tokens and primitives, and the verification
 * surface for every work package after RD-007. Values and contrast ratios are
 * resolved in the browser, not printed from source, so this page fails visibly
 * when something drifts.
 *
 * Internal: excluded from sitemap.ts and disallowed in robots.ts.
 */
export const metadata: Metadata = {
  title: "Design system | BISO",
  description:
    "Internal reference for the BISO design system — tokens, typography and primitives.",
  robots: { index: false, follow: false },
};

const BRAND_TOKENS = [
  { token: "--biso-deep", note: "navy; also the ink colour on light" },
  { token: "--biso-blue", note: "action — buttons, links, focus" },
  { token: "--biso-sky", note: "display accent + chevron. On navy only" },
  { token: "--biso-sun", note: "marker. Never a text colour" },
  { token: "--biso-paper" },
  { token: "--biso-line" },
];

const STATE_TOKENS = [
  { token: "--biso-success" },
  { token: "--biso-warning" },
  { token: "--biso-danger" },
];

const ALIASES = [
  { token: "--surface" },
  { token: "--surface-raised" },
  { token: "--ink" },
  { token: "--ink-muted" },
  { token: "--ink-accent" },
  { token: "--edge" },
  { token: "--action" },
  { token: "--action-ink" },
  { token: "--marker" },
];

const CONTRAST_PAIRS: {
  label: string;
  fg: string;
  bg: string;
  large?: boolean;
}[] = [
  { label: "ink / paper", fg: "var(--biso-deep)", bg: "var(--biso-paper)" },
  { label: "ink-muted / paper", fg: "#526475", bg: "var(--biso-paper)" },
  { label: "action / paper", fg: "var(--biso-blue)", bg: "var(--biso-paper)" },
  {
    label: "paper / action fill",
    fg: "var(--biso-paper)",
    bg: "var(--biso-blue)",
  },
  { label: "ink / sky fill", fg: "var(--biso-deep)", bg: "var(--biso-sky)" },
  { label: "ink / sun fill", fg: "var(--biso-deep)", bg: "var(--biso-sun)" },
  { label: "paper / deep", fg: "var(--biso-paper)", bg: "var(--biso-deep)" },
  { label: "ink-muted / deep", fg: "#93a7bb", bg: "var(--biso-deep)" },
  { label: "sky / deep", fg: "var(--biso-sky)", bg: "var(--biso-deep)" },
  { label: "sun / deep", fg: "var(--biso-sun)", bg: "var(--biso-deep)" },
  {
    label: "success / paper",
    fg: "var(--biso-success)",
    bg: "var(--biso-paper)",
  },
  {
    label: "warning / paper",
    fg: "var(--biso-warning)",
    bg: "var(--biso-paper)",
  },
  {
    label: "danger / paper",
    fg: "var(--biso-danger)",
    bg: "var(--biso-paper)",
  },
];

const TYPE_ROLES = [
  { role: "type-display-hero", sample: "Students shaping tomorrow" },
  { role: "type-display-lg", sample: "Open positions" },
  { role: "type-display-sm", sample: "Our societies" },
  { role: "type-heading-section", sample: "Upcoming events" },
  { role: "type-heading-card", sample: "Company Day: Deloitte" },
  {
    role: "type-body",
    sample: "BISO connects students across every BI campus.",
  },
  { role: "type-body-sm", sample: "Registration closes 22 May at 15:00." },
  { role: "type-label", sample: "Staff function" },
  { role: "type-data", sample: "22 MAY · 15:00 · 1 090 kr" },
];

const CHEVRON_RATIOS: ChevronRatio[] = [
  "21/9",
  "16/9",
  "3/2",
  "4/3",
  "1/1",
  "4/5",
  "3/4",
];

const SCALE = [
  { name: "--radius-biso-sm", css: "4px" },
  { name: "--radius-biso-md", css: "8px" },
  { name: "--radius-biso-lg", css: "12px" },
  { name: "--radius-biso-pill", css: "999px" },
];

type SearchParams = Record<string, string | string[] | undefined>;

/** Render the live query string, so the URL-driven filters are self-evidencing. */
function describeQuery(params: SearchParams): string {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    for (const v of Array.isArray(value) ? value : [value]) {
      pairs.push([key, v]);
    }
  }
  return pairs.length === 0 ? "(none)" : new URLSearchParams(pairs).toString();
}

export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // FilterChips is a Server Component driven by the URL, so the showcase has to
  // be too — that is the whole point of the primitive.
  const params = await searchParams;
  return (
    <div className="bg-surface text-ink">
      <LiveValues />

      {/* Header — the first surface built entirely from the new tokens. */}
      {/* The page uses the primitive it documents: PageHeader owns the navy
          band, the breadcrumb, the h1 and the fixed-nav clearance. */}
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Design system" }]}
        eyebrow="BISO design system"
        lede="Every value below is read from the running page, not printed from source. If a token stops resolving or a pairing drops below AA, this page says so."
        title="Tokens, type and primitives"
      />

      {/* Not `as="main"`: the root layout and SiteShell each already open a
          <main>, so a third would deepen the nesting Phase 0 flagged (§8.2).
          RD-013 collapses those two; nothing should add a new one meanwhile. */}
      <Container className="pt-12 pb-16">
        {/* Colour */}
        <section aria-labelledby="colour" className="mb-16">
          <SectionHeading id="colour">Colour</SectionHeading>
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="type-heading-card mb-4">Brand</h3>
              <ul className="space-y-4">
                {BRAND_TOKENS.map((t) => (
                  <Swatch key={t.token} note={t.note} token={t.token} />
                ))}
              </ul>
            </div>
            <div>
              <h3 className="type-heading-card mb-4">State</h3>
              <ul className="space-y-4">
                {STATE_TOKENS.map((t) => (
                  <Swatch key={t.token} token={t.token} />
                ))}
              </ul>
              <h3 className="type-heading-card mt-8 mb-4">
                Semantic aliases
                <span className="type-body-sm ml-2 font-normal text-ink-muted">
                  what components should name
                </span>
              </h3>
              <ul className="space-y-4">
                {ALIASES.map((t) => (
                  <Swatch key={t.token} token={t.token} />
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Contrast */}
        <section aria-labelledby="contrast" className="mb-16">
          <SectionHeading id="contrast">Contrast</SectionHeading>
          <p className="type-body type-measure mb-6 text-ink-muted">
            Measured in this page from painted colours. Two rules keep every
            pairing compliant: <code>--biso-sky</code> never carries text on a
            light surface, and <code>--biso-sun</code> is never a text colour.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-left">
              <caption className="sr-only">
                Contrast ratio for every colour pairing the system permits
              </caption>
              <thead>
                <tr className="border-edge border-b">
                  <th className="type-label py-2 text-ink-muted" scope="col">
                    Pairing
                  </th>
                  <th className="type-label py-2 text-ink-muted" scope="col">
                    Ratio
                  </th>
                  <th className="type-label py-2 text-ink-muted" scope="col">
                    Sample
                  </th>
                </tr>
              </thead>
              <tbody>
                {CONTRAST_PAIRS.map((p) => (
                  <tr className="border-edge border-b" key={p.label}>
                    <th
                      className="type-body-sm py-3 pr-4 font-normal"
                      scope="row"
                    >
                      {p.label}
                    </th>
                    <td
                      className="type-data py-3 pr-4 data-[level=fail]:text-danger"
                      data-contrast={`${p.fg}|${p.bg}`}
                      data-large={p.large ? "true" : "false"}
                    >
                      …
                    </td>
                    <td className="py-2">
                      <span
                        className="type-body-sm inline-block rounded-biso-sm px-3 py-1"
                        style={{ color: p.fg, background: p.bg }}
                      >
                        Aa 0123
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Typography */}
        <section aria-labelledby="typography" className="mb-16">
          <SectionHeading id="typography">Typography</SectionHeading>
          <p className="type-body type-measure mb-8 text-ink-muted">
            Archivo for display and Inter for body and UI. Display line-height
            is 0.85 — measured from the reference, where the hero&rsquo;s
            cap-height is 56px over 66px baseline-to-baseline.
          </p>
          <ul className="space-y-8">
            {TYPE_ROLES.map((t) => (
              <li key={t.role}>
                <code className="type-data mb-2 block text-ink-muted">
                  .{t.role}
                </code>
                <p className={`${t.role} text-ink`}>{t.sample}</p>
              </li>
            ))}
          </ul>
          <p className="type-body type-measure mt-10 rounded-biso-md border border-edge p-5 text-ink-muted">
            This paragraph carries <code>.type-measure</code>. The brief&rsquo;s
            floor is 80 characters per line; the target is 68. Norwegian sample
            for glyph coverage: blåbærsyltetøy, Ærlig Øving Åpen.
          </p>
        </section>

        {/* Scale */}
        <section aria-labelledby="scale" className="mb-16">
          <SectionHeading id="scale">Radius, elevation, motion</SectionHeading>
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h3 className="type-heading-card mb-4">Radius</h3>
              <ul className="space-y-3">
                {SCALE.map((r) => (
                  <li className="flex items-center gap-3" key={r.name}>
                    <span
                      aria-hidden="true"
                      className="size-11 shrink-0 border border-edge bg-surface-raised"
                      style={{ borderRadius: `var(${r.name})` }}
                    />
                    <span>
                      <code className="type-data block">{r.name}</code>
                      <span
                        className="type-body-sm block text-ink-muted"
                        data-computed-for={r.name}
                      >
                        …
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="type-body-sm mt-4 text-ink-muted">
                A sheared surface is always radius 0 — soft rectangles and hard
                angles never meet on one element.
              </p>
            </div>
            <div>
              <h3 className="type-heading-card mb-4">Elevation</h3>
              <div className="space-y-4">
                <div className="rounded-biso-md border border-edge bg-surface-raised p-4">
                  <code className="type-data">--elev-0</code>
                  <p className="type-body-sm text-ink-muted">
                    Default. Bordered, not shadowed.
                  </p>
                </div>
                <div className="rounded-biso-md bg-surface-raised p-4 shadow-elev-1">
                  <code className="type-data">--shadow-elev-1</code>
                  <p className="type-body-sm text-ink-muted">
                    Hover, dropdowns.
                  </p>
                </div>
                <div className="rounded-biso-md bg-surface-raised p-4 shadow-elev-2">
                  <code className="type-data">--shadow-elev-2</code>
                  <p className="type-body-sm text-ink-muted">
                    Modals, drawers. Navy-tinted, never neutral black.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="type-heading-card mb-4">Motion &amp; chevron</h3>
              <ul className="space-y-3">
                {["--dur-fast", "--dur-base", "--dur-slow", "--dur-hero"].map(
                  (d) => (
                    <li key={d}>
                      <code className="type-data block">{d}</code>
                      <span
                        className="type-body-sm block text-ink-muted"
                        data-computed-for={d}
                      >
                        …
                      </span>
                    </li>
                  )
                )}
                {["--shear", "--shear-run", "--measure"].map((d) => (
                  <li key={d}>
                    <code className="type-data block">{d}</code>
                    <span
                      className="type-body-sm block text-ink-muted"
                      data-computed-for={d}
                    >
                      …
                    </span>
                  </li>
                ))}
              </ul>
              <p className="type-body-sm mt-4 text-ink-muted">
                One angle for the whole system. Primitives that use it arrive in
                RD-010.
              </p>
            </div>
          </div>
        </section>

        {/* Chevron */}
        <section aria-labelledby="chevron" className="mb-16">
          <SectionHeading id="chevron">Chevron</SectionHeading>
          <p className="type-body mb-6 max-w-(--measure) text-ink-muted">
            One angle for the whole system, measured from the reference at 13°.
            The cut is derived from each frame&rsquo;s aspect ratio rather than
            hardcoded, because a <code>clip-path</code> percentage resolves
            against width while the angle depends on height. There is no band
            variant: 13° across a 1440px section would drop 332px.
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CHEVRON_RATIOS.map((r) => (
              <li key={r}>
                <ChevronFrame className="bg-ink-accent" ratio={r} />
                <code className="type-data mt-2 block text-ink-muted">{r}</code>
              </li>
            ))}
          </ul>
          <h3 className="type-heading-card mt-8 mb-3">With media</h3>
          <p className="type-body-sm mb-3 text-ink-muted">
            The clip removes corners; it does not move content. `cover` fills
            the box, so nothing letterboxes and no counter-transform is needed.
            The frame sets <code>aspect-ratio</code>, so the box is reserved
            before the image loads and there is no layout shift.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ChevronFrame id="chevron-media" ratio="4/3">
              <Image
                alt=""
                height={600}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
                src="/images/campus/oslo.png"
                width={800}
              />
            </ChevronFrame>
            <ChevronFrame lean="right" ratio="4/3">
              <Image
                alt=""
                height={600}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
                src="/images/campus/bergen.png"
                width={800}
              />
            </ChevronFrame>
            <ChevronFrame ratio="4/3">
              <Image
                alt=""
                height={600}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
                src="/images/campus/trondheim.png"
                width={800}
              />
            </ChevronFrame>
          </div>

          <h3 className="type-heading-card mt-8 mb-3">
            Leading and return edge
          </h3>
          <div className="flex gap-2">
            <ChevronFrame className="w-40 bg-ink-accent" ratio="4/5" />
            <ChevronFrame className="w-40 bg-marker" lean="right" ratio="4/5" />
          </div>
        </section>

        {/* Content primitives */}
        <section aria-labelledby="content" className="mb-16">
          <SectionHeading id="content">Content primitives</SectionHeading>

          <h3 className="type-heading-card mb-3">Section heading</h3>
          <p className="type-body mb-4 max-w-(--measure) text-ink-muted">
            The sun marker appears <strong>only</strong> when the section leads
            somewhere, so it means &ldquo;there is more behind this&rdquo;
            rather than decorating every title. Compare the two below.
          </p>
          <div className="rounded-biso-md border border-edge p-5">
            <SectionHeading
              as="h3"
              seeAllHref="/events"
              seeAllLabel="See all events"
            >
              Upcoming events
            </SectionHeading>
            <SectionHeading as="h3">Highlights</SectionHeading>
            <p className="type-body-sm text-ink-muted">
              The first leads to a collection and is marked. The second is
              terminal and is not.
            </p>
          </div>

          <h3 className="type-heading-card mt-8 mb-3">Pill</h3>
          <div className="flex flex-wrap gap-2">
            <Pill tone="success">Register</Pill>
            <Pill tone="accent">Info only</Pill>
            <Pill tone="accent" uppercase>
              Staff function
            </Pill>
            <Pill tone="marker" uppercase>
              Featured
            </Pill>
            <Pill tone="warning">Deadline soon</Pill>
            <Pill tone="danger">Cancelled</Pill>
            <Pill tone="neutral">Oslo</Pill>
          </div>

          <h3 className="type-heading-card mt-8 mb-3">Date block</h3>
          <p className="type-body-sm mb-3 text-ink-muted">
            Tabular digits, so a column of dates aligns whatever the numerals.
          </p>
          <ul className="space-y-2">
            {["2026-05-22", "2026-05-27", "2026-06-03", "2026-11-10"].map(
              (d) => (
                <li className="flex items-center gap-3" key={d}>
                  <DateBlock date={d} />
                  <span className="type-body-sm text-ink-muted">{d}</span>
                </li>
              )
            )}
          </ul>

          <h3 className="type-heading-card mt-8 mb-3">Stat row</h3>
          <p className="type-body-sm mb-3 text-ink-muted">
            Collapses to 2×2 below 640px. Render only figures backed by real
            data — see PLACEHOLDER-004.
          </p>
          <StatRow
            stats={[
              { value: "50+", label: "Societies & projects" },
              { value: "210", label: "Events this year" },
              { value: "5", label: "Campuses" },
              { value: "43", label: "Open positions" },
            ]}
          />
        </section>

        {/* Navigation primitives */}
        <section aria-labelledby="nav-primitives" className="mb-16">
          <SectionHeading id="nav-primitives">
            Filters, grids and people
          </SectionHeading>

          <h3 className="type-heading-card mb-3">Filter chips</h3>
          <p className="type-body mb-4 max-w-(--measure) text-ink-muted">
            Links, not state. Click one and the URL changes, so the view is
            shareable, survives a reload, opens in a new tab on middle-click and
            steps back with the back button. Other parameters are preserved —
            pick a category while a campus is set and the campus stays.
          </p>
          <div className="space-y-3 rounded-biso-md border border-edge p-5">
            <FilterChips
              active={
                typeof params.category === "string"
                  ? params.category
                  : undefined
              }
              basePath="/design-system"
              label="Filter the example by category"
              options={[
                { value: "all", label: "All" },
                { value: "social", label: "Social", count: 12 },
                { value: "career", label: "Career", count: 8 },
                { value: "workshop", label: "Workshop", count: 3 },
              ]}
              param="category"
              searchParams={params}
            />
            <FilterChips
              active={
                typeof params.campus === "string" ? params.campus : undefined
              }
              basePath="/design-system"
              label="Filter the example by campus"
              options={[
                { value: "all", label: "All campuses" },
                { value: "oslo", label: "Oslo" },
                { value: "bergen", label: "Bergen" },
              ]}
              param="campus"
              searchParams={params}
            />
            {/* A group with only the default renders nothing at all — the
                row below stays empty, which is the point. */}
            <FilterChips
              basePath="/design-system"
              label="A group with only the default option"
              options={[{ value: "all", label: "All" }]}
              param="lonely"
              searchParams={params}
            />
            <p className="type-data text-ink-muted">
              current query: {describeQuery(params)}
            </p>
          </div>
          <p className="type-body-sm mt-3 max-w-(--measure) text-ink-muted">
            A group offering only the default renders nothing. Options are
            derived from the data, so a feed where no row carries the attribute
            would otherwise show a lone "All" chip that filters nothing — there
            is a third group above with one option, and it is invisible.
          </p>

          <h3 className="type-heading-card mt-8 mb-3">Keyboard focus</h3>
          <p className="type-body mb-4 max-w-(--measure) text-ink-muted">
            Tab into the row below. Every control takes a 2px ring in{" "}
            <code className="type-data">--focus-ring</code>, offset by the
            surface it sits on so it reads on paper and on navy alike.
          </p>
          <p className="type-body-sm mb-4 max-w-(--measure) text-ink-muted">
            This block exists because it caught a real bug.{" "}
            <code className="type-data">ring-focus-ring</code> was used 27 times
            across the app before{" "}
            <code className="type-data">--color-focus-ring</code> was registered
            in the theme. Tailwind only emits a{" "}
            <code className="type-data">ring-*</code> utility for a registered
            colour, so all 27 compiled to nothing — while the{" "}
            <code className="type-data">outline-none</code> beside them applied,
            leaving those controls with less visible focus than the browser
            default. Nothing rendered it anywhere it would be noticed. Now it is
            rendered here, and tabbing this page is the check.
          </p>
          <div className="flex flex-wrap gap-3 rounded-biso-md border border-edge p-5">
            <a
              className="type-label rounded-biso-pill border border-edge px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="#focus-demo"
            >
              Link on paper
            </a>
            <button
              className="type-label rounded-biso-pill bg-action px-4 py-2 text-action-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              id="focus-demo"
              type="button"
            >
              Button on paper
            </button>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-3 rounded-biso-md bg-surface p-5"
            data-surface="deep"
          >
            <a
              className="type-label rounded-biso-pill border border-edge px-4 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="#focus-demo"
            >
              Link on navy
            </a>
            <button
              className="type-label rounded-biso-pill bg-action px-4 py-2 text-action-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              type="button"
            >
              Button on navy
            </button>
          </div>

          <h3 className="type-heading-card mt-8 mb-3">Card grid</h3>
          <CardGrid>
            {["One", "Two", "Three", "Four", "Five", "Six"].map((n) => (
              <li
                className="type-body-sm rounded-biso-md border border-edge p-5"
                key={n}
              >
                {n}
              </li>
            ))}
          </CardGrid>

          <h3 className="type-heading-card mt-8 mb-3">Person card</h3>
          <p className="type-body-sm mb-3 text-ink-muted">
            The email action is omitted when there is no address —
            PLACEHOLDER-007. The second card below has none.
          </p>
          <CardGrid columns={4}>
            <li>
              <PersonCard
                campus="Oslo"
                email="post@biso.no"
                name="With email"
                position="Campus Director"
              />
            </li>
            <li>
              <PersonCard
                campus="Oslo"
                name="Without email"
                position="Head of Projects"
              />
            </li>
            <li>
              <PersonCard name="Name only" />
            </li>
          </CardGrid>
        </section>

        {/* Motion */}
        <section aria-labelledby="motion" className="mb-16">
          <SectionHeading id="motion">Motion</SectionHeading>
          <p className="type-body type-measure mb-6 text-ink-muted">
            Three kinds of motion are permitted: one orchestrated moment per
            page, motion that answers a user action, and state transitions.
            Scroll-triggered reveals are not among them, so{" "}
            <code>&lt;Reveal&gt;</code> animates on mount only and has no scroll
            trigger to misuse.
          </p>
          <MotionDemo />
        </section>

        {/* Deep surface */}
        <section aria-labelledby="deep" className="mb-4">
          <SectionHeading id="deep">On navy</SectionHeading>
          <p className="type-body type-measure mb-6 text-ink-muted">
            A navy band sets <code>data-surface=&quot;deep&quot;</code>. The
            alias names do not change — <code>--ink</code> and{" "}
            <code>--action</code> resolve differently inside it, so components
            never branch on surface.
          </p>
          <div
            className="rounded-biso-lg p-8"
            data-surface="deep"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            <p className="type-label text-ink-accent">Campus Oslo</p>
            <p className="type-display-sm mt-2">Students shaping tomorrow</p>
            <p className="type-body type-measure mt-3 text-ink-muted">
              Body copy on navy uses the same <code>--ink-muted</code> alias as
              on paper, resolved to a compliant value for this surface.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {["--surface", "--ink", "--action"].map((t) => (
                <Swatch key={t} onDeep token={t} />
              ))}
            </ul>
          </div>
        </section>

        {/* Layout primitives */}
        <section aria-labelledby="layout" className="mb-4">
          <SectionHeading id="layout">Layout</SectionHeading>
          <p className="type-body mb-6 max-w-(--measure) text-ink-muted">
            Three primitives replace 176 hand-rolled containers across seven
            widths, four competing section rhythms, and four different values
            hand-compensating for the fixed header. This page is built from
            them.
          </p>

          <h3 className="type-heading-card mb-3">Container widths</h3>
          <div className="space-y-2">
            {(["default", "wide", "prose"] as const).map((w) => (
              <Container
                className="rounded-biso-md border border-edge border-dashed py-2"
                key={w}
                width={w}
              >
                <code className="type-data">width=&quot;{w}&quot;</code>
              </Container>
            ))}
          </div>

          <h3 className="type-heading-card mt-8 mb-3">Section rhythm</h3>
          <ul className="type-body-sm space-y-1 text-ink-muted">
            <li>
              <code>rhythm=&quot;base&quot;</code> —{" "}
              <span data-computed-for="--section-y">…</span>
            </li>
            <li>
              <code>rhythm=&quot;lg&quot;</code> —{" "}
              <span data-computed-for="--section-y-lg">…</span>
            </li>
            <li>
              <code>rhythm=&quot;none&quot;</code> — caller owns spacing
            </li>
          </ul>

          <h3 className="type-heading-card mt-8 mb-3">Prose</h3>
          <Prose className="rounded-biso-md border border-edge p-5">
            <h2>Authored content uses the same roles as the chrome</h2>
            <p>
              Prose caps its own measure, so a page cannot accidentally set body
              copy 100 characters wide. Block-editor output at{" "}
              <code>/[...slug]</code> renders into this same wrapper, which is
              what keeps authored and hardcoded pages reading alike.
            </p>
            <ul>
              <li>Lists, quotes and rules inherit the scale.</li>
              <li>
                Links are <a href="#layout">underlined as well as coloured</a>,
                never colour alone.
              </li>
            </ul>
            <blockquote>
              Wide content — tables and code blocks — scrolls inside itself
              rather than widening the page.
            </blockquote>
          </Prose>
        </section>
      </Container>
    </div>
  );
}
