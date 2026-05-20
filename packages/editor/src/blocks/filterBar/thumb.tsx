export function FilterBarThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="4" y="11" width="22" height="8" rx="4" fill="none" stroke={s} strokeWidth=".5"/>
      <circle cx="21" cy="15" r="1" fill={s} opacity=".4"/>
      <path d="M8 15h9" stroke={s} strokeWidth=".5" opacity=".5"/>
      <rect x="28" y="11" width="6" height="8" rx="2" fill="none" stroke={s} strokeWidth=".5"/>
      <path d="M29.5 13.5l1.5 3 1.5-3" stroke={s} strokeWidth=".5" fill="none"/>
    </svg>
  );
}
