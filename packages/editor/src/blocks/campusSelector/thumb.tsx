export function CampusSelectorThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="8"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="34"
        x="2"
        y="11"
      />
      <rect fill={s} height="4" opacity=".3" rx="1" width="10" x="4" y="13" />
      <path d="M33 14 L35 15 L33 16" fill="none" stroke={s} strokeWidth=".5" />
    </svg>
  );
}
