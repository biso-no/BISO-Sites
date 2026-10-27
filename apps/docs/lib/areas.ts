export type AreaId = "guide" | "developers";

export interface Area {
  href: string;
  id: AreaId;
  title: string;
}

/** The two halves of the docs, in the order the area switch shows them. */
export const AREAS: readonly Area[] = [
  { id: "guide", title: "Platform guide", href: "/guide" },
  { id: "developers", title: "Developers", href: "/developers" },
];

/** The area a path belongs to: its root or anything under it, not a lookalike prefix. */
export function activeArea(pathname: string): AreaId | null {
  const area = AREAS.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`)
  );
  return area?.id ?? null;
}
