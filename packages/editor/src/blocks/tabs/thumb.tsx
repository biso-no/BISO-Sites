export function TabsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect
        fill="var(--claret)"
        height="5"
        opacity=".7"
        rx="1"
        width="10"
        x="2"
        y="4"
      />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="14"
        y="4"
      />
      <rect
        fill="none"
        height="5"
        rx="1"
        stroke={s}
        strokeWidth=".5"
        width="10"
        x="26"
        y="4"
      />
      <rect
        fill="none"
        height="15"
        rx="1.5"
        stroke={s}
        strokeWidth=".5"
        width="34"
        x="2"
        y="11"
      />
    </svg>
  );
}
