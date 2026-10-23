import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PageHeader } from "@/editor/types";
import { parseHtml } from "@/lib/test-dom";
import { emptyHeader } from "./empty-header";
import { PageHeaderView } from "./page-header-view";

const H1_OPEN = /<h1[\s>]/g;
const H1_TITLE = /<h1[^>]*>Fadderullan<\/h1>/;
const CONTENT_EDITABLE = /contentEditable="true"/g;
const PROMPT = "Add a photo or video in the inspector";

const header = (patch: Partial<PageHeader> = {}): PageHeader => ({
  ...emptyHeader("Fadderullan"),
  eyebrow: "BISO Oslo",
  lede: "Tre dager på Storefjell",
  ...patch,
});

const render = (h: PageHeader, edit = false) =>
  renderToStaticMarkup(
    <PageHeaderView
      edit={edit}
      header={h}
      onPatch={() => {
        /* noop */
      }}
    />
  );

describe("PageHeaderView", () => {
  test("a split header with an image is a navy band with the title as h1 and a chevron frame", () => {
    const html = render(
      header({
        media: { alt: "Studenter", kind: "image", src: "https://x.no/a.jpg" },
        variant: "split",
      })
    );
    expect(html).toContain('class="pg-header');
    expect(html).toContain('data-surface="deep"');
    expect(html).toContain('data-variant="split"');
    expect(html).toMatch(H1_TITLE);
    expect(html).toContain("chevron-frame");
    expect(html).toContain('alt="Studenter"');
  });

  test("header media is above the fold, so it loads eagerly", () => {
    const html = render(
      header({
        media: { kind: "image", src: "https://x.no/a.jpg" },
        variant: "split",
      })
    );
    expect(html).toContain('loading="eager"');
    expect(html).not.toContain('loading="lazy"');
  });

  test("without media there is no image; the editor shows a prompt, the site shows text only", () => {
    const site = render(header({ variant: "split" }));
    expect(site).not.toContain("<img");
    expect(site).not.toContain(PROMPT);
    expect(site).not.toContain("bg-surface-sunken");

    const edit = render(header({ variant: "split" }), true);
    expect(edit).not.toContain("<img");
    expect(edit).toContain(PROMPT);
  });

  test("a full header without media prompts in the editor only", () => {
    expect(render(header({ variant: "full" }))).not.toContain(PROMPT);
    expect(render(header({ variant: "full" }), true)).toContain(PROMPT);
  });

  test("a video is a muted loop with its reduced-motion poster, in both media variants", () => {
    const media = {
      kind: "video" as const,
      poster: "https://x.no/p.jpg",
      src: "https://x.no/v.mp4",
    };
    for (const variant of ["split", "full"] as const) {
      const html = render(header({ media, variant }));
      expect(html).toContain("muted");
      expect(html).toContain("loop");
      expect(html.toLowerCase()).toContain("playsinline");
      expect(html).toContain("pg-reduced-motion-poster");
    }
  });

  test("a full header puts its media behind a scrim and uses the hero display size", () => {
    const html = render(
      header({
        media: { alt: "", kind: "image", src: "https://x.no/a.jpg" },
        variant: "full",
      })
    );
    expect(html).toContain("pg-header__scrim");
    expect(html).toContain("type-display-hero");
    expect(html).not.toContain("chevron-frame");
  });

  test("plain shows no media even when one is stored", () => {
    const html = render(
      header({
        media: { kind: "image", src: "https://x.no/a.jpg" },
        variant: "plain",
      })
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("type-display-lg");
  });

  test("crumbs render a breadcrumb nav; the last one is the current page", () => {
    const html = render(
      header({
        crumbs: [
          { href: "/units", label: "Enheter" },
          { label: "Fadderullan" },
        ],
      })
    );
    expect(html).toContain('<nav aria-label="Breadcrumb"');
    expect(html).toContain('href="/units"');
    expect(html).toContain('aria-current="page"');
  });

  test("the title is the page's only h1", () => {
    const html = render(
      header({
        buttons: [{ href: "/join", label: "Bli med", style: "primary" }],
        crumbs: [{ label: "Fadderullan" }],
        media: { kind: "image", src: "https://x.no/a.jpg" },
        variant: "split",
      })
    );
    expect(html.match(H1_OPEN)).toHaveLength(1);
  });

  test("buttons are links on the site and inert in the editor", () => {
    const h = header({
      buttons: [
        { href: "/join", label: "Bli med", style: "primary" },
        { href: "/about", label: "Les mer", style: "secondary" },
      ],
    });
    const site = render(h);
    expect(site).toContain('href="/join"');
    expect(site).toContain('href="/about"');
    const edit = render(h, true);
    expect(edit).toContain("Bli med");
    expect(edit).not.toContain('href="/join"');
  });

  test("eyebrow, title and lede are editable inline", () => {
    const html = render(header(), true);
    expect(html.match(CONTENT_EDITABLE)).toHaveLength(3);
  });

  test("empty eyebrow and lede are left out on the site", () => {
    const html = render(header({ eyebrow: "", lede: "" }));
    expect(html).not.toContain("<p");
  });

  test("SVG and GIF media are not sent through the raster preview", () => {
    const view =
      "https://appwrite.biso.no/v1/storage/buckets/media/files/logo/view";
    const split = parseHtml(
      render(
        header({
          media: { kind: "image", mime: "image/svg+xml", src: view },
          variant: "split",
        })
      )
    );
    expect(split.querySelector("img")?.getAttribute("src")).toBe(view);
    const full = parseHtml(
      render(
        header({
          media: {
            kind: "video",
            poster: view,
            posterMime: "image/gif",
            src: "https://x.no/v.mp4",
          },
          variant: "full",
        })
      )
    );
    expect(full.querySelector("video")?.getAttribute("poster")).toBe(view);
  });
});
