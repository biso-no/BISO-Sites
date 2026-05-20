export function FeaturedCardsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect
        fill="none"
        height="22"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="16"
        x="2"
        y="4"
      />
      <rect
        fill="var(--claret)"
        height="4"
        opacity=".6"
        rx="1.5"
        width="16"
        x="2"
        y="4"
      />
      <rect
        fill="none"
        height="22"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="16"
        x="20"
        y="4"
      />
      <rect
        fill="var(--leaf)"
        height="4"
        opacity=".5"
        rx="1.5"
        width="16"
        x="20"
        y="4"
      />
    </svg>
  );
}
