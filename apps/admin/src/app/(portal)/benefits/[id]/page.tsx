import { requireNavAccess } from "@/lib/authorization";
import { StudioPageHeader } from "../../_components/studio";

// Placeholder while the benefit panel is rebuilt.
export default async function BenefitEditorPage() {
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
