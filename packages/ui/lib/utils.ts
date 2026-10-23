import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { toast } from "sonner";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, told about the BISO radius and elevation scales.
 *
 * Out of the box it recognises `rounded-*` and `shadow-*` only for Tailwind's
 * own sizes, so `rounded-biso-md` passed to a component that sets `rounded-md`
 * kept both — and Tailwind emits same-property utilities in a fixed order, so
 * the component's corner and its grey shadow won over the caller's (every
 * Select, Popover and Dialog the web app restyled). It also read
 * `shadow-elev-2` as a shadow *colour* and dropped a real one. Registered, the
 * caller's class replaces the default, as `cn(base, className)` intends.
 * Names from `@theme` in `styles/globals.css`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["biso-sm", "biso-md", "biso-lg", "biso-pill"],
      shadow: ["elev-1", "elev-2"],
    },
  },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const handleError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);

  toast.error(message);
};

export const formatDateReadable = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
