export function FilterBarThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="8"
        rx="4"
        stroke={s}
        strokeWidth=".5"
        width="22"
        x="4"
        y="11"
      />
      <circle cx="21" cy="15" fill={s} opacity=".4" r="1" />
      <path d="M8 15h9" opacity=".5" stroke={s} strokeWidth=".5" />
      <rect
        fill="none"
        height="8"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="6"
        x="28"
        y="11"
      />
      <path
        d="M29.5 13.5l1.5 3 1.5-3"
        fill="none"
        stroke={s}
        strokeWidth=".5"
      />
    </svg>
  );
}
