import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MermaidFrame, naturalWidth } from "./mermaid";

// The shape Mermaid's render() returns: the root carries the natural size, and
// a marker inside it has a viewBox of its own.
const SVG =
  '<svg id="m" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 1781.25px;" viewBox="-8 -8 1781.25 412" role="graphics-document document"><marker viewBox="0 0 10 10"></marker></svg>';

const VARIANT_ON_FLOOR = /[\w@-]+:\[&amp;&gt;svg\]:min-w/;

test("the natural width comes from the root svg's viewBox", () => {
  expect(naturalWidth(SVG)).toBe(1781.25);
  expect(naturalWidth('<svg viewBox="0,0,714,90"></svg>')).toBe(714);
});

test("a nested viewBox is never read as the natural width", () => {
  expect(
    naturalWidth(
      '<svg width="100%"><marker viewBox="0 0 10 10"></marker></svg>'
    )
  ).toBeNull();
});

test("the frame scrolls sideways and keeps the diagram at 75% or more", () => {
  const html = renderToStaticMarkup(<MermaidFrame svg={SVG} />);
  expect(html).toContain("overflow-x-auto");
  expect(html).toContain("contain-inline-size");
  expect(html).toContain("[&amp;&gt;svg]:min-w-(--mermaid-min-width)");
  // At every width: no breakpoint or container-query variant on the floor.
  expect(html).not.toMatch(VARIANT_ON_FLOOR);
  expect(html).toContain("--mermaid-min-width:1336px");
  expect(html).toContain('viewBox="-8 -8 1781.25 412"');
});

test("without a viewBox no minimum width is set", () => {
  const html = renderToStaticMarkup(<MermaidFrame svg="<svg></svg>" />);
  expect(html).not.toContain("style=");
  expect(html).toContain("overflow-x-auto");
});
