import { notFound } from "next/navigation";
import { canSendNotifications } from "@/lib/announcements/audience-policy";
import { requireNavAccess } from "@/lib/authorization";
import {
  listAttendees,
  listEventRsvps,
  listSegments,
} from "../../../_actions/event-segments";
import { getEvent } from "../../../_actions/events";
import { SegmentsStudio } from "./_components/segments-studio";

interface SegmentsPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventSegmentsPage({ params }: SegmentsPageProps) {
  const ctx = await requireNavAccess("portal.events");
  const { id } = await params;

  const event = await getEvent(id);
  if (!event) {
    notFound();
  }

  const [segments, attendees, rsvps] = await Promise.all([
    listSegments(id),
    listAttendees(id),
    listEventRsvps(id),
  ]);

  const enTitle =
    event.translation_refs.find((row) => row.locale === "en")?.title ??
    event.translation_refs[0]?.title ??
    event.slug ??
    "Event";

  return (
    <SegmentsStudio
      attendees={attendees}
      campusId={event.campus_id ?? null}
      canMessage={canSendNotifications(ctx.roles)}
      eventId={id}
      eventTitle={enTitle}
      rsvps={rsvps}
      segments={segments}
    />
  );
}
