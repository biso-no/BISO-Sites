import { describe, expect, it } from "vitest";
import {
  BISO_THEME,
  checkTheme,
  contrastRatio,
  hexToHsv,
  hsvToHex,
  hueOf,
  isBisoTheme,
  MIN_ACCENT_ON_DARK,
  MIN_DARK_ON_WHITE,
  nearestPassingShade,
  normalizeHex,
  parsePageTheme,
  THEME_QUICK_PICKS,
  themeCss,
  themeTokens,
} from "./page-theme";

const WHITE = "#ffffff";
const TINT = "#eef1f5";
const HEX = /^#[0-9a-f]{6}$/;
/** Below this HSL saturation the hue is undefined (greys), so hue checks are skipped. */
const MIN_HUE_SATURATION = 0.05;

function saturationOf(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return 0;
  }
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

function hueDelta(a: string, b: string): number {
  const d = Math.abs(hueOf(a) - hueOf(b));
  return Math.min(d, 360 - d);
}

function expectSameHue(a: string, b: string) {
  if (saturationOf(a) < MIN_HUE_SATURATION) {
    return;
  }
  expect(hueDelta(a, b)).toBeLessThanOrEqual(2);
}

describe("constants", () => {
  it("exposes the BISO theme and quick picks", () => {
    expect(BISO_THEME).toEqual({ dark: "#001a35", accent: "#3aa3e1" });
    expect(THEME_QUICK_PICKS.map((p) => p.hex)).toEqual([
      "#001a35",
      "#1668ae",
      "#3aa3e1",
      "#fecd45",
    ]);
    expect(MIN_DARK_ON_WHITE).toBe(7);
    expect(MIN_ACCENT_ON_DARK).toBe(4.5);
  });
});

describe("normalizeHex", () => {
  it("normalises valid input", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("3AA3E1")).toBe("#3aa3e1");
    expect(normalizeHex(" #001A35 ")).toBe("#001a35");
    expect(normalizeHex("#abcdef")).toBe("#abcdef");
  });
  it("rejects everything else", () => {
    for (const bad of ["red", "#12345", "#fff;}", "", "#ggg", "##fff"]) {
      expect(normalizeHex(bad)).toBeNull();
    }
  });
});

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#001a35", WHITE)).toBeCloseTo(17.51, 1);
    expect(Math.abs(contrastRatio("#1668ae", WHITE) - 5.79)).toBeLessThan(0.05);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#3aa3e1", "#001a35")).toBeCloseTo(
      contrastRatio("#001a35", "#3aa3e1"),
      6
    );
  });
});

