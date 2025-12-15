# AI Assistant Extensibility Guide

## Overview

The AI assistant system is designed to be easily extensible to other content types beyond pages. This guide shows how to add AI assistance for Posts, Products, Jobs, and any other content type.

## Architecture Pattern

The system follows a consistent pattern across all content types:

```
User Request → Task Analysis → Navigation → Content Generation → Save
```

### Core Components (Reusable)

1. **Assistant Sidebar** (`components/assistant/assistant-sidebar.tsx`)
   - Reusable across all content types
   - Shows agent states (Thinking, Analyzing, Navigating, Generating)
   - Handles user input and displays AI responses

2. **Assistant Trigger** (`components/assistant/assistant-trigger.tsx`)
   - Floating button to open the assistant
   - Can be placed anywhere in the UI

3. **Agentic Tools** (`packages/ai/src/tools/`)
   - `createTaskAnalyzerTool()`: Analyzes intent
   - `createNavigationTool()`: Handles routing
   - `createFormFillerTool()`: Fills form fields
   - `createPuckGeneratorTool()`: Generates page content

## Extending to New Content Types

### Step 1: Define Form Fields

Create a field definition for your content type:

```typescript
// packages/ai/src/tools/form-filler.ts

export const postFormFields: FormFieldInfo[] = [
  {
    id: "translations.en.title",
    name: "title_en",
    type: "text",
    label: "English Title",
    required: true,
  },
  {
    id: "translations.no.title",
    name: "title_no",
    type: "text",
    label: "Norwegian Title",
    required: true,
  },
  {
    id: "translations.en.content",
    name: "content_en",
    type: "textarea",
    label: "English Content",
    required: true,
  },
  {
    id: "translations.no.content",
    name: "content_no",
    type: "textarea",
    label: "Norwegian Content",
    required: true,
  },
  {
    id: "slug",
    name: "slug",
    type: "text",
    label: "URL Slug",
    required: true,
  },
  {
    id: "published_at",
    name: "published_at",
    type: "date",
    label: "Publish Date",
  },
  {
    id: "category",
    name: "category",
    type: "select",
    label: "Category",
    options: [
      { value: "news", label: "News" },
      { value: "announcement", label: "Announcement" },
      { value: "blog", label: "Blog" },
    ],
  },
];
```

### Step 2: Add Routes to Navigation Tool

Update the navigation tool with routes for your content type:

```typescript
// packages/ai/src/tools/navigation.ts

export const defaultAdminRoutes: RouteInfo[] = [
  // ... existing routes
  {
    path: "/admin/posts",
    label: "Posts",
    description: "View and manage blog posts",
    requiredRoles: ["Admin", "pr"],
  },
  {
    path: "/admin/posts/new",
    label: "Create Post",
    description: "Create a new blog post",
    requiredRoles: ["Admin", "pr"],
  },
];
```

### Step 3: Update System Prompt

Add content type information to the AI prompt:

```typescript
// packages/ai/src/prompts.ts

## Available Routes
- /admin/pages - Manage pages (Puck editor)
- /admin/pages/new - Create new page (Puck editor)
- /admin/posts - Manage posts
- /admin/posts/new - Create post
- /admin/events/new - Create event
- /admin/jobs/new - Create job listing
- /admin/shop/products/new - Create product

## Form Fields by Content Type

### Posts
- translations.en.title, translations.no.title (required)
- translations.en.content, translations.no.content (required, markdown)
- slug (required, auto-generate from English title)
- published_at (YYYY-MM-DD format)
- category (news, announcement, blog)
```

### Step 4: Integrate Assistant in Content Editor

Add the assistant to your content creation/editing page:

```typescript
// app/(admin)/admin/posts/[postId]/edit/client.tsx

"use client";

import { useState } from "react";
import { AssistantSidebar } from "@/components/assistant/assistant-sidebar";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";

export function PostEditorClient({ initialData, postId }: Props) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  return (
    <>
      {/* Your post editor form */}
      <PostEditorForm initialData={initialData} postId={postId} />
      
      {/* AI Assistant */}
      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-4">
        <AssistantSidebar
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
        />
        {!isAssistantOpen && (
          <AssistantTrigger onClick={() => setIsAssistantOpen(true)} />
        )}
      </div>
    </>
  );
}
```

### Step 5: Handle Form Context (Optional)

If you want the AI to know about the current form state, pass form context:

```typescript
// In your form component

import { useFormContext } from "react-hook-form";
import { useChatStream } from "@/components/assistant/use-chat-stream";

export function PostForm() {
  const form = useFormContext();
  
  // Create form context for AI
  const formContext = {
    formId: "post-form",
    formName: "Post Editor",
    fields: [
      {
        id: "translations.en.title",
        name: "title_en",
        type: "text",
        label: "English Title",
        required: true,
        currentValue: form.watch("translations.en.title"),
      },
      // ... other fields
    ],
  };

  const { messages, sendMessage } = useChatStream({
    api: "/api/admin-assistant",
    formContext,
  });

  // ... rest of component
}
```

## Content Type Examples

### Example 1: Products (E-commerce)

```typescript
// Product form fields
export const productFormFields: FormFieldInfo[] = [
  { id: "translations.en.name", type: "text", label: "Product Name (EN)", required: true },
  { id: "translations.no.name", type: "text", label: "Product Name (NO)", required: true },
  { id: "translations.en.description", type: "textarea", label: "Description (EN)" },
  { id: "translations.no.description", type: "textarea", label: "Description (NO)" },
  { id: "price", type: "number", label: "Price (NOK)", required: true },
  { id: "stock", type: "number", label: "Stock Quantity" },
  { id: "sku", type: "text", label: "SKU" },
  { id: "category", type: "select", label: "Category", options: [...] },
];

// Usage example
"Create a product for BISO hoodie, price 399 NOK, available in sizes S-XL"
```

