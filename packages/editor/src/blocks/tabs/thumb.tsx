export function TabsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="4" width="10" height="5" rx="1" fill="var(--claret)" opacity=".7"/>
      <rect x="14" y="4" width="10" height="5" rx="1" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="26" y="4" width="10" height="5" rx="1" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="2" y="11" width="34" height="15" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
    </svg>
  );
}
