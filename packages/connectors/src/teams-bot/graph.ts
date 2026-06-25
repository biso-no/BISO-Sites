/**
 * Microsoft Graph operations performed with the BOT app's credentials
 * (TeamsAppInstallation.ReadWriteForUser.All + Mail.Send). Used to proactively
 * install the bot for an approver (so it can DM them) and to send the Outlook
 * approval email.
 */

import { createGraphClient } from "../azure/index";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function getEnv() {
  const tenantId = process.env.TEAMS_BOT_APP_TENANT_ID || "";
  const clientId = process.env.TEAMS_BOT_APP_ID || "";
  const clientSecret = process.env.TEAMS_BOT_APP_PASSWORD || "";
  const teamsAppId = process.env.TEAMS_APP_ID || "";
  if (!(tenantId && clientId && clientSecret)) {
    throw new Error(
      "Missing bot Graph credentials: TEAMS_BOT_APP_ID, TEAMS_BOT_APP_PASSWORD, TEAMS_BOT_APP_TENANT_ID"
    );
  }
  return { tenantId, clientId, clientSecret, teamsAppId };
}

function getBotGraphClient() {
  const { tenantId, clientId, clientSecret } = getEnv();
  return createGraphClient(tenantId, clientId, clientSecret);
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

const CONFLICT = 409;

interface InstalledApp {
  id: string;
  teamsApp?: { id?: string };
}

/**
 * Ensures the bot's Teams app is installed for the user and returns the 1:1 chat
 * id used as the conversation id for proactive messaging. Returns null when the
 * chat cannot be resolved (caller falls back to email).
 */
export async function ensureBotChatForUser(
  aadUserId: string
): Promise<string | null> {
  const { teamsAppId } = getEnv();
  if (!teamsAppId) {
    return null;
  }
  const client = getBotGraphClient();

  try {
    await client.api(`/users/${aadUserId}/teamwork/installedApps`).post({
      "teamsApp@odata.bind": `${GRAPH_BASE}/appCatalogs/teamsApps/${teamsAppId}`,
    });
  } catch (error) {
    // 409 = already installed — fine; anything else is fatal for the Teams path.
    if (getStatusCode(error) !== CONFLICT) {
      throw error;
    }
  }

  const installed = (await client
    .api(`/users/${aadUserId}/teamwork/installedApps`)
    .expand("teamsApp")
    .get()) as { value: InstalledApp[] };

  const match = installed.value.find((app) => app.teamsApp?.id === teamsAppId);
  if (!match) {
    return null;
  }

  const chat = (await client
    .api(`/users/${aadUserId}/teamwork/installedApps/${match.id}/chat`)
    .get()) as { id?: string };

  return chat.id ?? null;
}

/** Sends an email via Graph as the configured sender mailbox (Mail.Send). */
export async function sendApprovalEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const sender = process.env.TEAMS_BOT_MAIL_FROM || "noreply@biso.no";
  const client = getBotGraphClient();

  await client.api(`/users/${sender}/sendMail`).post({
    message: {
      subject: params.subject,
      body: { contentType: "HTML", content: params.html },
      toRecipients: [{ emailAddress: { address: params.to } }],
    },
    saveToSentItems: false,
  });
}
