import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { MarqueeBlock } from "@/editor/types";
import { classesOf, parseHtml } from "@/lib/test-dom";
import { MarqueeRender } from "./render";

const block: MarqueeBlock = {
  id: "m1",
  text: "Tirsdager · Tromsø · Gløgg",
  type: "marquee",
};

const render = (b: unknown, edit = false) =>
  parseHtml(
    renderToStaticMarkup(
      <section data-surface="deep">
        <MarqueeRender
          block={b as MarqueeBlock}
          edit={edit}
          onPatch={() => undefined}
        />
      </section>
    )
  );

describe("marquee render", () => {
  test("the site has two tracks and only the copy is hidden from readers", () => {
    const tracks = [...render(block).querySelectorAll(".pg-marquee__track")];
    expect(tracks).toHaveLength(2);
    expect(tracks[0].getAttribute("aria-hidden")).toBeNull();
    expect(tracks[1].getAttribute("aria-hidden")).toBe("true");
    expect(tracks[0].textContent).toContain("Tromsø");
    const band = render(block).querySelector(".pg-marquee");
    expect(classesOf(band)).toContain("pg-marquee--live");
  });

  test("text is display type, uppercase", () => {
    const track = render(block).querySelector(".pg-marquee__track");
    expect(classesOf(track)).toContain("type-display-sm");
    expect(classesOf(track)).toContain("uppercase");
  });

  test("an empty text renders nothing on the site", () => {
    expect(
      render({ ...block, text: " · " }).querySelector(".pg-marquee")
    ).toBeNull();
    expect(
      render({ id: "m2", type: "marquee" }).querySelector(".pg-marquee")
    ).toBeNull();
  });

  test("in the editor it is one static editable line, not animated", () => {
    const root = render(block, true);
    expect(root.querySelectorAll(".pg-marquee__track")).toHaveLength(0);
    expect(root.querySelector("[contenteditable]")?.textContent).toBe(
      block.text
    );
    expect(classesOf(root.querySelector(".pg-marquee"))).not.toContain(
      "pg-marquee--live"
    );
  });
});

describe("marquee css", () => {
  const css = readFileSync(
    join(import.meta.dir, "..", "..", "theme", "sections.css"),
    "utf8"
  );

  test("the animation is switched off under reduced motion", () => {
    const start = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".pg-marquee")
    );
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf("\n}\n", start));
    expect(rule).toContain(".pg-marquee--live");
    expect(rule).toContain("animation: none");
    expect(rule).toContain('.pg-marquee__track[aria-hidden="true"]');
  });
});
