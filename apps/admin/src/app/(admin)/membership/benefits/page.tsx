import Link from "next/link";
import { checkNavAccess } from "@/lib/authorization";
import { redirect } from "next/navigation";
import { listManagedBenefits } from "@/app/actions/benefits";
import { BenefitsListClient } from "./_components/benefits-list-client";

export const metadata = {
  title: "Benefits | BISO Admin",
  description: "Manage campus member benefits",
};

export default async function BenefitsPage() {
  const hasAccess = await checkNavAccess("benefits");
  if (!hasAccess) redirect("/unauthorized");

  const { benefits, total } = await listManagedBenefits({ limit: 50 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Benefits</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Create and manage member benefits for your campus
          </p>
        </div>
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm shadow-sm hover:bg-primary/90"
          href="/membership/benefits/new"
          id="create-benefit-btn"
        >
          + Create benefit
        </Link>
      </div>

      <BenefitsListClient benefits={benefits} total={total} />
    </div>
  );
}
