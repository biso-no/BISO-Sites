export function HeadingThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect fill={s} height="1.5" opacity=".5" width="8" x="6" y="8" />
      <rect fill={s} height="3.5" width="22" x="6" y="12" />
      <rect fill={s} height="1.5" opacity=".4" width="26" x="6" y="19" />
    </svg>
  );
}
