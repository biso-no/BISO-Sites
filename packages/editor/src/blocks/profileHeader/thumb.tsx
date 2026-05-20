export function ProfileHeaderThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <circle cx="10" cy="13" fill="none" r="5" stroke={s} strokeWidth=".5" />
      <path
        d="M4 24c0-3.3 2.7-6 6-6s6 2.7 6 24"
        fill="none"
        stroke={s}
        strokeWidth=".5"
      />
      <rect fill={s} height="3" opacity=".5" rx="1" width="14" x="20" y="8" />
      <rect fill={s} height="2" opacity=".3" rx="1" width="10" x="20" y="13" />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".4"
        width="5"
        x="20"
        y="19"
      />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".4"
        width="5"
        x="27"
        y="19"
      />
    </svg>
  );
}
