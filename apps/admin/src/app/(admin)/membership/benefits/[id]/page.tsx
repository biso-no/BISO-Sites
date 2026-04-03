import { checkNavAccess, getUserAuthContext } from "@/lib/authorization";
import { redirect, notFound } from "next/navigation";
import {
  getManagedBenefit,
  listPartnersForCampus,
} from "@/app/actions/benefits";
import { BenefitEditorClient } from "../_components/benefit-editor-client";

export const metadata = {
  title: "Edit Benefit | BISO Admin",
};

export default async function EditBenefitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const hasAccess = await checkNavAccess("benefits");
  if (!hasAccess) redirect("/unauthorized");

  const { id } = await params;
  const ctx = await getUserAuthContext();

  let benefit;
  try {
    benefit = await getManagedBenefit(id);
  } catch {
    notFound();
  }

  const partners = await listPartnersForCampus(benefit.campus_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Edit Benefit</h1>
        <p className="mt-1 text-muted-foreground text-sm">{benefit.title_en}</p>
      </div>
      <BenefitEditorClient
        benefit={benefit}
        defaultCampusId={benefit.campus_id}
        managedCampusIds={ctx?.managedCampusIds ?? []}
        partners={partners}
      />
    </div>
  );
}
