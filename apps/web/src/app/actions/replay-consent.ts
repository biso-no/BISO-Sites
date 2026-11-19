"use server";

import {
  REPLAY_CONSENT_COOKIE,
  replayConsentCookieOptions,
  serializeReplayConsent,
} from "@repo/observability/consent";
import { cookies } from "next/headers";

export async function setReplayConsent(
  choice: "granted" | "denied"
): Promise<void> {
  if (choice !== "granted" && choice !== "denied") {
    throw new Error("Invalid consent choice");
  }
  const cookieStore = await cookies();
  cookieStore.set(
    REPLAY_CONSENT_COOKIE,
    serializeReplayConsent(choice),
    replayConsentCookieOptions(process.env.NODE_ENV === "production")
  );
}