describe("colour conversions", () => {
  it("hueOf returns HSL hue in degrees", () => {
    expect(hueOf("#ff0000")).toBeCloseTo(0, 1);
    expect(hueOf("#00ff00")).toBeCloseTo(120, 1);
    expect(hueOf("#0000ff")).toBeCloseTo(240, 1);
  });
  it("hsv round-trips through hex", () => {
    for (const hex of ["#3aa3e1", "#001a35", "#fecd45", "#c8a2f0", "#808080"]) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });
  it("hsvToHex clamps and wraps", () => {
    expect(hsvToHex(360, 1, 1)).toBe("#ff0000");
    expect(hsvToHex(-120, 1, 1)).toBe("#0000ff");
    expect(hsvToHex(0, 2, 2)).toBe("#ff0000");
    expect(hsvToHex(0, -1, 0)).toBe("#000000");
  });
  it("hexToHsv returns zero for invalid input", () => {
    expect(hexToHsv("nope")).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe("checkTheme", () => {
  it("passes the BISO theme", () => {
    expect(checkTheme(BISO_THEME).ok).toBe(true);
  });
  it("suggests a dark just past 7:1 with the same hue", () => {
    const check = checkTheme({ dark: "#9b5de5", accent: "#3aa3e1" });
    expect(check.dark.ok).toBe(false);
    expect(check.ok).toBe(false);
    const suggestion = check.dark.suggestion as string;
    expect(suggestion).toMatch(HEX);
    const ratio = contrastRatio(suggestion, WHITE);
    expect(ratio).toBeGreaterThanOrEqual(7);
    expect(ratio).toBeLessThan(7.3);
    expectSameHue(suggestion, "#9b5de5");
    expect(hueDelta(suggestion, "#9b5de5")).toBeLessThanOrEqual(2);
  });
  it("flags an accent under 4.5:1 on the dark and suggests a lighter one", () => {
    const check = checkTheme({ dark: "#001a35", accent: "#1668ae" });
    expect(check.accent.ok).toBe(false);
    expect(check.accent.ratio).toBeLessThan(4.5);
    expect(check.dark.ok).toBe(true);
    const suggestion = check.accent.suggestion as string;
    expect(contrastRatio(suggestion, "#001a35")).toBeGreaterThanOrEqual(4.5);
    expect(hueDelta(suggestion, "#1668ae")).toBeLessThanOrEqual(2);
  });
  it("computes the accent suggestion against the suggested dark when the dark fails", () => {
    const check = checkTheme({ dark: "#9b5de5", accent: "#9b5de5" });
    const dark = check.dark.suggestion as string;
    const accent = check.accent.suggestion as string;
    expect(contrastRatio(accent, dark)).toBeGreaterThanOrEqual(4.5);
  });
  it("treats unparsable colours as failing without a suggestion", () => {
    const check = checkTheme({ dark: "nope", accent: "#fff;}" });
    expect(check.ok).toBe(false);
    expect(check.dark.suggestion).toBeNull();
    expect(check.accent.suggestion).toBeNull();
  });
});

describe("nearestPassingShade", () => {
  it("returns null when no lightness can pass", () => {
    expect(nearestPassingShade("#808080", "#808080", 21)).toBeNull();
  });
  it("returns the colour itself when it already passes", () => {
    expect(nearestPassingShade("#001a35", WHITE, 7)).toBe("#001a35");
  });
  it("never returns a value that fails after hex rounding", () => {
    const hues = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#9b5de5",
      "#fecd45",
    ];
    for (const hex of hues) {
      for (const min of [3, 4.5, 7, 10]) {
        for (const against of [WHITE, TINT, "#001a35", "#3b1c6b"]) {
          const out = nearestPassingShade(hex, against, min);
          if (out !== null) {
            expect(out).toMatch(HEX);
            expect(contrastRatio(out, against)).toBeGreaterThanOrEqual(min);
          }
        }
      }
    }
  });
  it("returns null for an invalid hex", () => {
    expect(nearestPassingShade("red", WHITE, 4.5)).toBeNull();
  });
});

describe("parsePageTheme", () => {
  it("accepts a valid, passing theme and normalises it", () => {
    expect(parsePageTheme({ dark: "#3b1c6b", accent: "#c8a2f0" })).toEqual({
      dark: "#3b1c6b",
      accent: "#c8a2f0",
    });
    expect(parsePageTheme({ dark: "#3B1C6B", accent: "#C8A2F0" })).toEqual({
      dark: "#3b1c6b",
      accent: "#c8a2f0",
    });
  });
  it("rejects a theme that fails contrast", () => {
    expect(parsePageTheme({ dark: "#9b5de5", accent: "#c8a2f0" })).toBeNull();
  });
  it("rejects hostile or malformed input", () => {
    expect(
      parsePageTheme({ dark: "#fff;}body{", accent: "#c8a2f0" })
    ).toBeNull();
    expect(parsePageTheme({ dark: "#3b1c6b", accent: "red" })).toBeNull();
    expect(parsePageTheme({ dark: "#3b1c6b" })).toBeNull();
    expect(parsePageTheme("x")).toBeNull();
    expect(parsePageTheme(null)).toBeNull();
    expect(parsePageTheme(undefined)).toBeNull();
  });
});

describe("themeTokens", () => {
  const theme = { dark: "#3b1c6b", accent: "#fecd45" };
  const tokens = themeTokens(theme);

  it("maps dark and accent onto deep and sky", () => {
    expect(tokens["--biso-deep"]).toBe("#3b1c6b");
    expect(tokens["--biso-sky"]).toBe("#fecd45");
  });
  it("derives a blue that passes on white and the tint, in the accent hue", () => {
    const blue = tokens["--biso-blue"];
    expect(contrastRatio(blue, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(blue, TINT)).toBeGreaterThanOrEqual(4.5);
    expectSameHue(blue, "#fecd45");
    expect(hueDelta(blue, "#fecd45")).toBeLessThanOrEqual(2);
  });
  it("keeps muted ink readable on deep and raised", () => {
    const muted = tokens["--biso-deep-ink-muted"];
    expect(contrastRatio(muted, tokens["--biso-deep"])).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(muted, tokens["--biso-deep-raised"])
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(muted, tokens["--biso-deep-sunken"])
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("derives distinct raised, sunken and edge surfaces", () => {
    for (const key of [
      "--biso-deep-raised",
      "--biso-deep-sunken",
      "--biso-deep-edge",
    ] as const) {
      expect(tokens[key]).toMatch(HEX);
      expect(tokens[key]).not.toBe("#3b1c6b");
    }
  });
  it("never sets ink tokens", () => {
    expect("--ink" in tokens).toBe(false);
    expect("--biso-ink" in tokens).toBe(false);
  });
  it("holds the contrast guarantees for the BISO theme too", () => {
    const t = themeTokens(BISO_THEME);
    expect(t["--biso-deep"]).toBe("#001a35");
    expect(contrastRatio(t["--biso-blue"], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["--biso-blue"], TINT)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(t["--biso-deep-ink-muted"], t["--biso-deep-raised"])
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("themeCss", () => {
  it("emits a :root block containing every token", () => {
    const theme = { dark: "#3b1c6b", accent: "#fecd45" };
    const css = themeCss(theme);
    expect(css.startsWith(":root{")).toBe(true);
    expect(css.endsWith("}")).toBe(true);
    for (const [key, value] of Object.entries(themeTokens(theme))) {
      expect(css).toContain(`${key}:${value}`);
    }
  });
  it("throws on a hostile theme", () => {
    expect(() =>
      themeCss({ dark: "#fff;}body{", accent: "#000000" })
    ).toThrow();
  });
});

describe("follow-ups", () => {
  it("parsePageTheme returns null for an object with a throwing getter", () => {
    const hostile = {
      get dark(): string {
        throw new Error("x");
      },
      accent: "#c8a2f0",
    };
    expect(parsePageTheme(hostile)).toBeNull();
  });
  it("keeps sunken distinct from a black dark", () => {
    const t = themeTokens({ dark: "#000000", accent: "#ffffff" });
    expect(t["--biso-deep-sunken"]).not.toBe("#000000");
    expect(t["--biso-deep-sunken"]).toMatch(HEX);
  });
  it("isBisoTheme compares normalised colours", () => {
    expect(isBisoTheme({ dark: "#001A35", accent: "#3AA3E1" })).toBe(true);
    expect(isBisoTheme({ dark: "#001a35", accent: "#fecd45" })).toBe(false);
    expect(isBisoTheme({ dark: "nope", accent: "#3aa3e1" })).toBe(false);
    expect(isBisoTheme(null)).toBe(false);
    expect(isBisoTheme(undefined)).toBe(false);
  });
});

/** Park-Miller modulus and multiplier (a minimal standard LCG). */
const LCG_MODULUS = 2_147_483_647;
const LCG_MULTIPLIER = 48_271;

/** Deterministic PRNG, so a sweep failure is reproducible. Returns [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed % LCG_MODULUS;
  return () => {
    state = (state * LCG_MULTIPLIER) % LCG_MODULUS;
    return (state - 1) / (LCG_MODULUS - 1);
  };
}

const SWEEP_SEED = 20_261_023;
const SWEEP_THEMES = 1500;
const SWEEP_ATTEMPTS = 200_000;
const HEX_CHANNELS = 0xff_ff_ff;

/**
 * Passing themes from random pairs. A failing pair is moved to the shades the
 * panel suggests, so the sweep is dense right at the thresholds, where a
 * derived surface is most likely to break a guarantee.
 */
function sweepThemes(): { accent: string; dark: string }[] {
  const random = seededRandom(SWEEP_SEED);
  const hex = () =>
    `#${Math.floor(random() * (HEX_CHANNELS + 1))
      .toString(16)
      .padStart(6, "0")}`;
  const themes: { accent: string; dark: string }[] = [];
  for (let i = 0; i < SWEEP_ATTEMPTS && themes.length < SWEEP_THEMES; i++) {
    let theme = { dark: hex(), accent: hex() };
    const check = checkTheme(theme);
    if (!check.ok) {
      const dark = check.dark.suggestion ?? theme.dark;
      const accent = check.accent.suggestion ?? theme.accent;
      theme = { dark, accent };
    }
    if (checkTheme(theme).ok) {
      themes.push(theme);
    }
  }
  return themes;
}

describe("themeTokens on a seeded sweep of passing themes", () => {
  const themes = [{ dark: "#261f1f", accent: "#e65c2e" }, ...sweepThemes()];

  it("sweeps at least 1000 passing themes", () => {
    expect(themes.length).toBeGreaterThanOrEqual(1000);
  });

  it("keeps the accent readable on the raised surface", () => {
    for (const theme of themes) {
      const t = themeTokens(theme);
      const ratio = contrastRatio(theme.accent, t["--biso-deep-raised"]);
      expect({ theme, ok: ratio >= MIN_ACCENT_ON_DARK }).toEqual({
        theme,
        ok: true,
      });
    }
  });

  it("keeps muted ink readable on raised and on the dark", () => {
    for (const theme of themes) {
      const t = themeTokens(theme);
      const muted = t["--biso-deep-ink-muted"];
      const onRaised = contrastRatio(muted, t["--biso-deep-raised"]);
      const onDark = contrastRatio(muted, t["--biso-deep"]);
      expect({ theme, ok: onRaised >= 4.5 && onDark >= 4.5 }).toEqual({
        theme,
        ok: true,
      });
    }
  });

  it("keeps the raised surface distinct from the dark", () => {
    for (const theme of themes) {
      const t = themeTokens(theme);
      expect({ theme, raised: t["--biso-deep-raised"] }).not.toEqual({
        theme,
        raised: t["--biso-deep"],
      });
    }
  });

  it("lifts #261f1f just enough to keep #e65c2e at 4.5 : 1", () => {
    const t = themeTokens({ dark: "#261f1f", accent: "#e65c2e" });
    const raised = t["--biso-deep-raised"];
    expect(raised).not.toBe("#261f1f");
    expect(contrastRatio("#e65c2e", raised)).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(t["--biso-deep-ink-muted"], raised)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
