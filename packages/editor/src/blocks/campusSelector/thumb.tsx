export function CampusSelectorThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="11" width="34" height="8" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="4" y="13" width="10" height="4" rx="1" fill={s} opacity=".3"/>
      <path d="M33 14 L35 15 L33 16" stroke={s} strokeWidth=".5" fill="none"/>
    </svg>
  );
}
