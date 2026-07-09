import { redirect } from "next/navigation";
import { getInboxCounts } from "../_actions/inbox";

export default async function InboxPage() {
  // Land on the busier queue; approvals win ties.
  const counts = await getInboxCounts();
  if (counts.submissions > 0 && counts.approvals === 0) {
    redirect("/inbox/submissions");
  }
  redirect("/inbox/approvals");
}
