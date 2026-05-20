export function ScrollRowThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="16"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="2"
        y="7"
      />
      <rect
        fill="none"
        height="16"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="14"
        y="7"
      />
      <rect
        fill="none"
        height="16"
        rx="1.5"
        stroke={s}
        strokeDasharray="2 1"
        strokeWidth=".5"
        width="10"
        x="26"
        y="7"
      />
      <path
        d="M34 15 L36 15"
        markerEnd="url(#arr)"
        stroke={s}
        strokeWidth=".7"
      />
    </svg>
  );
}
