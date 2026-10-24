/**
 * Page theme colour maths: hex handling, WCAG contrast, the nearest passing
 * shade, and the CSS custom properties a theme overrides.
 *
 * Pure TypeScript with no DOM, React or Node APIs, because it runs in the
 * browser editor, the admin server and the web server. Every colour that
 * reaches CSS text is rebuilt from `normalizeHex` output, so a stored value
 * can never inject CSS.
 */

export interface PageTheme {
  accent: string;
  dark: string;
}

export const BISO_THEME: PageTheme = { dark: "#001a35", accent: "#3aa3e1" };

export const THEME_QUICK_PICKS: readonly { hex: string; label: string }[] = [
  { hex: "#001a35", label: "Deep" },
  { hex: "#1668ae", label: "Blue" },
  { hex: "#3aa3e1", label: "Sky" },
  { hex: "#fecd45", label: "Sun" },
];

/** Dark colour against white. */
export const MIN_DARK_ON_WHITE = 7;
/** Accent against the dark colour (stands out, and carries button text). */
export const MIN_ACCENT_ON_DARK = 4.5;
/** Text-on-light minimum for the derived `--biso-blue`. */
const MIN_TEXT_ON_LIGHT = 4.5;

const WHITE = "#ffffff";
const SUNKEN_TINT = "#eef1f5";

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/;

/** Lightness offsets (HSL, 0-1) for the derived deep surfaces. */
const RAISED_STEP = 0.05;
const SUNKEN_STEP = 0.03;
const EDGE_STEP = 0.1;
/** Share of white in the muted ink before it is raised to pass. */
const MUTED_START = 0.55;
const MUTED_INCREMENT = 0.01;
/** Lightness nudge applied when hex rounding drops a result under the threshold. */
const ROUND_NUDGE = 0.001;
const SEARCH_ITERATIONS = 40;

export function normalizeHex(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }
  const match = HEX_PATTERN.exec(input.trim().toLowerCase());
  if (!match) {
    return null;
  }
  const digits = match[1] as string;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return `#${full}`;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb | null {
  const normal = normalizeHex(hex);
  if (!normal) {
    return null;
  }
  return [
    Number.parseInt(normal.slice(1, 3), 16),
    Number.parseInt(normal.slice(3, 5), 16),
    Number.parseInt(normal.slice(5, 7), 16),
  ];
}

