"use client";

import type { BenefitPartner, CampusBenefit } from "@repo/api/types/appwrite";
import { BenefitContentTabs } from "./benefit-content-tabs";
import { BenefitPublishPanel } from "./benefit-publish-panel";
import { BenefitRedemptionSection } from "./benefit-redemption-section";
import { BenefitSettingsPanel } from "./benefit-settings-panel";
import { useBenefitEditor } from "./use-benefit-editor";

interface BenefitEditorClientProps {
  benefit: CampusBenefit | null;
  defaultCampusId: string;
  managedCampusIds: string[];
  partners: BenefitPartner[];
}

export function BenefitEditorClient({
  benefit,
  defaultCampusId,
  managedCampusIds,
  partners,
}: BenefitEditorClientProps) {
  const { form, handleSave, handlePartnerSelect } = useBenefitEditor({
    benefit,
    defaultCampusId,
    partners,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content — left 2/3 */}
      <div className="space-y-4 lg:col-span-2">
        <BenefitContentTabs form={form} />
        <BenefitRedemptionSection form={form} />
      </div>

      {/* Sidebar — right 1/3 */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <BenefitPublishPanel form={form} onSave={handleSave} />
        <BenefitSettingsPanel
          form={form}
          managedCampusIds={managedCampusIds}
          onPartnerSelect={handlePartnerSelect}
          partners={partners}
        />
      </div>
    </div>
  );
}
