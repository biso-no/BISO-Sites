# Conversational AI Implementation Guide

## Overview

This document outlines the implementation of a conversational AI assistant that:
- Asks follow-up questions before taking action
- Maintains chat history across navigation
- Intelligently modifies existing pages
- Offers translation after completion
- Provides feedback and confirmation loops

## Key Requirements

### 1. Chat Persistence Across Navigation

**Problem**: Chat closes and resets when navigating between pages.

**Solution**: Implemented `chat-persistence.ts` with localStorage:
- Session-based storage (survives page navigation)
- Automatic save/load on mount
- Clear on new session

**Files**:
- `/apps/admin/src/lib/chat-persistence.ts` - Persistence utilities
- Update `assistant-sidebar.tsx` to use persistence hooks

### 2. Conversational Flow

**Current Behavior**: AI immediately creates page with generic title.

**Desired Behavior**:
```
User: "Let's create a page"
AI: "I'd be happy to help! What kind of page would you like to create? 
     What should the title be?"
User: "A homepage for BISO with hero and features"
AI: "Great! I'll create a homepage with:
     - Hero section
     - Feature grid
     Should I proceed?"
User: "Yes"
AI: [Creates page, navigates, generates content]
AI: "I've created your homepage. What do you think? Any changes needed?"
```

**Implementation**:
- Update `ADMIN_ASSISTANT_PROMPT` to emphasize asking questions
- AI should use `analyzeTask` but NOT immediately execute
- Add confirmation step before navigation/generation

### 3. Page Modification with Streaming

**Scenario**: User wants to modify existing page structure.

**Example**:
```
User: "Move the Hero block down and add a FeatureGrid above it"
AI: "I'll rearrange your page:
     1. Move Hero to position 2
     2. Add FeatureGrid at position 1
     Should I proceed?"
User: "Yes"
AI: [Streams new page structure with modifications]
```

**Implementation**:
- AI needs current page data (already passed via `puckData`)
- `generatePuckContent` should accept existing content and modifications
- Streaming parser applies changes in real-time

### 4. Post-Completion Workflow

**After content generation**:
```
AI: "Your page is ready! Here's what I created:
     - Hero section with 'Welcome to BISO'
     - 3-column feature grid
     - Call-to-action section
     
     What do you think? Any changes needed?"
User: "Looks good!"
AI: "Excellent! Would you like me to translate this page to English/Norwegian?"
User: "Yes, translate to English"
AI: [Saves current page, triggers translation, redirects to new locale]
```

**Implementation**:
- AI should ask for feedback after generation
- Offer translation when user is satisfied
- Use existing translation API route

## Implementation Steps

### Step 1: Fix Chat Persistence

Update `assistant-sidebar.tsx`:

```typescript
import { loadChatMessages, saveChatMessages, clearChatHistory } from "@/lib/chat-persistence";

export function AssistantSidebar({ isOpen, onClose }: Props) {
  // Load messages on mount
  useEffect(() => {
    const savedMessages = loadChatMessages();
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    }
  }, []);

  // Save messages on change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatMessages(messages);
    }
  }, [messages]);

  const handleClearMessages = () => {
    clearChatHistory();
    clearMessages();
  };
}
```

### Step 2: Update AI Prompt

Key changes to `ADMIN_ASSISTANT_PROMPT`:

```typescript
export const ADMIN_ASSISTANT_PROMPT = `You are BISO Admin Assistant, a conversational AI.

## Conversational Principles

1. ALWAYS ask clarifying questions before taking action
2. Summarize your plan and ask for confirmation
3. After completing work, ask for feedback
4. Offer translation when user is satisfied
5. Be patient - gather all necessary information first

## Example Conversations

### Creating a Page:
User: "Create a page"
You: "I'd be happy to help! What kind of page? What should the title be?"
[Wait for response, gather info, then proceed]

### Modifying a Page:
User: "Move the hero down"
You: "I'll move the Hero block to position 2. Should I proceed?"
[Wait for confirmation, then execute]

### After Completion:
You: "Your page is ready! What do you think?"
[If positive feedback]
You: "Would you like me to translate this to [other language]?"

