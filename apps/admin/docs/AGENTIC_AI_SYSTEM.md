# Agentic AI Admin Assistant - Implementation Guide

## Overview

The admin application now features an advanced agentic AI assistant capable of completing multi-step tasks autonomously, including:

- **Task Analysis**: Understanding user intent and planning workflows
- **Autonomous Navigation**: Redirecting users to appropriate admin pages
- **Real-Time Content Generation**: Creating page layouts with streaming Puck JSON
- **Form Automation**: Filling forms with intelligent content generation
- **Granular State Feedback**: Visual indicators for each step of the workflow

## Architecture

### Core Components

#### 1. **Agentic Tools** (`packages/ai/src/tools/`)

- **`puck-generator.ts`**: 
  - `createTaskAnalyzerTool()`: Analyzes user requests to determine intent and required actions
  - `createPuckGeneratorTool()`: Generates complete page layouts in Puck JSON format

- **`navigation.ts`**: 
  - `createNavigationTool()`: Handles autonomous page navigation

- **`form-filler.ts`**: 
  - `createFormFillerTool()`: Populates form fields with streaming content

#### 2. **Streaming Infrastructure** (`packages/ai/src/lib/`)

- **`streaming-json-parser.ts`**: 
  - Real-time JSON parser that emits events as blocks are detected
  - Enables block-by-block rendering in the Puck editor
  - Events: `block-start`, `block-update`, `block-complete`, `parse-complete`

#### 3. **Agent State Management** (`packages/ai/src/types/`)

- **`agent-state.ts`**: 
  - Defines granular agent states: `thinking`, `analyzing-tools`, `navigating`, `generating-content`, `executing`
  - Provides display utilities for UI feedback

#### 4. **Puck Schema Extraction** (`packages/editor/src/`)

- **`get-puck-schema.ts`**: 
  - Extracts component schemas from Puck config
  - Formats schema information for AI context
  - Provides examples for AI reference

#### 5. **Enhanced Chat Hooks** (`apps/admin/src/components/assistant/`)

- **`use-puck-chat-stream.ts`**: 
  - Extends base chat functionality with Puck content generation
  - Integrates streaming JSON parser
  - Manages agent state transitions
  - Handles real-time block updates

## Workflow

### Phase 1: Task Identification

1. User sends a request (e.g., "Create a homepage for BISO")
2. AI calls `analyzeTask` tool to:
   - Identify intent: `create_page`
   - Determine navigation needed: `true` → `/admin/pages/new`
   - Identify content type: `puck_page`
   - Extract user details: title, theme, sections needed

**Agent State**: `analyzing-tools`

### Phase 2: Navigation

1. If user is not on the target page, AI calls `navigate` tool
2. Client-side hook intercepts navigation action
3. Router redirects user to appropriate page

**Agent State**: `navigating`

### Phase 3: Content Generation

1. AI calls `generatePuckContent` tool with complete page structure
2. JSON streams from the API in real-time
3. `StreamingJSONParser` detects block boundaries
4. Each block is emitted as soon as it's detected
5. Puck editor canvas updates in real-time

**Agent State**: `generating-content`

### Phase 4: Completion

1. All blocks rendered
2. AI confirms completion
3. User can make adjustments

**Agent State**: `idle`

## API Integration

### Admin Assistant Route (`apps/admin/src/app/api/admin-assistant/route.ts`)

```typescript
export async function POST(req: Request) {
  const { messages, currentPath, puckData } = await req.json();

  // Extract Puck schema for AI context
  const puckSchemas = await getPuckSchema(puckConfig);
  const schemaDescription = formatSchemaForAI(puckSchemas);

  // Create agentic tools
  const tools = {
    analyzeTask: createTaskAnalyzerTool(),
    navigate: createNavigationTool(defaultAdminRoutes),
    generatePuckContent: createPuckGeneratorTool(schemaDescription),
    fillFormFields: createFormFillerTool(formFields),
    translateContent: translateContentTool,
  };

  // Stream response with tools
  const result = streamText({
    model: openai("gpt-5"),
    messages: convertToModelMessages(messages),
    system: getSystemPrompt("admin", contextInfo),
    tools,
  });

  return result.toUIMessageStreamResponse();
}
```

## UI Components

### Agent State Indicator

The assistant sidebar displays the current agent state with appropriate icons:

