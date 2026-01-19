import { getPurchasableMemberships } from "@/app/actions/new-member";
import { NewMemberForm } from "./_components/new-member-form";

export const dynamic = "force-dynamic";

export default async function NewMemberPage() {
  let memberships: Awaited<ReturnType<typeof getPurchasableMemberships>>;
  try {
    memberships = await getPurchasableMemberships();
  } catch (error) {
    console.error("Failed to load purchasable memberships:", error);
    memberships = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">New Member</h1>
        <p className="text-muted-foreground">
          Manually create a membership for a student in 24SevenOffice.
        </p>
      </div>

      {memberships.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No purchasable memberships found. Please mark at least one
            membership as purchasable in the{" "}
            <a className="text-primary underline" href="/membership/settings">
              settings
            </a>
            .
          </p>
        </div>
      ) : (
        <NewMemberForm memberships={memberships} />
      )}
    </div>
  );
}
