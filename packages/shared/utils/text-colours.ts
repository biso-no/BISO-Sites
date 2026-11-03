/**
 * Rich text colour: the swatch each of the five tokens a span may carry
 * (`text-colour-tokens.ts`) shows under a page theme, and the token a pasted
 * CSS colour maps to.
 *
 * Colour is stored only as a token (`<span data-color="red">`), never as hex.
 * CSS paints it through `.pg-rich [data-color]`, which reads `--ink-<token>`:
 * the paper ink on light, the deep ink on a navy band. The swatches mirror
 * those values, so the picker shows what the page will show.
 *
 * Pure TypeScript, like `page-theme.ts`, whose hex and colour helpers it reads.
 */

import {
  isBisoTheme,
  linearize,
  normalizeHex,
  type PageTheme,
  type Rgb,
  rgbToHex,
  TEXT_HUES,
  themeTokens,
  toRgb,
} from "./page-theme";
import { TEXT_COLOUR_TOKENS, type TextColourToken } from "./text-colour-tokens";

export interface TextSwatch {
  /** On a navy band and in dark mode. */
  deep: string;
  label: string;
  /** On white and the light tints. */
  paper: string;
  token: TextColourToken;
}

type Inks = Record<TextColourToken, string>;

const LABELS: Inks = {
  accent: "Accent",
  muted: "Muted",
  green: "Green",
  amber: "Amber",
  red: "Red",
};

/**
 * BISO's CSS defaults from `biso-surface.css`. The canvas and the site paint
 * no theme CSS for BISO, so these are what a BISO page shows. Muted and the
 * hues keep their paper ink under every theme; only the accent's moves.
 */
const BISO_PAPER: Inks = {
  accent: "#1668ae",
  muted: "#526475",
  green: TEXT_HUES.green.paper,
  amber: TEXT_HUES.amber.paper,
  red: TEXT_HUES.red.paper,
};

const BISO_DEEP: Inks = {
  accent: "#3aa3e1",
  muted: "#93a7bb",
  green: TEXT_HUES.green.deep,
  amber: TEXT_HUES.amber.deep,
  red: TEXT_HUES.red.deep,
};

function swatchesOf(paper: Inks, deep: Inks): TextSwatch[] {
  return TEXT_COLOUR_TOKENS.map((token) => ({
    deep: deep[token],
    label: LABELS[token],
    paper: paper[token],
    token,
  }));
}

/**
 * The five swatches, in token order, as the page paints them. A theme that is
 * not hex gives BISO's, as the canvas paints no theme for it either
 * (`canvasThemeStyle`), so this never throws.
 */
export function textSwatches(theme: PageTheme | null): TextSwatch[] {
  if (
    !theme ||
    isBisoTheme(theme) ||
    !(normalizeHex(theme.dark) && normalizeHex(theme.accent))
  ) {
    return swatchesOf(BISO_PAPER, BISO_DEEP);
  }
  const tokens = themeTokens(theme);
  return swatchesOf(
    { ...BISO_PAPER, accent: tokens["--biso-blue"] },
    {
      accent: tokens["--biso-sky"],
      muted: tokens["--biso-deep-ink-muted"],
      green: tokens["--biso-deep-ink-green"],
      amber: tokens["--biso-deep-ink-amber"],
      red: tokens["--biso-deep-ink-red"],
    }
  );
}

// --- pasted colours ----------------------------------------------------------

/** The 16 CSS basic keywords, plus Word's "automatic" text colour. */
const CSS_KEYWORDS = new Map([
  ["black", "#000000"],
  ["silver", "#c0c0c0"],
  ["gray", "#808080"],
  ["white", "#ffffff"],
  ["maroon", "#800000"],
  ["red", "#ff0000"],
  ["purple", "#800080"],
  ["fuchsia", "#ff00ff"],
  ["green", "#008000"],
  ["lime", "#00ff00"],
  ["olive", "#808000"],
  ["yellow", "#ffff00"],
  ["navy", "#000080"],
  ["blue", "#0000ff"],
  ["teal", "#008080"],
  ["aqua", "#00ffff"],
  ["windowtext", "#000000"],
]);

