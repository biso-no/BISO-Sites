export function FeatureGridThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="4" width="10" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="14" y="4" width="10" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="26" y="4" width="10" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="2" y="16" width="34" height="1.5" rx=".75" fill={s} opacity=".3"/>
      <rect x="2" y="20" width="22" height="1.5" rx=".75" fill={s} opacity=".2"/>
    </svg>
  );
}
