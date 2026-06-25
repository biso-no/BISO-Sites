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
  const serviceUrl = process.env.TEAMS_BOT_SERVICE_URL || DEFAULT_SERVICE_URL;
  const adapter = new CloudAdapter(getAuth());

  const reference = {
    channelId: "msteams",
    serviceUrl,
    bot: { id: `28:${appId}`, name: "BISO Expense Approvals" },
    conversation: {
      id: params.chatId,
      tenantId: params.tenantId,
      conversationType: "personal",
      isGroup: false,
    },
  } as unknown as Partial<ConversationReference>;

  let activityId: string | undefined;
  await adapter.continueConversationAsync(appId, reference, async (context) => {
    const response = await context.sendActivity({
      attachments: [CardFactory.adaptiveCard(params.card)],
    });
    activityId = response?.id;
  });

  return activityId;
}
