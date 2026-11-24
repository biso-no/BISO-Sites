import type { Models } from "@repo/api";
import type {
  BigEventStatus,
  DeliveryChannel,
  DeliveryKind,
  DeliveryStatus,
  GroupKind,
  GroupLeg,
  LinkMethod,
  SuggestionReason,
} from "./tables";

export interface BigEventRow extends Models.Row {
  campus_id: string;
  created_by: string | null;
  department_id: string | null;
  ends_at: string;
  group_checkin_enabled: boolean | null;
  hero_image_url: string | null;
  name_en: string | null;
  name_no: string;
  place_address: string | null;
  place_name: string | null;
  slug: string;
  starts_at: string;
  status: BigEventStatus | null;
  travel_enabled: boolean | null;
}

export interface BigEventParticipantRow extends Models.Row {
  big_event_id: string;
  campus_id: string | null;
  connect_nonce: string | null;
  connect_reminded_at: string | null;
  connect_sent_at: string | null;
  connect_token_hash: string | null;
  dismissed_user_id: string | null;
  first_name: string;
  last_import_id: string | null;
  last_name: string | null;
  link_method: LinkMethod | null;
  linked_at: string | null;
  membership_checked_at: string | null;
  membership_valid: boolean | null;
  phone: string | null;
  room_size: number | null;
  suggested_reason: SuggestionReason | null;
  suggested_user_id: string | null;
  ticket_category: string | null;
  ticket_email: string | null;
  ticket_ref: string | null;
  user_id: string | null;
}

export interface BigEventGroupRow extends Models.Row {
  big_event_id: string;
  booking_participant_id: string | null;
  campus_id: string | null;
  capacity: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_user_id: string | null;
  kind: GroupKind;
  name: string;
  note: string | null;
  room_number: string | null;
  source_key: string | null;
}

export interface BigEventGroupMemberRow extends Models.Row {
  assigned_at: string | null;
  big_event_id: string;
  group_id: string;
  leg: GroupLeg | null;
  participant_id: string;
  pinned: boolean | null;
}

export interface BigEventDeliveryRow extends Models.Row {
  attempts: number | null;
  big_event_id: string;
  channel: DeliveryChannel;
  claimed_at: string | null;
  claimed_by: string | null;
  kind: DeliveryKind;
  last_error: string | null;
  message_id: string | null;
  participant_ids: string[] | null;
  scheduled_for: string | null;
  sent_at: string | null;
  status: DeliveryStatus | null;
  to_address: string | null;
}
