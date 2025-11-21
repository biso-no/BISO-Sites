export type ColorToken =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "destructive-foreground"
  | "border"
  | "input"
  | "ring"
  | "surface"
  | "surface-strong"
  | "surface-card"
  | "surface-hover";

export type RadiusToken = "radius-xs" | "radius-sm" | "radius" | "radius-lg" | "radius-xl";

export type FontSizeToken =
  | "font-size-xs"
  | "font-size-sm"
  | "font-size-md"
  | "font-size-lg"
  | "font-size-xl"
  | "font-size-2xl"
  | "font-size-3xl"
  | "font-size-4xl";

export type LineHeightToken = "leading-tight" | "leading-normal" | "leading-relaxed";

export type MotionDurationToken = "duration-100" | "duration-200" | "duration-300";

export type MotionEaseToken =
  | "ease-standard"
  | "ease-emphasized"
  | "ease-decelerate"
  | "ease-accelerate";

const cssVar = (name: string) => `var(--${name})` as const;
const hslVar = (name: string) => `hsl(var(--${name}))` as const;

export const tokens = {
  color: new Proxy({} as Record<ColorToken, string>, {
    get: (_, key: string) => hslVar(key),
  }),
  radius: new Proxy({} as Record<RadiusToken, string>, {
    get: (_, key: string) => cssVar(key),
  }),
  fontSize: new Proxy({} as Record<FontSizeToken, string>, {
    get: (_, key: string) => cssVar(key),
  }),
  lineHeight: new Proxy({} as Record<LineHeightToken, string>, {
    get: (_, key: string) => cssVar(key),
  }),
  duration: new Proxy({} as Record<MotionDurationToken, string>, {
    get: (_, key: string) => cssVar(key),
  }),
  ease: new Proxy({} as Record<MotionEaseToken, string>, {
    get: (_, key: string) => cssVar(key),
  }),
} as const;

export type Tokens = typeof tokens;

export const motion = {
  transition(
    props: string | string[] = "all",
    duration: MotionDurationToken = "duration-200",
    ease: MotionEaseToken = "ease-standard",
  ) {
    const p = Array.isArray(props) ? props.join(",") : props;
    return `${p} ${tokens.duration[duration]} ${tokens.ease[ease]}`;
  },
} as const;
