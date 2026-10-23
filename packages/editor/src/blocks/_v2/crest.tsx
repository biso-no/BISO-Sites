const WORD_SPLIT = /\s+/;
const INITIALS = 2;

function initialsOf(name: string): string {
  return (typeof name === "string" ? name : "")
    .trim()
    .split(WORD_SPLIT)
    .filter(Boolean)
    .slice(0, INITIALS)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

const FRAME = "flex size-14 shrink-0 overflow-hidden rounded-biso-md";

/** A department's square tile: its logo, or its initials on the sunken surface. */
export function Crest({
  logoUrl,
  name,
}: {
  logoUrl?: string | null;
  name: string;
}) {
  if (typeof logoUrl === "string" && logoUrl) {
    return (
      <span aria-hidden="true" className={`${FRAME} bg-surface-sunken`}>
        {/* biome-ignore lint/correctness/useImageSize: fills the tile. */}
        <img
          alt=""
          className="size-full object-contain"
          decoding="async"
          loading="lazy"
          src={logoUrl}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${FRAME} type-heading-card items-center justify-center bg-surface-sunken text-ink-accent`}
    >
      {initialsOf(name)}
    </span>
  );
}
