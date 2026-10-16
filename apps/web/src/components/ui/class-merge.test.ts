import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cn } from "@repo/ui/lib/utils";
import { describe, expect, it } from "vitest";

/**
 * `cn(base, className)` must let a restyled component's corner and shadow
 * replace the shared component's defaults.
 *
 * tailwind-merge did not know the BISO scales, so `rounded-biso-md` and
 * `shadow-elev-2` were kept beside `rounded-md` and `shadow-md`, and the
 * defaults won on stylesheet order: every restyled Select, Popover and Dialog
 * came out with a 6px corner and a neutral grey shadow instead of the navy
 * one. The names are read from the theme, so a new token cannot be missed.
 */
const globals = readFileSync(
  join(import.meta.dirname, "../../../../../packages/ui/styles/globals.css"),
  "utf8"
);
const RADIUS_TOKEN = /--radius-(biso-[a-z]+)\s*:/g;
const SHADOW_TOKEN = /--shadow-(elev-\d+)\s*:/g;

const radii = [...globals.matchAll(RADIUS_TOKEN)].map((match) => match[1]);
const shadows = [...globals.matchAll(SHADOW_TOKEN)].map((match) => match[1]);

describe("cn and the BISO scales", () => {
  it("finds the scales in the theme", () => {
    expect(radii).toEqual(["biso-sm", "biso-md", "biso-lg", "biso-pill"]);
    expect(shadows).toEqual(["elev-1", "elev-2"]);
  });

  it.each(radii)("lets rounded-%s replace a component's corner", (name) => {
    expect(cn("rounded-md border", `rounded-${name}`)).toBe(
      `border rounded-${name}`
    );
  });

  it.each(shadows)("lets shadow-%s replace a component's shadow", (name) => {
    expect(cn("shadow-md", `shadow-${name}`)).toBe(`shadow-${name}`);
  });

  it("does not mistake an elevation for a shadow colour", () => {
    // Read as a colour, `shadow-elev-2` used to remove a real colour class.
    expect(cn("shadow-black/10", "shadow-elev-2")).toBe(
      "shadow-black/10 shadow-elev-2"
    );
  });
});
