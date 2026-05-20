export function ProfileHeaderThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <circle cx="10" cy="13" r="5" fill="none" stroke={s} strokeWidth=".5"/>
      <path d="M4 24c0-3.3 2.7-6 6-6s6 2.7 6 24" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="20" y="8" width="14" height="3" rx="1" fill={s} opacity=".5"/>
      <rect x="20" y="13" width="10" height="2" rx="1" fill={s} opacity=".3"/>
      <rect x="20" y="19" width="5" height="5" rx="1" fill="none" stroke={s} strokeWidth=".4"/>
      <rect x="27" y="19" width="5" height="5" rx="1" fill="none" stroke={s} strokeWidth=".4"/>
    </svg>
  );
}
