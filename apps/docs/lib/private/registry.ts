/**
 * The private values a docs page may show with `<Private name="…" />`.
 *
 * This file holds names and descriptions only. The values live in Infisical
 * (or the fake source in development). A description tells the OWNER what to
 * put under that key, and must never contain a value itself.
 */
export interface PrivateValueEntry {
  description: string;
  /** Shown only inside the emergency kit, never on an ordinary page. */
  kitOnly?: boolean;
}

export const PRIVATE_VALUES = {
  "appwrite-console-url": {
    description:
      "The address of the Appwrite console that BISO uses, as a full link.",
  },
  "server-provider-account": {
    description:
      "Which hosting provider runs the BISO servers, and who owns that account.",
  },
  "server-access": {
    description:
      "How a handover person gets onto the servers: who grants access and where the keys are kept.",
  },
  "infisical-url": {
    description: "The link to BISO's Infisical project, as a full link.",
  },
  "infisical-admin-recovery": {
    description:
      "Who can recover Infisical admin access if the current admins are gone, and how to reach them.",
  },
  "admin-leader-contact": {
    description:
      "The current leader of the admin team: name and a way to reach them.",
  },
  "emergency-kit-contents": {
    description:
      "The full contents of the emergency kit: every account and recovery step in one block.",
    kitOnly: true,
  },
  "docs-handover-team": {
    description:
      "The people in the docs-handover team right now, with names and contact details.",
  },
  "account-owners": {
    description:
      "Who owns each shared BISO account (domain, email, social media), one line per account.",
  },
  "apple-developer-account": {
    description:
      "Who owns the Apple Developer account and which email it is registered under.",
  },
  "google-play-account": {
    description:
      "Who owns the Google Play Console account and which email it is registered under.",
  },
  "azure-app-registration": {
    description:
      "Where the Azure app registration for BISO sign-in lives and who is its owner.",
  },
} as const satisfies Record<string, PrivateValueEntry>;

export type PrivateName = keyof typeof PRIVATE_VALUES;

export function isPrivateName(name: string): name is PrivateName {
  return Object.hasOwn(PRIVATE_VALUES, name);
}

/** The most names one request may ask for. */
export const MAX_PRIVATE_NAMES = 20;
