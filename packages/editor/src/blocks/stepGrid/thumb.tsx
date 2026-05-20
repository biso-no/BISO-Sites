export function StepGridThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <circle cx="7" cy="11" r="2" fill={s} opacity=".4"/>
      <rect x="14" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <circle cx="19" cy="11" r="2" fill={s} opacity=".4"/>
      <rect x="26" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <circle cx="31" cy="11" r="2" fill={s} opacity=".4"/>
    </svg>
  );
}
