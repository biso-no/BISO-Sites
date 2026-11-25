export const BIG_EVENT_TABLES = {
  events: "big_events",
  participants: "big_event_participants",
  groups: "big_event_groups",
  groupMembers: "big_event_group_members",
  deliveries: "big_event_deliveries",
  messages: "big_event_messages",
  messageRecipients: "big_event_message_recipients",
} as const;

export const BIG_EVENT_STATUSES = ["draft", "published", "archived"] as const;
export type BigEventStatus = (typeof BIG_EVENT_STATUSES)[number];

export const GROUP_KINDS = ["bus", "room", "buddy", "team", "other"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const LINK_METHODS = ["email", "connect", "manual"] as const;
export type LinkMethod = (typeof LINK_METHODS)[number];

export const DELIVERY_KINDS = [
  "connect",
  "connect_reminder",
  "message",
] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

export const DELIVERY_CHANNELS = ["email", "push", "sms"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const GROUP_LEGS = ["out", "home"] as const;
export type GroupLeg = (typeof GROUP_LEGS)[number];

export const SUGGESTION_REASONS = ["phone", "name"] as const;
export type SuggestionReason = (typeof SUGGESTION_REASONS)[number];

export const MESSAGE_KINDS = [
  "manual",
  "bus_assigned",
  "bus_moved",
  "bus_none",
  "departure_reminder",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MESSAGE_STATUSES = [
  "scheduled",
  "sending",
  "sent",
  "failed",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
