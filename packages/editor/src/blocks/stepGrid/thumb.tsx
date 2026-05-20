export function StepGridThumb() {
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
      <circle cx="7" cy="11" fill={s} opacity=".4" r="2" />
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
      <circle cx="19" cy="11" fill={s} opacity=".4" r="2" />
      <rect
        fill="none"
        height="16"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="26"
        y="7"
      />
      <circle cx="31" cy="11" fill={s} opacity=".4" r="2" />
    </svg>
  );
}
