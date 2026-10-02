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
    expect(html).toContain("object-cover");
    // The generated gradient is only a stand-in for a missing logo, and the
    // old inset padding left it showing as a coloured frame.
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("p-1.5");
  });

  it("falls back to the coloured monogram when the unit has no logo", () => {
    const html = render(null);

    expect(html).toContain("linear-gradient");
    expect(html).toContain("CC");
    expect(html).not.toContain("<img");
  });
});
