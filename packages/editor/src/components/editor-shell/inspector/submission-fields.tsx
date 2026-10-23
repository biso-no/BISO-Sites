"use client";

import type { PatchFn } from "@/blocks/types";
import { isBisoRecipient } from "@/editor/submit-rules";
import { InspRow, InspSection, Segmented } from "./insp-parts";

interface Props {
  /** Database mode only: the one extra team that may read submissions. */
  accessTeamId?: string;
  onPatch: PatchFn;
  recipientEmail?: string;
  submitMode?: string;
  topic?: string;
  withTeam?: boolean;
}

/**
 * Where a form's answers go. The server reads all of this from the published
 * page, so what is set here is exactly what happens on the site.
 */
export function SubmissionFields({
  accessTeamId,
  onPatch,
  recipientEmail,
  submitMode,
  topic,
  withTeam = false,
}: Props) {
  const mode = submitMode === "email" ? "email" : "database";
  return (
    <InspSection label="Submission">
      <Segmented
        choices={[
          { label: "Save to admin", value: "database" },
          { label: "Email", value: "email" },
        ]}
        onPick={(value) => onPatch("submitMode", value)}
        value={mode}
      />
      <InspRow label="Topic">
        <input
          maxLength={100}
          onChange={(e) => onPatch("topic", e.target.value)}
          placeholder="contact"
          value={topic ?? ""}
        />
      </InspRow>
      {mode === "email" ? (
        <>
          <InspRow label="Recipient">
            <input
              onChange={(e) =>
                onPatch("recipientEmail", e.target.value.trim() || undefined)
              }
              placeholder="name@biso.no"
              type="email"
              value={recipientEmail ?? ""}
            />
          </InspRow>
          <p className="pe-insp-note">
            Only @biso.no addresses work. Anything else is refused and nothing
            is sent.
          </p>
          {recipientEmail && !isBisoRecipient(recipientEmail) ? (
            <p className="pe-insp-note" role="status">
              This is not a valid @biso.no address, so submissions will be
              refused.
            </p>
          ) : null}
        </>
      ) : null}
      {mode === "database" && withTeam ? (
        <>
          <InspRow label="Team">
            <input
              onChange={(e) =>
                onPatch("accessTeamId", e.target.value || undefined)
              }
              placeholder="Appwrite team ID (optional)"
              value={accessTeamId ?? ""}
            />
          </InspRow>
          <p className="pe-insp-note">
            Operations can always read submissions. A team set here can read
            them too.
          </p>
        </>
      ) : null}
    </InspSection>
  );
}
