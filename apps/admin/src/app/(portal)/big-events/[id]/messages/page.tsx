import { notFound } from "next/navigation";
import { requireNavAccess } from "@/lib/authorization";
import { getBigEvent } from "../../../_actions/big-events";

// "Send now" and "Try again" send inside the action, row by row, which can
// take minutes for a big audience (ruling R14). A send that outlives this
// is finished by the messages cron.
export const maxDuration = 300;

interface BigEventMessagesPageProps {
  params: Promise<{ id: string }>;
}

/** The Messages tab. Its view (composer and history) is still to come. */
export default async function BigEventMessagesPage({
  params,
}: BigEventMessagesPageProps) {
  await requireNavAccess("portal.bigEvents");
  const { id } = await params;
  const found = await getBigEvent(id);
  if (!found) {
    notFound();
  }
  return null;
}
