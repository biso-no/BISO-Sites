import { notFound } from "next/navigation";
import { getAllowedCampuses } from "@/app/actions/campus";
import { getEvent } from "@/app/actions/events";
import EventEditor from "../shared/event-editor";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [event, campuses] = await Promise.all([
    getEvent(id),
    getAllowedCampuses(),
  ]);

  if (!event) {
    notFound();
  }

  return <EventEditor campuses={campuses} event={event} />;
}
