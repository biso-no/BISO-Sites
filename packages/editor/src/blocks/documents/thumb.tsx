export function DocumentsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="24"
        x="4"
        y="4"
      />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="24"
        x="4"
        y="11"
      />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="24"
        x="4"
        y="18"
      />
      <rect fill={s} height="3" opacity=".4" rx=".5" width="5" x="30" y="5" />
      <rect fill={s} height="3" opacity=".4" rx=".5" width="5" x="30" y="12" />
      <rect fill={s} height="3" opacity=".4" rx=".5" width="5" x="30" y="19" />
    </svg>
  );
}
