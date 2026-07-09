import { requireNavAccess } from "@/lib/authorization";
import { getInboxCounts } from "../_actions/inbox";
import { InboxTabs } from "./_components/inbox-tabs";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNavAccess("portal.inbox");
  const counts = await getInboxCounts();
  return (
    <div>
      <InboxTabs
        approvals={counts.approvals}
        submissions={counts.submissions}
      />
      {children}
    </div>
  );
}
