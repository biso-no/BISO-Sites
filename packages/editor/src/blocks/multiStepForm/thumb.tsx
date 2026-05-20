export function MultiStepFormThumb() {
  const s = "var(--ink-3)";
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 38 30">
      <rect
        fill="none"
        height="22"
        rx="2"
        stroke={s}
        strokeWidth=".5"
        width="30"
        x="4"
        y="4"
      />
      <circle cx="10" cy="9" fill={s} opacity=".6" r="2" />
      <circle
        cx="19"
        cy="9"
        fill="none"
        opacity=".6"
        r="2"
        stroke={s}
        strokeWidth=".5"
      />
      <circle
        cx="28"
        cy="9"
        fill="none"
        opacity=".6"
        r="2"
        stroke={s}
        strokeWidth=".5"
      />
      <path d="M12 9h5M21 9h5" opacity=".4" stroke={s} strokeWidth=".5" />
      <rect
        fill="none"
        height="2.5"
        rx="1"
        stroke={s}
        strokeWidth=".4"
        width="22"
        x="8"
        y="13"
      />
      <rect
        fill="none"
        height="2.5"
        rx="1"
        stroke={s}
        strokeWidth=".4"
        width="22"
        x="8"
        y="17.5"
      />
      <rect fill={s} height="2.5" opacity=".5" rx="1" width="7" x="24" y="22" />
    </svg>
  );
}
