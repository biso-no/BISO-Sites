/**
 * The private values a docs page may show with `<Private name="…" />`.
 *
 * This file holds names and descriptions only. The values live in Infisical
 * (or the fake source in development). A description tells the OWNER what to
 * put under that key, and must never contain a value itself.
 */
export interface PrivateValueEntry {
  description: string;
  /**
   * Reserved for the offline emergency kit. `/api/private` never serves a
   * kit-only name and no page may use one. The entry exists so the name is
   * taken and its description says what the kit holds.
   */
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
      "The current administration leader, who keeps the emergency kit: name and a way to reach them.",
  },
  "emergency-kit-contents": {
    description:
      "The checklist of what the offline emergency kit must contain — item names only, never the credentials themselves; the kit's contents are kept offline by the administration leader.",
    kitOnly: true,
  },
  "docs-handover-team": {
    description:
      "The people in the docs-handover team right now, with names and contact details.",
  },
  "account-owners": {
    description:
      "Who owns each shared BISO account, one line per account: the domain, email and social media, and every outside service the platform uses that has no entry of its own here, such as Umami, Anthropic, 24SevenOffice, Vipps and Firebase.",
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
      "Where the Azure app registrations BISO uses live (sign-in, Microsoft Graph, SharePoint, the Teams bot) and who owns each.",
  },
  "microsoft-tenant-admins": {
    description:
      "Who the administrators of BISO's Microsoft tenant are, and how to reach them. They create Microsoft accounts outside the admin, for example a consultant's account with no SG-App group.",
  },
  "github-org": {
    description:
      "Who the owners of the BISO GitHub organisation are, and how to reach them. They invite collaborators to BISO-Sites and BISO-Flutter.",
  },
  "infisical-admins": {
    description:
      "Who the Infisical admins are today, and how to reach them. They invite new users to BISO's Infisical project.",
  },
  "appwrite-console-admins": {
    description:
      "Who can invite people to BISO's Appwrite console (the owners of its organisation), and how to reach them.",
  },
  "better-stack-account": {
    description:
      "Who owns the Better Stack account, which email it is registered under, and who receives its alerts.",
  },
} as const satisfies Record<string, PrivateValueEntry>;

export type PrivateName = keyof typeof PRIVATE_VALUES;

export function isPrivateName(name: string): name is PrivateName {
  return Object.hasOwn(PRIVATE_VALUES, name);
}

export function isKitOnly(name: PrivateName): boolean {
  const entry: PrivateValueEntry = PRIVATE_VALUES[name];
  return entry.kitOnly === true;
}

/** A name `/api/private` may serve: in the registry and not kit-only. */
export function isServableName(name: string): name is PrivateName {
  return isPrivateName(name) && !isKitOnly(name);
}

/** The most names one request may ask for. */
export const MAX_PRIVATE_NAMES = 20;
