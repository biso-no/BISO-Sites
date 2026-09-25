/**
 * Prompts.
 *
 * Prompts are user-initiated workflows: a person picks one from their client's
 * menu, fills in the arguments, and gets a message that sets up a task. They
 * are not instructions the server injects on its own, and nothing here grants
 * any capability — a prompt that names a tool the caller may not use simply
 * produces a plan whose first step fails with a clear refusal.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isAnonymous } from "../identity/principal";
import type { ToolContext } from "../runtime/context";

export interface RegisteredPrompt {
  name: string;
}

function userMessage(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: { type: "text" as const, text },
      },
    ],
  };
}

export function registerPrompts(
  server: McpServer,
  context: ToolContext
): RegisteredPrompt[] {
  const registered: RegisteredPrompt[] = [];
  const staffOnly = !isAnonymous(context.principal);

  const add = (
    name: string,
    config: Parameters<McpServer["registerPrompt"]>[1],
    handler: Parameters<McpServer["registerPrompt"]>[2]
  ) => {
    server.registerPrompt(name, config, handler);
    registered.push({ name });
  };

  if (staffOnly) {
    add(
      "campus-briefing",
      {
        title: "Morning campus briefing",
        description:
          "What needs attention across your campuses today: closing vacancies, upcoming events, stale drafts, pending approvals and unhandled submissions.",
        argsSchema: {
          campus: z
            .string()
            .optional()
            .describe(
              "Campus name or id to narrow to. Omit for your full scope."
            ),
          horizonDays: z
            .string()
            .optional()
            .describe("How many days ahead to look. Defaults to 14."),
        },
      },
      ({ campus, horizonDays }) =>
        userMessage(
          `Give me my BISO briefing${campus ? ` for ${campus}` : ""}.

1. Call \`biso_whoami\` first so you know my scope, and say what it is.
2. Call \`biso_campus_briefing\`${campus ? ` (resolve "${campus}" with \`biso_resolve_campus\` first)` : ""}${horizonDays ? ` with horizonDays ${horizonDays}` : ""}.
3. Summarise the findings in priority order, urgent first. Link each item.
4. If a finding lists no items, say so plainly rather than inventing detail.

Do not act on anything. This is a read-only briefing.`
        )
    );

    add(
      "content-quality-review",
      {
        title: "Bilingual content quality review",
        description:
          "Audit a content type for missing translations, expired-but-published items, and misconfiguration.",
        argsSchema: {
          domain: z.string().describe("events, news, benefits or products."),
          campus: z.string().optional().describe("Campus name or id."),
        },
      },
      ({ domain, campus }) =>
        userMessage(
          `Review the quality of our ${domain} content${campus ? ` for ${campus}` : ""}.

1. Call \`biso_content_quality_audit\` for \`${domain}\`${campus ? ` after resolving "${campus}"` : ""}.
2. Group the issues by kind and tell me which to fix first.
3. Read \`checksPerformed\` and \`notChecked\` and be explicit about what this
   audit can and cannot establish — in particular it does not judge translation
   quality and says nothing about accessibility.
4. For each issue, give me the link.

Propose fixes, but do not apply any.`
        )
    );

    add(
      "prepare-page-edit",
      {
        title: "Prepare a page edit",
        description:
          "Load a page's real block document, plan an edit, and show me the proposal before anything is written.",
        argsSchema: {
          pageId: z.string().describe("The page id."),
          locale: z
            .string()
            .optional()
            .describe("`no` or `en`. Defaults to no."),
          goal: z
            .string()
            .describe("What the page should end up saying or doing."),
        },
      },
      ({ pageId, locale, goal }) =>
        userMessage(
          `I want to change page ${pageId}${locale ? ` (${locale})` : ""}. Goal: ${goal}

1. Call \`biso_page_load\` and tell me what is on the page now — real blocks,
   not a guess.
2. Call \`biso_page_list_block_types\` if you need a block you have not used.
3. Work out the edits. Write any copy yourself; there is no copy-generation
   tool here, by design.
4. Call \`biso_page_edit_blocks\` WITHOUT a proposalToken and show me the
   proposal and the resulting block list.
5. Wait for me. Do not pass the token back until I tell you to.`
        )
    );

    add(
      "explain-refusal",
      {
        title: "Why can't I do this?",
        description:
          "Explain an access decision in terms of the roles and scope behind it.",
        argsSchema: {
          action: z
            .string()
            .describe(
              "What you tried, e.g. 'publish a news article in Bergen'."
            ),
        },
      },
      ({ action }) =>
        userMessage(
          `Explain why I can or cannot: ${action}

1. Call \`biso_whoami\` for my roles and scope.
2. Call \`biso_explain_permission\` with the right domain, operation and campus.
3. Explain it in plain language: which rule applies, and what would change it.
4. If it can be routed for approval, say who it would go to.

Do not tell me about other people's memberships or access.`
        )
    );
  }

  add(
    "find-published",
    {
      title: "Find something published",
      description:
        "Search what BISO publishes publicly — events, news, vacancies, units, pages, documents.",
      argsSchema: {
        looking_for: z.string().describe("What you are looking for."),
        campus: z.string().optional().describe("Campus name, if it matters."),
      },
    },
    ({ looking_for, campus }) =>
      userMessage(
        `Help me find: ${looking_for}${campus ? ` (${campus})` : ""}

Use \`biso_public_search\`. Pick the right \`kind\`, and try more than one if the
first is empty. These results are what a signed-out visitor sees, so if
something is missing it may exist as an unpublished draft — say that rather
than concluding it does not exist.

Read the result's \`notes\`: for some kinds the free-text term is not applied,
and you should say so instead of implying the term matched.`
      )
  );

  return registered;
}
