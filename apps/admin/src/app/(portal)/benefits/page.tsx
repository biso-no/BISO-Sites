import { requireNavAccess } from "@/lib/authorization";
import { StudioPageHeader } from "../_components/studio";

// Placeholder while the benefits board is rebuilt.
export default async function BenefitsPage() {
  await requireNavAccess("portal.benefits");
  return (
    <div className="pb-12">
      <StudioPageHeader
        description="Siden bygges om."
        title="Medlemsfordeler"
      />
    </div>
  );
}
