import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: ({
    className,
    src,
  }: {
    className?: string;
    src: string;
  }) => createElement("img", { alt: "", className, src }),
}));

import { UnitCrest } from "./unit-crest";

const render = (logoUrl: string | null) =>
  renderToStaticMarkup(
    createElement(UnitCrest, {
      className: "h-14 w-14",
      unit: { graphName: "OSL Case Club", logoUrl, name: "Case Club" },
    })
  );

describe("UnitCrest", () => {
  it("lets a logo fill the whole tile, with no colour behind it", () => {
    const html = render("https://appwrite.biso.no/logo.png");

    expect(html).toContain('src="https://appwrite.biso.no/logo.png"');
    // Contain, not cover: a wide wordmark must shrink to fit rather than be
    // cropped to its middle letters.
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
    // The generated gradient is only a stand-in for a missing logo, and the
    // old inset padding left it showing as a coloured frame.
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("p-1.5");
  });

  it("puts a neutral plate behind the logo, not white", () => {
    // Some units upload a white logo on a transparent background and others a
    // dark one. Only a mid-light neutral keeps both readable; on white the
    // former disappears, on navy the latter does.
    //
    // Merged with the redesign: the plate is the `ink-muted` token at 30%
    // (≈ #cbd0d6 on paper, the tone `bg-slate-300` gave) instead of a raw
    // palette colour. It must not be the page's own surface either — the
    // sunken surface is #eef1f5, as invisible behind a white mark as white is.
    const html = render("https://appwrite.biso.no/logo.png");

    expect(html).toContain("bg-ink-muted/30");
    expect(html).not.toContain("bg-white");
    expect(html).not.toContain("bg-surface");
  });

  it("falls back to the coloured monogram when the unit has no logo", () => {
    const html = render(null);

    expect(html).toContain("linear-gradient");
    expect(html).toContain("CC");
    expect(html).not.toContain("<img");
  });
});
