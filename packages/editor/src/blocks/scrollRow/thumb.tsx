export function ScrollRowThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="14" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="26" y="7" width="10" height="16" rx="1.5" fill="none" stroke={s} strokeWidth=".5" strokeDasharray="2 1"/>
      <path d="M34 15 L36 15" stroke={s} strokeWidth=".7" markerEnd="url(#arr)"/>
    </svg>
  );
}
