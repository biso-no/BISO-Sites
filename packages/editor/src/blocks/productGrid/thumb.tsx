export function ProductGridThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="10"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="2"
        y="4"
      />
      <rect
        fill="none"
        height="10"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="14"
        y="4"
      />
      <rect
        fill="none"
        height="10"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="26"
        y="4"
      />
      <rect fill={s} height="2" opacity=".5" rx=".5" width="10" x="2" y="16" />
      <rect fill={s} height="2" opacity=".5" rx=".5" width="10" x="14" y="16" />
      <rect fill={s} height="2" opacity=".5" rx=".5" width="10" x="26" y="16" />
      <rect fill={s} height="1.5" opacity=".3" rx=".5" width="6" x="2" y="20" />
      <rect
        fill={s}
        height="1.5"
        opacity=".3"
        rx=".5"
        width="6"
        x="14"
        y="20"
      />
      <rect
        fill={s}
        height="1.5"
        opacity=".3"
        rx=".5"
        width="6"
        x="26"
        y="20"
      />
    </svg>
  );
}
