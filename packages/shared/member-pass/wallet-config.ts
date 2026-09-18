import "server-only";

type Env = Record<string, string | undefined>;

export interface AppleWalletConfig {
  passTypeId: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  teamId: string;
  wwdr: string;
}

export interface GoogleWalletConfig {
  clientEmail: string;
  issuerId: string;
  privateKey: string;
}

function decodeBase64(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  return decoded || null;
}

export function readAppleWalletConfig(
  env: Env = process.env
): AppleWalletConfig | null {
  const passTypeId = env.APPLE_PASS_TYPE_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const signerCert = decodeBase64(env.APPLE_PASS_CERT);
  const signerKey = decodeBase64(env.APPLE_PASS_KEY);
  const wwdr = decodeBase64(env.APPLE_WWDR_CERT);
  if (!(passTypeId && teamId && signerCert && signerKey && wwdr)) {
    return null;
  }
  const passphrase = env.APPLE_PASS_KEY_PASSPHRASE?.trim();
  return {
    passTypeId,
    signerCert,
    signerKey,
    teamId,
    wwdr,
    ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
  };
}

export function readGoogleWalletConfig(
  env: Env = process.env
): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const json = decodeBase64(env.GOOGLE_WALLET_SERVICE_ACCOUNT);
  if (!(issuerId && json)) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as {
      client_email?: unknown;
      private_key?: unknown;
    };
    if (
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return {
      clientEmail: parsed.client_email,
      issuerId,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}
