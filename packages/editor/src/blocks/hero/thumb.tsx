export function HeroThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="3" width="20" x="3" y="6" />
      <rect fill={s} height="2" opacity=".5" width="14" x="3" y="12" />
      <rect fill={s} height="2" opacity=".5" width="10" x="3" y="17" />
      <rect
        fill={s}
        height="20"
        opacity=".25"
        rx="1.5"
        width="9"
        x="26"
        y="5"
      />
    </svg>
  );
}
