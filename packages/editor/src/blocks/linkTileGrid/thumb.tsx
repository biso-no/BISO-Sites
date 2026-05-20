export function LinkTileGridThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="4" width="15" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="21" y="4" width="15" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="2" y="16" width="15" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="21" y="16" width="15" height="10" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
    </svg>
  );
}