const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
/** `rgb()`/`rgba()`, comma or space separated, with an optional alpha. */
const RGB_FUNCTION =
  /^rgba?\(\s*(-?[\d.]+)\s*[\s,]\s*(-?[\d.]+)\s*[\s,]\s*(-?[\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/;
/** Far longer than any colour; keeps the pattern above from slow backtracking. */
const MAX_COLOUR_LENGTH = 64;
const PERCENT = 100;

function parseRgbFunction(value: string): string | null {
  const match = RGB_FUNCTION.exec(value);
  if (!match) {
    return null;
  }
  const [, r, g, b, alpha, percent] = match;
  const channels = [r, g, b].map(Number);
  if (!channels.every(Number.isFinite)) {
    return null;
  }
  if (alpha !== undefined) {
    const opacity = Number(alpha) / (percent ? PERCENT : 1);
    if (!(opacity >= 1)) {
      return null;
    }
  }
  return rgbToHex(channels as Rgb);
}

/**
 * A pasted CSS colour as `#rrggbb`: hex, opaque `rgb()`/`rgba()` or a basic
 * keyword. Null for anything else, including any transparency, `transparent`
 * and `inherit`.
 */
export function parseCssColour(value: string): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const colour = value.trim().toLowerCase();
  if (colour.length > MAX_COLOUR_LENGTH) {
    return null;
  }
  if (HEX_COLOUR.test(colour)) {
    return normalizeHex(colour);
  }
  return CSS_KEYWORDS.get(colour) ?? parseRgbFunction(colour);
}

/** How far (OKLab) a pasted colour may sit from a swatch and still take it. */
export const PASTE_COLOUR_MAX_DISTANCE = 0.12;

/** Body ink a pasted colour may simply be: BISO navy, black and white. */
const BODY_INKS = ["#001a35", "#000000", "#ffffff"] as const;

type Oklab = [number, number, number];

/** sRGB to OKLab with Björn Ottosson's standard matrices. */
function toOklab(rgb: Rgb): Oklab {
  const [r, g, b] = rgb.map((channel) => linearize(channel)) as Rgb;
  const l = Math.cbrt(
    0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b
  );
  const m = Math.cbrt(
    0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b
  );
  const s = Math.cbrt(
    0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b
  );
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
}

/**
 * The token a pasted colour is closest to, by Euclidean distance in OKLab,
 * each swatch counting by its nearer variant (paper or deep). Null when body
 * ink is nearer than any swatch (the text was not really coloured), when no
 * swatch is within `PASTE_COLOUR_MAX_DISTANCE`, or when `hex` is not hex.
 */
export function nearestTextColour(
  hex: string,
  swatches: readonly TextSwatch[]
): TextColourToken | null {
  const rgb = toRgb(hex);
  if (!rgb) {
    return null;
  }
  const target = toOklab(rgb);
  const distanceTo = (candidate: string): number => {
    const other = toRgb(candidate);
    if (!other) {
      return Number.POSITIVE_INFINITY;
    }
    const [l, a, b] = toOklab(other);
    return Math.hypot(target[0] - l, target[1] - a, target[2] - b);
  };

  let nearest: TextColourToken | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const swatch of swatches) {
    const distance = Math.min(
      distanceTo(swatch.paper),
      distanceTo(swatch.deep)
    );
    if (distance < nearestDistance) {
      nearest = swatch.token;
      nearestDistance = distance;
    }
  }
  const inkDistance = Math.min(...BODY_INKS.map(distanceTo));
  if (
    inkDistance <= nearestDistance ||
    nearestDistance > PASTE_COLOUR_MAX_DISTANCE
  ) {
    return null;
  }
  return nearest;
}