- **Thinking**: Brain icon, pulsing animation
- **Analyzing Tools**: Zap icon, analyzing animation
- **Navigating**: Navigation icon, directional animation
- **Generating Content**: Wand icon, sparkle animation
- **Executing**: Check icon, completion animation

### Puck Editor Integration

When the AI generates page content:

1. Streaming JSON parser detects new blocks
2. Blocks appear in the editor canvas immediately
3. Props update in real-time as they stream
4. Visual indicator shows "Live Generation" state
5. User sees the page "drawing" itself

## Usage Examples

### Example 1: Create a New Page

**User**: "Create a homepage with a hero section, feature grid, and CTA"

**AI Workflow**:
1. `analyzeTask`: intent=`create_page`, navigation needed
2. `navigate`: `/admin/pages/new`
3. `generatePuckContent`: 
   ```json
   {
     "content": [
       { "type": "Hero", "props": {...} },
       { "type": "FeatureGrid", "props": {...} },
       { "type": "CTA", "props": {...} }
     ]
   }
   ```

### Example 2: Create an Event

**User**: "Lag et arrangement for quiz-kveld 15. desember"

**AI Workflow**:
1. `analyzeTask`: intent=`create_event`, navigation needed
2. `navigate`: `/admin/events/new`
3. `fillFormFields`: Generate Norwegian content, translate to English, fill all fields

### Example 3: Edit Existing Page

**User**: "Add a testimonials section to this page"

**AI Workflow**:
1. `analyzeTask`: intent=`edit_page`, no navigation (already on page)
2. `generatePuckContent`: Add testimonial component to existing content array

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=your_api_key_here
```

### Model Selection

The system uses `gpt-5` for optimal performance with tool calling and streaming. You can adjust this in the API route.

## Best Practices

### For AI Prompt Engineering

1. **Always start with task analysis**: Use `analyzeTask` before any action
2. **Provide complete props**: Every component needs all required fields
3. **Unique IDs**: Each component must have a unique `id` in props
4. **Logical ordering**: Components should be ordered top-to-bottom as they appear

### For Component Development

1. **Schema completeness**: Ensure Puck config has complete field definitions
2. **Default props**: Provide sensible defaults for all components
3. **Validation**: Validate required fields in component render functions

### For UI Integration

1. **State feedback**: Always show agent state to users
2. **Error handling**: Gracefully handle tool failures
3. **Cancellation**: Allow users to cancel long-running operations

## Troubleshooting

### Issue: AI not using tools correctly

**Solution**: Check that tool descriptions are clear and examples are provided in the system prompt.

### Issue: Streaming JSON parser not detecting blocks

**Solution**: Ensure JSON structure matches expected format with proper nesting.

### Issue: Navigation not working

**Solution**: Verify that the target route exists in `defaultAdminRoutes` and the user has permissions.

### Issue: Puck content not rendering

**Solution**: Check that component types match exactly with Puck config keys and all required props are provided.

## Future Enhancements

1. **Multi-language support**: Extend to more languages beyond Norwegian/English
2. **Template library**: Pre-built page templates for common use cases
3. **Version control**: Track changes made by AI for rollback
4. **Collaborative editing**: Multiple users + AI working together
5. **Advanced analytics**: Track AI usage and success rates
6. **Custom tool creation**: Allow admins to define custom tools for specific workflows

## Technical Notes

### TypeScript Configuration

Some TypeScript errors may appear due to monorepo configuration issues (e.g., missing `@repo/typescript-config/react-library.json`). These are pre-existing and don't affect functionality.

### Dependencies

- `ai` SDK v5.0+ for streaming and tool calling
- `@measured/puck` v0.20+ for page editor
- `zod` v4.1+ for schema validation
- `openai` SDK for gpt-5 access

### Performance Considerations

- Streaming reduces perceived latency
- Block-by-block rendering provides immediate feedback
- Tool calls are executed sequentially to maintain state consistency
- Parser uses efficient string matching for real-time processing

## Support

For issues or questions about the agentic AI system, refer to:
- API route: `apps/admin/src/app/api/admin-assistant/route.ts`
- Tools: `packages/ai/src/tools/`
- Prompts: `packages/ai/src/prompts.ts`
- UI components: `apps/admin/src/components/assistant/`
