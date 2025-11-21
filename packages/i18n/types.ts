import type { Locale } from "./config";

// Message namespace types
export type MessageNamespace =
  | "academicsContact"
  | "businessHotspot"
  | "common"
  | "cookies"
  | "contact"
  | "home"
  | "unused"
  | "varsling"
  | "partner"
  | "press"
  | "privacy"
  | "policies"
  | "about"
  | "membership"
  | "memberPortal"
  | "students"
  | "terms"
  | "projects"
  | "fundingProgram"
  | "projectDetail"
  | "volunteer"
  | "admin"
  | "adminUsers"
  | "adminShop"
  | "adminJobs"
  | "adminEvents"
  | "adminExpenses"
  | "adminUnits"
  | "adminSettings"
  | "adminPosts";

// Messages type structure
export type Messages = Record<string, any>;

export type LocaleMessages = {
  [K in MessageNamespace]?: Messages;
};
