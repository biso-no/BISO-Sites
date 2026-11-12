/**
 * Bot Framework plumbing for the expense approval bot: a CloudAdapter for
 * proactive 1:1 Teams messages and request authentication for the messaging
 * endpoint. Uses the SingleTenant bot app credentials (TEAMS_BOT_*).
 */

import {
  type Activity,
  CardFactory,
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  type ConversationReference,
} from "botbuilder";

const DEFAULT_SERVICE_URL = "https://smba.trafficmanager.net/teams/";

function getBotConfig() {
  const MicrosoftAppId = process.env.TEAMS_BOT_APP_ID || "";
  const MicrosoftAppPassword = process.env.TEAMS_BOT_APP_PASSWORD || "";
  const MicrosoftAppTenantId = process.env.TEAMS_BOT_APP_TENANT_ID || "";
  if (!(MicrosoftAppId && MicrosoftAppPassword && MicrosoftAppTenantId)) {
    throw new Error(
      "Missing bot credentials: TEAMS_BOT_APP_ID, TEAMS_BOT_APP_PASSWORD, TEAMS_BOT_APP_TENANT_ID"
    );
  }
  return {
    MicrosoftAppId,
    MicrosoftAppPassword,
    MicrosoftAppType: "SingleTenant",
    MicrosoftAppTenantId,
  };
}

let cachedAuth: ConfigurationBotFrameworkAuthentication | null = null;

function getAuth(): ConfigurationBotFrameworkAuthentication {
  if (!cachedAuth) {
    cachedAuth = new ConfigurationBotFrameworkAuthentication(getBotConfig());
  }
  return cachedAuth;
}

/**
 * Validates an inbound Bot Framework request (the Authorization bearer token on
 * activities posted to the messaging endpoint). Throws if invalid.
 */
export async function authenticateBotRequest(
  activity: Activity,
  authHeader: string
): Promise<void> {
  await getAuth().authenticateRequest(activity, authHeader);
}

function conversationReference(chatId: string, tenantId: string) {
  const appId = process.env.TEAMS_BOT_APP_ID || "";
  return {
    channelId: "msteams",
    serviceUrl: process.env.TEAMS_BOT_SERVICE_URL || DEFAULT_SERVICE_URL,
    bot: { id: `28:${appId}`, name: "BISO Expense Approvals" },
    conversation: {
      id: chatId,
      tenantId,
      conversationType: "personal",
      isGroup: false,
    },
  } as unknown as Partial<ConversationReference>;
}

/**
 * Sends an Adaptive Card proactively to a user's 1:1 chat with the bot. Returns
 * the sent activity id (for later updates) when available.
 */
export async function sendProactiveCard(params: {
  chatId: string;
  tenantId: string;
  card: Record<string, unknown>;
}): Promise<string | undefined> {
  const appId = process.env.TEAMS_BOT_APP_ID || "";
  const adapter = new CloudAdapter(getAuth());
  const reference = conversationReference(params.chatId, params.tenantId);

  let activityId: string | undefined;
  await adapter.continueConversationAsync(appId, reference, async (context) => {
    const response = await context.sendActivity({
      attachments: [CardFactory.adaptiveCard(params.card)],
    });
    activityId = response?.id;
  });

  return activityId;
}

/**
 * Replaces a card the bot already sent (by the activity id `sendProactiveCard`
 * returned), for example with the decision result once the step is decided.
 */
export async function updateProactiveCard(params: {
  activityId: string;
  card: Record<string, unknown>;
  chatId: string;
  tenantId: string;
}): Promise<void> {
  const appId = process.env.TEAMS_BOT_APP_ID || "";
  const adapter = new CloudAdapter(getAuth());
  const reference = conversationReference(params.chatId, params.tenantId);

  await adapter.continueConversationAsync(appId, reference, async (context) => {
    await context.updateActivity({
      id: params.activityId,
      type: "message",
      attachments: [CardFactory.adaptiveCard(params.card)],
    });
  });
}