### Example 2: Jobs

```typescript
// Job form fields
export const jobFormFields: FormFieldInfo[] = [
  { id: "translations.en.title", type: "text", label: "Job Title (EN)", required: true },
  { id: "translations.no.title", type: "text", label: "Job Title (NO)", required: true },
  { id: "translations.en.description", type: "textarea", label: "Description (EN)" },
  { id: "translations.no.description", type: "textarea", label: "Description (NO)" },
  { id: "company", type: "text", label: "Company Name" },
  { id: "location", type: "text", label: "Location" },
  { id: "employment_type", type: "select", label: "Type", options: [
    { value: "full-time", label: "Full Time" },
    { value: "part-time", label: "Part Time" },
    { value: "internship", label: "Internship" },
  ]},
  { id: "deadline", type: "date", label: "Application Deadline" },
];

// Usage example
"Create a job posting for summer internship at DNB, deadline June 1st"
```

### Example 3: Events (Already Implemented)

```typescript
// Event form fields (reference)
export const eventFormFields: FormFieldInfo[] = [
  { id: "translations.en.title", type: "text", label: "English Title", required: true },
  { id: "translations.no.title", type: "text", label: "Norwegian Title", required: true },
  { id: "translations.en.description", type: "textarea", label: "English Description" },
  { id: "translations.no.description", type: "textarea", label: "Norwegian Description" },
  { id: "start_date", type: "date", label: "Start Date" },
  { id: "end_date", type: "date", label: "End Date" },
  { id: "location", type: "text", label: "Location" },
  { id: "price", type: "number", label: "Price (NOK)" },
  { id: "ticket_url", type: "text", label: "Ticket URL" },
];

// Usage example
"Lag et arrangement for quiz-kveld på campus Bergen 15. desember"
```

## Advanced: Custom Content Generators

For content types that need special handling (like rich text editors, image galleries, etc.), create custom tools:

```typescript
// packages/ai/src/tools/custom-generators.ts

import { tool } from "ai";
import { z } from "zod";

export function createRichTextGeneratorTool() {
  return tool({
    description: "Generate rich text content with formatting, links, and structure",
    inputSchema: z.object({
      content: z.string().describe("The rich text content in markdown format"),
      format: z.enum(["markdown", "html"]).optional(),
    }),
    execute: async ({ content, format }) => {
      // Process and format the content
      return {
        success: true,
        formattedContent: content,
        format: format || "markdown",
      };
    },
  });
}
```

## Testing Checklist

When adding AI assistance to a new content type:

- [ ] Form fields defined with correct types and labels
- [ ] Routes added to navigation tool
- [ ] System prompt updated with content type info
- [ ] Assistant integrated in editor/form page
- [ ] Test: "Create a [content type]"
- [ ] Test: "Create a [content type] with [specific details]"
- [ ] Test: Navigation from other pages
- [ ] Test: Bilingual content generation
- [ ] Test: Form field streaming
- [ ] Test: Error handling

## Best Practices

### 1. Consistent Field Naming

Use consistent naming patterns across content types:
- `translations.{locale}.title`
- `translations.{locale}.description`
- `slug`
- `published_at` or `start_date`

### 2. Bilingual Support

Always include both Norwegian and English fields for user-facing content.

### 3. Smart Defaults

Provide sensible defaults in field definitions:
```typescript
{
  id: "status",
  type: "select",
  label: "Status",
  options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
  ],
  defaultValue: "draft", // Smart default
}
```

### 4. Validation

Add validation rules to prevent AI from generating invalid data:
```typescript
{
  id: "email",
  type: "text",
  label: "Email",
  validation: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Must be a valid email address",
  },
}
```

### 5. Context Awareness

Pass current form values to help AI make better decisions:
```typescript
const formContext = {
  formId: "product-form",
  formName: "Product Editor",
  fields: fields.map(f => ({
    ...f,
    currentValue: form.watch(f.id), // Include current values
  })),
};
```

## Troubleshooting

### AI not filling fields correctly

**Problem**: AI generates content but fields don't update

**Solution**: Check field IDs match exactly between form and field definitions:
```typescript
// Form field name
<Input name="translations.en.title" />

// Must match field definition
{ id: "translations.en.title", ... }
```

### Navigation not working

**Problem**: AI tries to navigate but nothing happens

**Solution**: Ensure route exists in `defaultAdminRoutes` and matches exactly:
```typescript
// Route definition
{ path: "/admin/posts/new", ... }

// AI will call
navigate({ path: "/admin/posts/new" })
```

### Content generation too generic

**Problem**: AI generates generic content instead of specific details

**Solution**: Improve system prompt with examples:
```typescript
## Example Interaction

User: "Create a product for BISO hoodie"

Your actions:
1. Navigate to /admin/shop/products/new
2. Generate specific content:
   - Name: "BISO Premium Hoodie"
   - Description: "High-quality hoodie with BISO logo..."
   - Price: 499 (typical hoodie price)
   - Category: "Apparel"
```

## Summary

The AI assistant system is fully extensible to any content type by:

1. Defining form fields
2. Adding navigation routes
3. Updating system prompt
4. Integrating assistant UI
5. Testing workflows

The pattern is consistent, making it easy to add AI assistance to new content types as your application grows.
