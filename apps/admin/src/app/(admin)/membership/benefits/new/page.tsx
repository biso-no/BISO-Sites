import { unauthorized } from "next/navigation";
import { listPartnersForCampus } from "@/app/actions/benefits";
import { checkNavAccess, getUserAuthContext } from "@/lib/authorization";
import { BenefitEditorClient } from "../_components/benefit-editor-client";

export const metadata = {
  title: "Create Benefit | BISO Admin",
};

export default async function NewBenefitPage() {
  const hasAccess = await checkNavAccess("benefits");
  if (!hasAccess) {
    unauthorized();
  }

  const ctx = await getUserAuthContext();
  const campusId = ctx?.managedCampusIds[0] ?? "5";
  const partners = await listPartnersForCampus(campusId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Create Benefit</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Add a new benefit to the campus catalog
        </p>
      </div>
      <BenefitEditorClient
        benefit={null}
        defaultCampusId={campusId}
        managedCampusIds={ctx?.managedCampusIds ?? []}
        partners={partners}
      />
    </div>
  );
}
