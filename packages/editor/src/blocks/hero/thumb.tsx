export function HeroThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="3" y="6" width="20" height="3" fill={s}/>
      <rect x="3" y="12" width="14" height="2" fill={s} opacity=".5"/>
      <rect x="3" y="17" width="10" height="2" fill={s} opacity=".5"/>
      <rect x="26" y="5" width="9" height="20" rx="1.5" fill={s} opacity=".25"/>
    </svg>
  );
}
