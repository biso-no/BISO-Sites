import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import {
  type PageFeedSnapshot,
  pageFeedKey,
  partnersSource,
} from "@/editor/page-feeds";
import type { PartnersBlock } from "@/editor/types";
import { PartnersRender } from "./render";

const block: PartnersBlock = {
  heading: "Partnere",
  id: "p1",
  source: "auto",
  type: "partners",
};

const FEED = [
  { href: "https://acme.example", logoSrc: "/acme.png", name: "Acme" },
  { href: "javascript:alert(1)", logoSrc: "/evil.png", name: "Evil" },
  { name: "No logo" },
];

function html(
  props: Partial<PartnersBlock> = {},
  feeds: PageFeedSnapshot = { [pageFeedKey("partners")]: FEED },
  options: { edit?: boolean; surface?: boolean } = {}
) {
  const node = (
    <PageFeedProvider department="" feeds={feeds} locale="no">
      <PartnersRender
        block={{ ...block, ...props }}
        edit={options.edit ?? false}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
  return renderToStaticMarkup(
    options.surface ? <section data-surface="deep">{node}</section> : node
  );
}

describe("PartnersRender", () => {
  test("a partner with a javascript: href is not linked", () => {
    const out = html();
    expect(out).toContain('href="https://acme.example"');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("Evil");
  });

  test("logos sit in bordered 16/9 chevron frames, contained", () => {
    const out = html();
    expect(out).toContain("border border-edge bg-surface-raised");
    expect(out).toContain("object-contain p-4");
    expect(out).toContain("chevron-frame");
    expect(out).toContain('alt="Acme"');
  });

  test("a partner with no logo shows its name", () => {
    expect(html()).toContain("No logo");
  });

  test("manual mode renders the authored items, new or legacy shape", () => {
    const out = html(
      {
        items: [
          { logo: { src: "/a.png" }, name: "Alpha" },
          { logoSrc: "/b.png", name: "Beta" },
        ],
        source: "manual",
      },
      {}
    );
    expect(out).toContain('src="/a.png"');
    expect(out).toContain('src="/b.png"');
  });

  test("renders nothing on the site when empty, a placeholder in the editor", () => {
    expect(html({}, { [pageFeedKey("partners")]: [] })).toBe("");
    expect(html({}, {})).toBe("");
    expect(html({ items: [], source: "manual" }, {})).toBe("");
    expect(
      html({}, { [pageFeedKey("partners")]: [] }, { edit: true })
    ).toContain("No partners to show yet");
  });

  test("an unknown source is the default, auto", () => {
    expect(partnersSource("weird")).toBe("auto");
    expect(partnersSource(undefined)).toBe("auto");
    const out = html({ source: "weird" as never });
    expect(out).toContain("Acme");
  });

  test("a name-only tile wraps long names", () => {
    expect(html()).toContain("break-words");
  });

  test("tolerates junk items and renders on a dark section", () => {
    const out = html(
      {},
      { [pageFeedKey("partners")]: [null, "x", ...FEED] },
      { surface: true }
    );
    expect(out).toContain("text-ink");
    expect(out).toContain("grid-cols-2");
  });

  test("two columns on the narrowest page, four on wide containers", () => {
    const out = html();
    expect(out).toContain("grid grid-cols-2 gap-5 @3xl:grid-cols-4");
    expect(out).not.toContain("grid-cols-1");
  });

  test("a name-only tile is a wide, short strip on phones", () => {
    const out = html();
    expect(out).toContain("flex @md:aspect-video aspect-[3/1] items-center");
  });
});
