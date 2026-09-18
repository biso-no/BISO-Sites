import type { ScanOutcome } from "@repo/shared/member-pass/scan-types";

export type ScanTone = "green" | "orange" | "amber" | "red" | "grey";

const TONES: Record<ScanOutcome["result"], ScanTone> = {
  check_id: "amber",
  denied: "red",
  duplicate: "orange",
  unavailable: "grey",
  valid: "green",
};

export function scanTone(outcome: ScanOutcome): ScanTone {
  return TONES[outcome.result];
}

export const SCAN_TONE_CLASSES: Record<ScanTone, string> = {
  amber: "bg-amber-500 text-black",
  green: "bg-green-600 text-white",
  grey: "bg-zinc-600 text-white",
  orange: "bg-orange-500 text-black",
  red: "bg-red-600 text-white",
};
