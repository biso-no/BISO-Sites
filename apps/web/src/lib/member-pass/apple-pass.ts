import "server-only";
import { PKPass } from "passkit-generator";
import type { MemberPassHolder } from "./types";
import type { AppleWalletConfig } from "./wallet-config";

export const WALLET_COLORS = {
  background: "#00172F",
  foreground: "#FFFFFF",
  label: "#7FD1F5",
} as const;

export interface WalletPassLabels {
  member: string;
  membership: string;
  validUntil: string;
}

interface PassField {
  key: string;
  label: string;
  value: string;
}

export function applePassFields(
  holder: MemberPassHolder,
  labels: WalletPassLabels,
  termLabelValue: string
): { auxiliary: PassField[]; primary: PassField[]; secondary: PassField[] } {
  return {
    auxiliary: [
      { key: "expiry", label: labels.validUntil, value: holder.expiryDate },
    ],
    primary: [{ key: "name", label: labels.member, value: holder.name }],
    secondary: [
      { key: "term", label: labels.membership, value: termLabelValue },
    ],
  };
}

const HEX_RADIX = 16;

function hexToRgb(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), HEX_RADIX);
  const g = Number.parseInt(hex.slice(3, 5), HEX_RADIX);
  const b = Number.parseInt(hex.slice(5, 7), HEX_RADIX);
  return `rgb(${r}, ${g}, ${b})`;
}

let cachedIcon: Buffer | null = null;

/**
 * The pass icon, fetched once from the public site. Standalone output does
 * not trace `public/`, so reading it from disk is not reliable.
 */
export async function loadWalletIcon(baseUrl: string): Promise<Buffer> {
  if (cachedIcon) {
    return cachedIcon;
  }
  const response = await fetch(`${baseUrl}/apple-touch-icon.png`);
  if (!response.ok) {
    throw new Error(`Wallet icon fetch failed: ${response.status}`);
  }
  cachedIcon = Buffer.from(await response.arrayBuffer());
  return cachedIcon;
}

export function buildAppleWalletPass(input: {
  code: string;
  config: AppleWalletConfig;
  expiryDate: string;
  fields: ReturnType<typeof applePassFields>;
  icon: Buffer;
  userId: string;
}): Promise<Buffer> {
  const { config } = input;
  const pass = new PKPass(
    {
      "icon.png": input.icon,
      "icon@2x.png": input.icon,
      "logo.png": input.icon,
    },
    {
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
      wwdr: config.wwdr,
    },
    {
      backgroundColor: hexToRgb(WALLET_COLORS.background),
      description: "BISO membership",
      foregroundColor: hexToRgb(WALLET_COLORS.foreground),
      formatVersion: 1,
      labelColor: hexToRgb(WALLET_COLORS.label),
      logoText: "BISO",
      organizationName: "BI Student Organisation",
      passTypeIdentifier: config.passTypeId,
      // Stable per member so re-adding replaces the pass instead of stacking.
      serialNumber: `member-${input.userId}`,
      teamIdentifier: config.teamId,
    }
  );
  pass.type = "generic";
  pass.primaryFields.push(...input.fields.primary);
  pass.secondaryFields.push(...input.fields.secondary);
  pass.auxiliaryFields.push(...input.fields.auxiliary);
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: input.code,
    messageEncoding: "iso-8859-1",
  });
  // Wallet greys the pass out after this moment: end of the expiry day, Oslo.
  pass.setExpirationDate(new Date(`${input.expiryDate}T23:59:59+01:00`));
  return Promise.resolve(pass.getAsBuffer());
}
