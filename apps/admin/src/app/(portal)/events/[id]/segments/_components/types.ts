export type { SegmentWithCount } from "../../../../_actions/event-segments";

export interface SegmentFormState {
  capacity: number;
  departure_time: string;
  hotel: string;
  kind: string;
  name: string;
  notes: string;
  pickup_location: string;
  room_number: string;
}