## Tools Usage

- analyzeTask: Use to understand intent, but DON'T immediately execute
- navigate: Only after user confirmation
- generatePuckContent: Only after gathering all info and confirmation
- translateContent: Offer after user is happy with content
`;
```

### Step 3: Handle Page Modifications

Update `createPuckGeneratorTool` to accept current content:

```typescript
export function createPuckGeneratorTool(schemaContext: string) {
  return tool({
    description: "Generate or modify page content in Puck JSON format",
    inputSchema: z.object({
      content: z.array(z.object({
        type: z.string(),
        props: z.record(z.unknown()),
      })),
      modifications: z.object({
        action: z.enum(["add", "move", "remove", "replace"]),
        blockIndex: z.number().optional(),
        newBlock: z.object({
          type: z.string(),
          props: z.record(z.unknown()),
        }).optional(),
      }).optional(),
    }),
    execute: async ({ content, modifications }) => {
      // Apply modifications if provided
      let finalContent = [...content];
      
      if (modifications) {
        switch (modifications.action) {
          case "move":
            // Move block logic
            break;
          case "add":
            // Add block logic
            break;
          case "remove":
            // Remove block logic
            break;
          case "replace":
            // Replace block logic
            break;
        }
      }
      
      return {
        success: true,
        content: finalContent,
      };
    },
  });
}
```

### Step 4: Translation Integration

After user confirms satisfaction, AI should:

1. Save current page (call save action)
2. Trigger translation API
3. Wait for completion
4. Redirect to translated page

```typescript
// In AI prompt
"When user is happy with the page:
1. Ask: 'Would you like me to translate this to [language]?'
2. If yes, explain: 'I'll save the current page and create a translated version'
3. Use the existing translation workflow (save → translate → redirect)"
```

## Testing Checklist

- [ ] Chat persists across page navigation
- [ ] AI asks follow-up questions before creating pages
- [ ] AI confirms before major actions (navigation, generation)
- [ ] AI can modify existing page structures
- [ ] AI asks for feedback after completion
- [ ] AI offers translation when user is satisfied
- [ ] Translation workflow saves before translating
- [ ] Chat history clears on new session

## API Route Updates

The API route already receives:
- `currentPath`: Know where user is
- `puckData`: Current page content for modifications
- `formContext`: Form state

These enable the AI to:
- Make context-aware decisions
- Modify existing content
- Fill forms intelligently

## User Experience Flow

### Ideal Conversation:

```
User: "Let's create a page"
AI: "I'd be happy to help! What kind of page would you like to create?"

User: "A homepage"
AI: "Great! What should the title be?"

User: "Welcome to BISO"
AI: "Perfect! What sections should the homepage include?"

User: "Hero, features, and a call-to-action"
AI: "Excellent! I'll create a homepage with:
     - Title: 'Welcome to BISO'
     - Hero section
     - Feature grid
     - Call-to-action section
     
     Should I proceed?"

User: "Yes"
AI: [Navigates to /admin/pages, creates page record]
AI: [Generates content with streaming]
AI: "Your homepage is ready! I've added:
     - A hero with your title
     - A 3-column feature grid
     - A call-to-action button
     
     What do you think? Any changes needed?"

User: "Can you add a stats section?"
AI: "Of course! I'll add a stats section below the features. Proceeding..."
AI: [Adds stats section with streaming]
AI: "Stats section added! Anything else?"

User: "Looks perfect!"
AI: "Wonderful! Would you like me to translate this page to English?"

User: "Yes please"
AI: "I'll save the current page and create an English translation. One moment..."
AI: [Saves page, triggers translation, redirects]
AI: "Translation complete! You're now viewing the English version."
```

## Summary

The conversational AI implementation requires:

1. **Chat Persistence**: localStorage-based session storage
2. **Conversational Prompt**: Emphasize questions and confirmations
3. **Page Modifications**: Support for editing existing content
4. **Feedback Loop**: Ask for user opinion after actions
5. **Translation Offer**: Integrate with existing translation workflow

All infrastructure is in place - the main work is updating the AI prompt to be more conversational and integrating the persistence layer.
