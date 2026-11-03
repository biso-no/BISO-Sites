import { describe, expect, it } from "vitest";
import { BISO_THEME, contrastRatio, themeTokens } from "./page-theme";
import { TEXT_COLOUR_TOKENS, type TextColourToken } from "./text-colour-tokens";
import {
  nearestTextColour,
  PASTE_COLOUR_MAX_DISTANCE,
  parseCssColour,
  textSwatches,
} from "./text-colours";

const PURPLE = { dark: "#3b1c6b", accent: "#fecd45" };
const WHITE = "#ffffff";
const TINT = "#eef1f5";
const BISO_DEEP_SURFACES = ["#001a35", "#0b2747", "#00142a"];

function swatch(
  theme: Parameters<typeof textSwatches>[0],
  token: TextColourToken
) {
  const found = textSwatches(theme).find((s) => s.token === token);
  if (!found) {
    throw new Error(`no ${token} swatch`);
  }
  return found;
}

describe("textSwatches", () => {
  it("BISO swatches are the CSS defaults", () => {
    expect(textSwatches(null)).toEqual(textSwatches(BISO_THEME));
    expect(
      textSwatches(null).map((s) => [s.token, s.label, s.paper, s.deep])
    ).toEqual([
      ["accent", "Accent", "#1668ae", "#3aa3e1"],
      ["muted", "Muted", "#526475", "#93a7bb"],
      ["green", "Green", "#187244", "#26b66d"],
      ["amber", "Amber", "#8a5a00", "#dd9000"],
      ["red", "Red", "#b3261e", "#ff6f61"],
    ]);
  });

  it("lists the swatches in token order", () => {
    expect(textSwatches(PURPLE).map((s) => s.token)).toEqual([
      ...TEXT_COLOUR_TOKENS,
    ]);
  });

  it("a department theme moves the accent and the deep inks, not the fixed paper hues", () => {
    const tokens = themeTokens(PURPLE);
    const accent = swatch(PURPLE, "accent");
    const muted = swatch(PURPLE, "muted");
    const green = swatch(PURPLE, "green");
    expect(accent.paper).toBe(tokens["--biso-blue"]);
    expect(accent.deep).toBe("#fecd45");
    expect(muted.paper).toBe("#526475");
    expect(muted.deep).toBe(tokens["--biso-deep-ink-muted"]);
    expect(green.deep).toBe(tokens["--biso-deep-ink-green"]);
    expect(green.paper).toBe("#187244");
    expect(swatch(PURPLE, "amber").deep).toBe(tokens["--biso-deep-ink-amber"]);
    expect(swatch(PURPLE, "red").deep).toBe(tokens["--biso-deep-ink-red"]);
  });

  it("falls back to the BISO swatches for a theme that is not hex", () => {
    expect(textSwatches({ dark: "navy", accent: "#fecd45" })).toEqual(
      textSwatches(null)
    );
    expect(textSwatches({ dark: "#3b1c6b", accent: "#fff;}" })).toEqual(
      textSwatches(null)
    );
  });

  it.each([
    null,
    PURPLE,
  ])("every swatch passes 4.5:1 on paper and on deep under %o", (theme) => {
    const tokens = theme ? themeTokens(theme) : null;
    const deepSurfaces = tokens
      ? [
          tokens["--biso-deep"],
          tokens["--biso-deep-raised"],
          tokens["--biso-deep-sunken"],
        ]
      : BISO_DEEP_SURFACES;
    for (const s of textSwatches(theme)) {
      for (const surface of [WHITE, TINT]) {
        expect({
          token: s.token,
          surface,
          ok: contrastRatio(s.paper, surface) >= 4.5,
        }).toEqual({ token: s.token, surface, ok: true });
      }
      for (const surface of deepSurfaces) {
        expect({
          token: s.token,
          surface,
          ok: contrastRatio(s.deep, surface) >= 4.5,
        }).toEqual({ token: s.token, surface, ok: true });
      }
    }
  });
});

describe("nearestTextColour", () => {
  it.each([
    ["#c00000", "red"],
    ["#ff0000", "red"],
    ["#0070c0", "accent"],
    ["#4472c4", "accent"],
    ["#00b050", "green"],
    ["#ed7d31", "amber"],
    ["#7f7f7f", "muted"],
    ["#000000", null],
    ["#002060", null],
    ["#7030a0", null],
    ["#ffff00", null],
    ["#ff66cc", null],
    ["#92d050", null],
    ["#ffffff", null],
  ])("nearestTextColour(%s) under BISO is %p", (hex, token) =>
    expect(nearestTextColour(hex, textSwatches(null))).toBe(token));

  it("counts a swatch by its deep variant too", () => {
    expect(nearestTextColour("#ff6f61", textSwatches(null))).toBe("red");
    expect(nearestTextColour("#3aa3e1", textSwatches(null))).toBe("accent");
  });

  it("gives no colour for a value that is not hex", () => {
    expect(nearestTextColour("red", textSwatches(null))).toBeNull();
  });

  it("the paste threshold is pinned", () =>
    expect(PASTE_COLOUR_MAX_DISTANCE).toBe(0.12));
});

describe("parseCssColour", () => {
  it.each([
    ["#C00000", "#c00000"],
    ["#c00", "#cc0000"],
    ["rgb(192, 0, 0)", "#c00000"],
    ["rgba(192,0,0,1)", "#c00000"],
    [" Red ", "#ff0000"],
    ["windowtext", "#000000"],
    ["rgba(192,0,0,0.5)", null],
    ["transparent", null],
    ["inherit", null],
  ])("parseCssColour(%p)", (value, hex) =>
    expect(parseCssColour(value)).toBe(hex));

  it.each([
    ["RGB(300, -4, 0)", "#ff0000"],
    ["rgb(192 0 0)", "#c00000"],
    ["rgb(192 0 0 / 1)", "#c00000"],
    ["rgba(192, 0, 0, 100%)", "#c00000"],
    ["NAVY", "#000080"],
    ["aqua", "#00ffff"],
    ["c00000", null],
    ["#c000", null],
    ["rgb(192, 0)", null],
    ["rgb(192 0 0 / 0.99)", null],
    ["constructor", null],
    ["", null],
  ])("also parseCssColour(%p)", (value, hex) =>
    expect(parseCssColour(value)).toBe(hex));
});
