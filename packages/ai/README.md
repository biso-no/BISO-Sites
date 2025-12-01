# `@repo/ai` – Shared AI Package

The `@repo/ai` package provides shared AI configuration, tools, and components for all BISO Sites applications. Built on top of the Vercel AI SDK, it enables intelligent assistants across the monorepo.

## Features

- **Shared Configuration**: Centralized AI model configuration and system prompts
- **Navigation Tools**: AI can navigate users to specific admin pages
- **Form Filling Tools**: AI can stream data directly into form fields
- **Type-Safe**: Full TypeScript support with exported types

## Exports

The package uses direct exports (no barrel file) for optimal performance:

```ts
// Configuration
import { createAIConfig, adminAssistantConfig } from '@repo/ai/config';

// Types
import type { AssistantMessage, NavigationAction, FormFieldAction } from '@repo/ai/types';

// Provider (for client components)
import { AIProvider, useAI } from '@repo/ai/provider';

// Hooks
import { useAssistant } from '@repo/ai/hooks/use-assistant';

// Tools (for API routes)
import { createNavigationTool, defaultAdminRoutes } from '@repo/ai/tools/navigation';
import { createFormFillerTool, eventFormFields } from '@repo/ai/tools/form-filler';

// Prompts
import { ADMIN_ASSISTANT_PROMPT, PUBLIC_ASSISTANT_PROMPT } from '@repo/ai/prompts';
```

## Package Structure

```text
packages/ai/
├── src/
│   ├── config.ts           # AI configuration
│   ├── types.ts            # TypeScript types
│   ├── provider.tsx        # React context provider
│   ├── prompts.ts          # System prompts
│   ├── hooks/
│   │   └── use-assistant.ts  # Chat hook
│   └── tools/
│       ├── navigation.ts   # Navigation tool
│       └── form-filler.ts  # Form filling tool
├── tsconfig.json
└── package.json
```

## Quick Start

### API Route (Server)

```ts
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { createNavigationTool, defaultAdminRoutes } from "@repo/ai/tools/navigation";
import { ADMIN_ASSISTANT_PROMPT } from "@repo/ai/prompts";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-5-mini"),
    messages: convertToModelMessages(messages),
    system: ADMIN_ASSISTANT_PROMPT,
    tools: {
      navigate: createNavigationTool(defaultAdminRoutes),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Chat Component (Client)

```tsx
'use client';

import { useAssistant } from '@repo/ai/hooks/use-assistant';
import { useRouter } from 'next/navigation';

export function ChatComponent() {
  const router = useRouter();
  
  const { messages, sendMessage, isLoading } = useAssistant({
    api: '/api/admin-assistant',
    onNavigate: (path) => router.push(path),
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
    </div>
  );
}
```

## Admin Assistant Features

The admin assistant can:

1. **Navigate**: Redirect users to specific admin pages
2. **Fill Forms**: Stream data into form fields (events, posts, etc.)
3. **Answer Questions**: Provide guidance about the admin system

### Example Interaction

```
User: "Create a new event"
Assistant: [Navigates to /admin/events/new]
           "I've taken you to the event creation page. What's the event about?"

User: "A networking event for students on December 15th"
Assistant: [Fills in title, date, and description fields]
           "I've filled in the basic details. Would you like to add a location or ticket price?"
```

## Dependencies

- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenAI provider
- `@ai-sdk/react` - React hooks
- `zod` - Schema validation