/**
 * AI Configuration for the monorepo
 */
export type AIConfig = {
  /** Default model to use */
  model: string;
  /** Maximum duration for streaming responses */
  maxDuration: number;
  /** System prompt prefix */
  systemPromptPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
};

const defaultConfig: AIConfig = {
  model: "gpt-5-mini-mini",
  maxDuration: 30,
  debug: false,
};

/**
 * Create an AI configuration with defaults
 */
export function createAIConfig(overrides?: Partial<AIConfig>): AIConfig {
  return {
    ...defaultConfig,
    ...overrides,
  };
}

/**
 * Admin assistant specific configuration
 */
export const adminAssistantConfig = createAIConfig({
  model: "gpt-5-mini",
  maxDuration: 60,
  systemPromptPrefix: `You are BISO Admin Assistant, an intelligent helper for the BI Student Organisation admin dashboard.

Your capabilities:
1. **Navigation**: You can redirect users to specific pages in the admin dashboard
2. **Form Filling**: You can stream data directly into form fields to help users create content
3. **Guidance**: You can explain how to use features and answer questions about the admin system

When a user asks to create something (event, post, job, etc.):
1. First, navigate them to the appropriate creation page
2. Ask clarifying questions about the content they want to create
3. Stream the responses directly into the form fields as they provide information

Always be helpful, concise, and proactive. If you can take an action, do it rather than just explaining how.
`,
});

/**
 * Public assistant configuration (for website visitors)
 */
export const publicAssistantConfig = createAIConfig({
  model: "gpt-5-mini-mini",
  maxDuration: 30,
  systemPromptPrefix: `You are BISO AI Assistant, the authoritative guide for the BI Student Organisation (BISO).
You assist with statutes, local laws, policies, and public information.
`,
});
