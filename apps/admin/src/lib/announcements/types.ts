// Local row types for the Communications Center collections.
//
// `packages/api/types/appwrite.ts` is auto-generated and cannot be regenerated
// in this environment, so the new `announcements` and `user_notifications`
// collections are typed here by hand. These mirror the generated style (each
// row extends `Models.Row`) so `db.listRows<Announcements>(...)` and
// `db.getRow<Announcements>(...)` type-check.
//
// The generated types import `Models` from "appwrite" — match that here.
import type { Models } from "@repo/api";

export type Announcements = Models.Row & {
  status: string;
  category: string;
  audience_type: string;
  audience_value: string | null;
  title_en: string;
  title_no: string | null;
  body_en: string | null;
  body_no: string | null;
  event_id: string | null;
  campus_id: string | null;
  deep_link: string | null;
  data: string | null;
  push: boolean;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string | null;
};

export type UserNotifications = Models.Row & {
  user_id: string;
  announcement_id: string;
  read: boolean;
};
