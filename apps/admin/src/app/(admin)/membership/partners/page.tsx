import { redirect } from "next/navigation";
import { listManagedPartners } from "@/app/actions/benefit-partners";
import { checkNavAccess } from "@/lib/authorization";
import { PartnersClient } from "./_components/partners-client";

export const metadata = {
  title: "Partners | BISO Admin",
  description: "Manage benefit partners",
};

export default async function PartnersPage() {
  const hasAccess = await checkNavAccess("benefitsPartners");
  if (!hasAccess) {
    redirect("/unauthorized");
  }

  const { partners, total } = await listManagedPartners();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Partners</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage the partners that provide benefits to BISO members
        </p>
      </div>
      <PartnersClient partners={partners} total={total} />
    </div>
  );
}
