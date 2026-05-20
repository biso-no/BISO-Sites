export function DocumentsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="4" y="4" width="24" height="5" rx="1" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="4" y="11" width="24" height="5" rx="1" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="4" y="18" width="24" height="5" rx="1" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="30" y="5" width="5" height="3" rx=".5" fill={s} opacity=".4"/>
      <rect x="30" y="12" width="5" height="3" rx=".5" fill={s} opacity=".4"/>
      <rect x="30" y="19" width="5" height="3" rx=".5" fill={s} opacity=".4"/>
    </svg>
  );
}
