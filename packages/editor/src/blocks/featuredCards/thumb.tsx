export function FeaturedCardsThumb() {
  const s = "var(--ink-3)";
  return (
    <svg viewBox="0 0 38 30">
      <rect x="2" y="4" width="16" height="22" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="2" y="4" width="16" height="4" rx="1.5" fill="var(--claret)" opacity=".6"/>
      <rect x="20" y="4" width="16" height="22" rx="1.5" fill="none" stroke={s} strokeWidth=".5"/>
      <rect x="20" y="4" width="16" height="4" rx="1.5" fill="var(--leaf)" opacity=".5"/>
    </svg>
  );
}
