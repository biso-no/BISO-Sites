export function MultiStepFormThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="4" y="4" width="30" height="22" rx="2" fill="none" stroke={s} strokeWidth=".5"/>
      <circle cx="10" cy="9" r="2" fill={s} opacity=".6"/>
      <circle cx="19" cy="9" r="2" fill="none" stroke={s} strokeWidth=".5" opacity=".6"/>
      <circle cx="28" cy="9" r="2" fill="none" stroke={s} strokeWidth=".5" opacity=".6"/>
      <path d="M12 9h5M21 9h5" stroke={s} strokeWidth=".5" opacity=".4"/>
      <rect x="8" y="13" width="22" height="2.5" rx="1" fill="none" stroke={s} strokeWidth=".4"/>
      <rect x="8" y="17.5" width="22" height="2.5" rx="1" fill="none" stroke={s} strokeWidth=".4"/>
      <rect x="24" y="22" width="7" height="2.5" rx="1" fill={s} opacity=".5"/>
    </svg>
  );
}
