import {
  SERIF_STACK,
  STUDIO,
  StudioPanel,
} from "@/app/(portal)/_components/studio";

export interface UnitGuidanceLabels {
  board: string;
  heading: string;
  newUnits: string;
  projectCategory: string;
}

/**
 * What this screen cannot do, and where to do it instead. Boards keep
 * asking for an "add board member" button here; the honest answer is that
 * the board comes from Microsoft 365 and new units from the accounting
 * system, so say so next to the page controls rather than in a handbook
 * nobody opens.
 */
export function UnitGuidanceCard({ labels }: { labels: UnitGuidanceLabels }) {
  return (
    <StudioPanel className="p-5">
      <h2
        className="mb-3 text-xl leading-6"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
      >
        {labels.heading}
      </h2>
      <ul
        className="flex flex-col gap-2 text-sm"
        style={{ color: STUDIO.ink3 }}
      >
        <li>{labels.board}</li>
        <li>{labels.newUnits}</li>
        <li>{labels.projectCategory}</li>
      </ul>
    </StudioPanel>
  );
}