function channelHex(value: number): string {
  const clamped = Math.min(255, Math.max(0, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.x contrast ratio. Returns 0 if either colour is not a valid hex. */
export function contrastRatio(a: string, b: string): number {
  const ra = toRgb(a);
  const rb = toRgb(b);
  if (!(ra && rb)) {
    return 0;
  }
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- HSL / HSV ---------------------------------------------------------------

interface Hsl {
  h: number; // 0-360
  l: number; // 0-1
  s: number; // 0-1
}

function rgbToHsl([r8, g8, b8]: Rgb): Hsl {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const sat = Math.min(1, Math.max(0, s));
  const light = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: Rgb;
  if (hp < 1) {
    rgb = [c, x, 0];
  } else if (hp < 2) {
    rgb = [x, c, 0];
  } else if (hp < 3) {
    rgb = [0, c, x];
  } else if (hp < 4) {
    rgb = [0, x, c];
  } else if (hp < 5) {
    rgb = [x, 0, c];
  } else {
    rgb = [c, 0, x];
  }
  const m = light - c / 2;
  return rgbToHex([(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255]);
}

/**
 * HSL hue of a hex colour, 0-360. Greys have no defined hue and return 0, so
 * callers comparing hues should skip near-greys (HSL saturation near 0).
 */
export function hueOf(hex: string): number {
  const rgb = toRgb(hex);
  return rgb ? rgbToHsl(rgb).h : 0;
}

export interface Hsv {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

/** For the colour picker's saturation/value square. Invalid input gives black. */
export function hexToHsv(hex: string): Hsv {
  const rgb = toRgb(hex);
  if (!rgb) {
    return { h: 0, s: 0, v: 0 };
  }
  const [r, g, b] = rgb.map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const { h } = rgbToHsl(rgb);
  return { h, s: max === 0 ? 0 : (max - min) / max, v: max };
}

/** Inverse of `hexToHsv`. Hue wraps; saturation and value clamp to 0-1. */
export function hsvToHex(h: number, s: number, v: number): string {
  const sat = Math.min(1, Math.max(0, s));
  const val = Math.min(1, Math.max(0, v));
  const l = val * (1 - sat / 2);
  const sl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);
  return hslToHex({ h, s: sl, l });
}

// --- nearest passing shade ---------------------------------------------------

/**
 * Keeps hue and saturation and moves lightness just past `minRatio` against
 * `against`. Returns the colour unchanged if it already passes, and null if no
 * lightness of this hue can pass. The result is re-checked after rounding to
 * hex and nudged one step further if rounding dropped it under the threshold.
 */
export function nearestPassingShade(
  hex: string,
  against: string,
  minRatio: number
): string | null {
  const rgb = toRgb(hex);
  const normalAgainst = normalizeHex(against);
  if (!(rgb && normalAgainst)) {
    return null;
  }
  const start = normalizeHex(hex) as string;
  if (contrastRatio(start, normalAgainst) >= minRatio) {
    return start;
  }
  const hsl = rgbToHsl(rgb);
  const at = (l: number) => hslToHex({ ...hsl, l });

  // Move lightness towards whichever extreme gives more contrast.
  const darkEnd = contrastRatio(at(0), normalAgainst);
  const lightEnd = contrastRatio(at(1), normalAgainst);
  const target = darkEnd >= lightEnd ? 0 : 1;
  if (Math.max(darkEnd, lightEnd) < minRatio) {
    return null;
  }

  let failing = hsl.l;
  let passing = target;
  for (let i = 0; i < SEARCH_ITERATIONS; i++) {
    const mid = (failing + passing) / 2;
    if (contrastRatio(at(mid), normalAgainst) >= minRatio) {
      passing = mid;
    } else {
      failing = mid;
    }
  }

  // Re-check after rounding to hex; step towards the target until it passes.
  const direction = target > hsl.l ? 1 : -1;
  let l = passing;
  let result = at(l);
  while (contrastRatio(result, normalAgainst) < minRatio) {
    l += direction * ROUND_NUDGE;
    if ((direction > 0 && l >= target) || (direction < 0 && l <= target)) {
      result = at(target);
      break;
    }
    result = at(l);
  }
  return contrastRatio(result, normalAgainst) >= minRatio ? result : null;
}

// --- theme checks ------------------------------------------------------------

export interface ColourCheck {
  ok: boolean;
  ratio: number;
  suggestion: string | null;
}

export interface ThemeCheck {
  accent: ColourCheck;
  dark: ColourCheck;
  ok: boolean;
}

const INVALID: ColourCheck = { ok: false, ratio: 0, suggestion: null };

/**
 * The accent the panel offers in place of a failing one. It is aimed at the
 * dark's raised surface at the full step rather than at the dark itself, so
 * using it leaves room above the dark: `themeTokens` shrinks raised only for
 * an accent that just scrapes past 4.5 : 1, and raised cards would then look
 * like the background. Falls back to the shade just past the dark when no
 * shade of the hue passes on raised. Passing is still judged on the dark.
 */
function suggestAccent(accent: string, dark: string): string | null {
  const roomy = nearestPassingShade(
    accent,
    shiftLightness(dark, RAISED_STEP),
    MIN_ACCENT_ON_DARK
  );
  if (roomy && contrastRatio(roomy, dark) >= MIN_ACCENT_ON_DARK) {
    return roomy;
  }
  return nearestPassingShade(accent, dark, MIN_ACCENT_ON_DARK);
}

export function checkTheme(theme: PageTheme): ThemeCheck {
  const dark = normalizeHex(theme.dark);
  const accent = normalizeHex(theme.accent);

  let darkCheck: ColourCheck = INVALID;
  let darkForAccent: string | null = dark;
  if (dark) {
    const ratio = contrastRatio(dark, WHITE);
    const ok = ratio >= MIN_DARK_ON_WHITE;
    const suggestion = ok
      ? null
      : nearestPassingShade(dark, WHITE, MIN_DARK_ON_WHITE);
    darkCheck = { ok, ratio, suggestion };
    // A failing dark is judged by the shade it would be moved to.
    darkForAccent = ok ? dark : (suggestion ?? dark);
  }

  let accentCheck: ColourCheck = INVALID;
  if (accent && dark && darkForAccent) {
    const ratio = contrastRatio(accent, dark);
    const ok = ratio >= MIN_ACCENT_ON_DARK;
    const suggestion = ok ? null : suggestAccent(accent, darkForAccent);
    accentCheck = { ok, ratio, suggestion };
  }

  return {
    dark: darkCheck,
    accent: accentCheck,
    ok: darkCheck.ok && accentCheck.ok,
  };
}

/** True when both colours, normalised, are BISO's own. Null/invalid give false. */
export function isBisoTheme(theme: PageTheme | null | undefined): boolean {
  if (!theme) {
    return false;
  }
  return (
    normalizeHex(theme.dark) === BISO_THEME.dark &&
    normalizeHex(theme.accent) === BISO_THEME.accent
  );
}

export function parsePageTheme(value: unknown): PageTheme | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  let dark: unknown;
  let accent: unknown;
  try {
    ({ dark, accent } = value as Record<string, unknown>);
  } catch {
    // A throwing getter on a stored or AI-supplied object is just invalid.
    return null;
  }
  if (typeof dark !== "string" || typeof accent !== "string") {
    return null;
  }
  const normal = { dark: normalizeHex(dark), accent: normalizeHex(accent) };
  if (!(normal.dark && normal.accent)) {
    return null;
  }
  const theme: PageTheme = { dark: normal.dark, accent: normal.accent };
  return checkTheme(theme).ok ? theme : null;
}

// --- CSS tokens --------------------------------------------------------------

function shiftLightness(hex: string, delta: number): string {
  const rgb = toRgb(hex) as Rgb;
  const hsl = rgbToHsl(rgb);
  return hslToHex({ ...hsl, l: Math.min(1, Math.max(0, hsl.l + delta)) });
}

/**
 * One step below the dark. When that floors to the dark itself (e.g. #000000)
 * there is no room below, so nudge upwards by the smallest lightness step that
 * produces a different hex, keeping sunken distinct.
 */
function deriveSunken(dark: string): string {
  const below = shiftLightness(dark, -SUNKEN_STEP);
  if (below !== dark) {
    return below;
  }
  for (let delta = ROUND_NUDGE; delta <= SUNKEN_STEP; delta += ROUND_NUDGE) {
    const above = shiftLightness(dark, delta);
    if (above !== dark) {
      return above;
    }
  }
  return shiftLightness(dark, SUNKEN_STEP);
}

/** Lightness steps (in `ROUND_NUDGE` units) tried for the raised surface. */
const RAISED_STEPS = Math.round(RAISED_STEP / ROUND_NUDGE);

/**
 * The dark lifted by `RAISED_STEP`, or by less where the accent would fall
 * under 4.5 : 1 on it (info labels and hover titles sit on raised). The step
 * shrinks towards the smallest one that still gives a different hex. A passing
 * accent is always lighter than its dark, so if even that step fails, the
 * smallest step down is used instead: a darker surface only adds contrast.
 * Black has no step down, so a black dark whose accent only just passes gets
 * raised equal to the dark: readable beats distinct. A failing theme (painted
 * on the canvas while it is fixed) that no step rescues keeps the full step.
 */
function deriveRaised(dark: string, accent: string): string {
  const readable = (surface: string) =>
    contrastRatio(accent, surface) >= MIN_ACCENT_ON_DARK;
  // The full step exactly as `suggestAccent` aims at it.
  const full = shiftLightness(dark, RAISED_STEP);
  if (readable(full)) {
    return full;
  }
  for (let step = RAISED_STEPS - 1; step > 0; step--) {
    const raised = shiftLightness(dark, step * ROUND_NUDGE);
    if (raised === dark) {
      break;
    }
    if (readable(raised)) {
      return raised;
    }
  }
  for (let step = 1; step <= RAISED_STEPS; step++) {
    const below = shiftLightness(dark, -step * ROUND_NUDGE);
    if (below !== dark) {
      if (readable(below)) {
        return below;
      }
      break;
    }
  }
  return readable(dark) ? dark : full;
}

function mixWithWhite(dark: string, whiteShare: number): string {
  const [r, g, b] = toRgb(dark) as Rgb;
  const mix = (c: number) => c + (255 - c) * whiteShare;
  return rgbToHex([mix(r), mix(g), mix(b)]);
}

function deriveMutedInk(surfaces: string[], dark: string): string {
  let share = MUTED_START;
  let ink = mixWithWhite(dark, share);
  const passes = (c: string) =>
    surfaces.every((s) => contrastRatio(c, s) >= MIN_TEXT_ON_LIGHT);
  while (!passes(ink) && share < 1) {
    share = Math.min(1, share + MUTED_INCREMENT);
    ink = mixWithWhite(dark, share);
  }
  return ink;
}

/**
 * The custom properties a theme overrides. `--ink` and `--biso-ink` are never
 * set: text on white stays BISO.
 */
export function themeTokens(theme: PageTheme): Record<`--${string}`, string> {
  const dark = normalizeHex(theme.dark);
  const accent = normalizeHex(theme.accent);
  if (!(dark && accent)) {
    throw new Error("themeTokens: theme colours must be #rrggbb hex");
  }
  const raised = deriveRaised(dark, accent);
  const sunken = deriveSunken(dark);
  const edge = shiftLightness(dark, EDGE_STEP);

  // The tint is the darker of the two light surfaces, so it is the hard one.
  const blue =
    nearestPassingShade(accent, SUNKEN_TINT, MIN_TEXT_ON_LIGHT) ?? "#000000";
  const blueOnWhite = nearestPassingShade(blue, WHITE, MIN_TEXT_ON_LIGHT);

  return {
    "--biso-deep": dark,
    "--biso-sky": accent,
    "--biso-blue": blueOnWhite ?? blue,
    "--biso-deep-raised": raised,
    "--biso-deep-sunken": sunken,
    "--biso-deep-edge": edge,
    // Checked against the final raised, which may sit closer to the dark.
    "--biso-deep-ink-muted": deriveMutedInk([dark, raised, sunken], dark),
  };
}

/** `:root{--biso-deep:#…;…}`. Throws unless the theme is valid and passes contrast. */
export function themeCss(theme: PageTheme): string {
  const valid = parsePageTheme(theme);
  if (!valid) {
    throw new Error("themeCss: invalid page theme");
  }
  const body = Object.entries(themeTokens(valid))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `:root{${body}}`;
}
