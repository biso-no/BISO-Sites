import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import EnglishPreviewPage, { metadata as englishMetadata } from "./en/page";
import media from "./media.json";
import NorwegianPreviewPage, { metadata as norwegianMetadata } from "./page";

const VIDEO_TAG = /<video[^>]*>/g;
const H1_OPEN = /<h1[\s>]/g;
const NORWEGIAN_WORDS = [
  "prosjekter",
  "campuser",
  "dager",
  "kontakt",
  "følg",
  "arrangementer",
];
const WORD_WITH_NORWEGIAN_LETTER = /[^\s<>"]*[æøå][^\s<>"]*/gi;

const routes = [
  {
    html: () => renderToStaticMarkup(<NorwegianPreviewPage />),
    locale: "no",
    metadata: norwegianMetadata,
    play: "Spill av video",
  },
  {
    html: () => renderToStaticMarkup(<EnglishPreviewPage />),
    locale: "en",
    metadata: englishMetadata,
    play: "Play video",
  },
] as const;

describe.each(routes)("the $locale preview", (route) => {
  test("is noindex and nofollow", () => {
    expect(route.metadata.robots).toEqual({ index: false, follow: false });
  });

  test("renders the header, with the page's only h1", () => {
    const html = route.html();
    expect(html).toContain("pg-header");
    expect(html.match(H1_OPEN)?.length).toBe(1);
    expect(html).toContain(">Winter Games</h1>");
  });

  test("the header loop is muted and inline, with a reduced-motion poster", () => {
    const html = route.html();
    const videos = html.match(VIDEO_TAG) ?? [];
    // The aftermovie is a poster and a play button until it is clicked, so
    // the header loop is the only video the page loads.
    expect(videos).toHaveLength(1);
    const loop = videos[0] ?? "";
    expect(loop).toContain(`src="${media["header-loop"].url}"`);
    for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) {
      expect(loop.toLowerCase()).toContain(attribute);
    }
    expect(loop).toContain("poster=");
    expect(html).toContain("pg-reduced-motion-video");
    expect(html).toContain("pg-reduced-motion-poster");
  });

  test("the aftermovie shows its poster and a play button", () => {
    const html = route.html();
    expect(html).toContain('id="aftermovie"');
    expect(html).toContain(`aria-label="${route.play}"`);
    expect(html).toContain("wg26-aftermovie-poster");
  });

  test("the empty events block collapses", () => {
    const html = route.html();
    expect(html).not.toContain('data-block="events"');
    expect(html).not.toContain("Kommende arrangementer");
    expect(html).not.toContain("Upcoming events");
  });

  test("shows no phone link", () => {
    expect(route.html()).not.toContain("tel:");
  });
});

describe("the English preview's markup", () => {
  test("contains none of the Norwegian words", () => {
    const html = renderToStaticMarkup(<EnglishPreviewPage />).toLowerCase();
    for (const word of NORWEGIAN_WORDS) {
      expect(html, word).not.toContain(word);
    }
  });

  test("uses æ, ø or å only in a person's name", () => {
    const html = renderToStaticMarkup(<EnglishPreviewPage />);
    expect(html.match(WORD_WITH_NORWEGIAN_LETTER)).toEqual(["Jørn"]);
  });
});
