import { getAllowedCampuses } from "@/app/actions/campus";
import EventEditor from "../shared/event-editor";

export default async function NewEventPage() {
  const campuses = await getAllowedCampuses();
  return <EventEditor campuses={campuses} />;
}
