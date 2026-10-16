/**
 * A stand-in crest for a unit that has no logo.
 *
 * Not decoration for its own sake: `departments.logo` is empty for every one
 * of the ~125 public units, so a directory that renders only a generic icon
 * gives a student 125 identical cards and nothing to scan by. Deriving the
 * monogram and its hue from the unit's own name makes each card recognisable
 * and stable — the same unit is the same colour on every surface, every visit,
 * with no asset to upload and no value to store.
 *
 * Hues are spread across the full circle but pinned to a fixed saturation and
 * lightness, so the set reads as one palette rather than 125 unrelated colours,
 * and every member keeps white text above the 4.5:1 contrast floor.
 */

const NON_LETTER_RUN = /[^\p{L}\p{N}]+/u;

const HUE_STEPS = 360;
const SATURATION = 58;
/** Dark enough that white body text clears 4.5:1 at every hue. */
const LIGHTNESS = 38;
const GRADIENT_HUE_SHIFT = 24;
const GRADIENT_LIGHTNESS_SHIFT = 10;

export interface UnitMonogram {
  /** `background` value: a two-stop gradient in the unit's own hue. */
  background: string;
  /** One or two letters. */
  initials: string;
  /** Flat fill in the same hue, for small chips where a gradient muddies. */
  solid: string;
}

/**
 * FNV-1a. Any stable, well-mixed hash works; what matters is that it does not
 * depend on runtime state, so the server and the client agree and the colour
 * never changes between renders.
 */
function hashName(value: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < value.length; index += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: XOR-then-multiply IS the FNV-1a construction; without the XOR the hash clusters and neighbouring unit names land on the same hue.
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  const words = name.trim().split(NON_LETTER_RUN).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return (words[0] as string).slice(0, 2).toUpperCase();
  }
  return `${(words[0] as string)[0]}${(words[1] as string)[0]}`.toUpperCase();
}

/**
 * @param label - what the letters are taken from: the DISPLAY name. Seeding
 *   the initials off the stored `Name` would render every Oslo unit as "O·"
 *   and every Bergen one as "B·", which is the opposite of the point.
 * @param seed - what the hue is taken from, defaulting to `label`. Callers
 *   with a campus-prefixed name should pass it here: "Fadderullan" exists at
 *   four campuses and they must not all be the same colour, and a unit's hue
 *   has to stay put when its display name is derived differently later.
 */
export function unitMonogram(
  label: string,
  seed: string = label
): UnitMonogram {
  const hue = hashName(seed.toLowerCase()) % HUE_STEPS;
  const solid = `hsl(${hue} ${SATURATION}% ${LIGHTNESS}%)`;
  const to = `hsl(${(hue + GRADIENT_HUE_SHIFT) % HUE_STEPS} ${SATURATION}% ${LIGHTNESS + GRADIENT_LIGHTNESS_SHIFT}%)`;
  return {
    initials: initialsOf(label),
    background: `linear-gradient(135deg, ${solid}, ${to})`,
    solid,
  };
}
