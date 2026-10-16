import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { HeroBlock } from "@/editor/types";
import { HeroRender } from "./render";

const hero = (patch: Partial<HeroBlock> = {}): HeroBlock => ({
  ctaLabel: "Join",
  ctaUrl: "/join",
  eyebrow: "BISO Oslo",
  id: "hero-1",
  subtitle: "Sub",
  title: "Fadderullan",
  type: "hero",
  variant: "split",
  ...patch,
});

const render = (block: HeroBlock) =>
  renderToStaticMarkup(
    <HeroRender block={block} edit={false} onPatch={() => undefined} />
  );

describe("hero image", () => {
  test("the split art panel shows the crest until a photo is set", () => {
    const html = render(hero());
    expect(html).toContain("pg-hero-art__crest");
    expect(html).not.toContain("<img");
  });

  test("a photo fills the split art panel instead of the crest", () => {
    const html = render(
      hero({ imageAlt: "Students at kick-off", imageSrc: "https://x/y.jpg" })
    );
    expect(html).toContain('class="pg-hero-art__img"');
    expect(html).toContain('alt="Students at kick-off"');
    expect(html).not.toContain("pg-hero-art__crest");
  });

  test("the full variant puts the photo behind the copy under the brand overlay", () => {
    const html = render(hero({ imageSrc: "https://x/y.jpg", variant: "full" }));
    expect(html).toContain('class="pg-hero__bg"');
    expect(html).toContain("pg-hero__bg-overlay");
    expect(html).not.toContain("pg-hero-art");
  });

  test("the public CTA is a link and the editor CTA is a button", () => {
    expect(render(hero())).toContain('href="/join"');
    expect(
      renderToStaticMarkup(
        <HeroRender block={hero()} edit={true} onPatch={() => undefined} />
      )
    ).toContain('<button class="pg-hero__cta"');
  });
});
