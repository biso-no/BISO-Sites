# AI Assistant Quick Start Guide

## What's Been Implemented

The admin application now has a **fully functional agentic AI assistant** that can:

✅ **Analyze user requests** and plan multi-step workflows  
✅ **Navigate autonomously** to the correct admin pages  
✅ **Generate page content** in real-time with Puck editor integration  
✅ **Fill forms automatically** with intelligent, bilingual content  
✅ **Show granular progress** with visual state indicators  

## How to Use

### 1. Creating a Page with AI

**In the page editor:**

1. Click the AI assistant button (floating button, bottom-right)
2. Type: "Create a homepage with a hero section, features, and call-to-action"
3. Watch the AI:
   - **Analyzing Tools...** (planning the workflow)
   - **Generating Content...** (creating Puck components)
   - Content appears in the editor in real-time
4. Review and adjust the generated content
5. Click "Save Draft" or "Publish"

**From anywhere in the admin:**

1. Open AI assistant
2. Type: "Create a new page for our about section"
3. AI will:
   - Navigate to `/admin/pages` 
   - Guide you through page creation
   - Generate content once in the editor

### 2. Creating Events, Products, Jobs

**Example: Event**

```
User: "Lag et arrangement for quiz-kveld på campus Bergen 15. desember"

AI will:
1. Navigate to /admin/events/new
2. Generate Norwegian content (title, description)
3. Translate to English
4. Fill all form fields including date
5. Generate URL slug
```

**Example: Product**

```
User: "Create a product for BISO hoodie, price 399 NOK"

AI will:
1. Navigate to /admin/shop/products/new
2. Generate product details in both languages
3. Set price and other fields
4. Create SEO-friendly slug
```

### 3. Advanced Usage

**Specific requests:**

```
"Create a landing page with:
- Hero section with 'Welcome to BISO' title
- 3-column feature grid highlighting events, networking, and resources
- Stats section showing member count
- Call-to-action for joining"
```

**Editing existing content:**

```
"Add a testimonials section to this page"
"Change the hero title to 'BI Student Organisation'"
"Add a FAQ section with 5 common questions"
```

## AI Workflow States

Watch for these indicators in the assistant sidebar:

| State | Icon | Meaning |
|-------|------|---------|
| **Thinking...** | 🔄 Spinner | Processing your request |
| **Analyzing Tools...** | ⚡ Zap | Planning the workflow |
| **Navigating...** | 🧭 Navigation | Redirecting to correct page |
| **Generating Content...** | 🪄 Wand | Creating content (Puck/forms) |

## What the AI Can Do

### ✅ Supported Features

- **Page Creation**: Full Puck editor integration with 20+ components
- **Event Creation**: Bilingual events with dates, locations, pricing
- **Form Filling**: Automatic population of all form fields
- **Navigation**: Smart routing to correct admin pages
- **Bilingual Content**: Norwegian and English generation
- **Real-Time Streaming**: See content appear as it's generated

### 🚧 Coming Soon

- **Content Translation**: Translate existing pages between languages
- **Bulk Operations**: Create multiple items at once
- **Template Library**: Pre-built page templates
- **Image Generation**: AI-generated images for content
- **SEO Optimization**: Automatic meta descriptions and keywords

## Available Puck Components

When generating pages, the AI can use these components:

**Layout & Structure:**
- `Hero` - Page headers with titles, descriptions, CTAs
- `Section` - Container sections with customizable styling
- `Columns` - Multi-column layouts (2-4 columns)
- `Spacer` - Vertical spacing control

**Content Blocks:**
- `RichText` - Formatted text content
- `FeatureGrid` - Feature showcases with icons
- `StatsGrid` - Statistics display
- `CTA` - Call-to-action sections
- `Accordion` - Expandable content sections
- `Tabs` - Tabbed content organization

**Data-Driven:**
- `Collection` - Dynamic content from database
- `FilteredEvents` - Event listings with filters
- `FilteredNews` - News/blog listings
- `JobsList` - Job postings display
- `TeamGrid` - Team member profiles

**Navigation:**
- `PageHeader` - Page titles and breadcrumbs
- `TableOfContents` - Auto-generated TOC
- `FilterBar` - Content filtering UI

**Visual Elements:**
- `LogoGrid` - Partner/sponsor logos
- `Timeline` - Event timelines
- `About` - About section with image

## Tips for Best Results

### 1. Be Specific

❌ "Create a page"  
✅ "Create a homepage with a hero, 3 features, and a newsletter signup"

### 2. Provide Context

❌ "Make an event"  
✅ "Create a networking event for business students on December 20th at Campus Oslo"

### 3. Specify Language

❌ "Create content"  
✅ "Create a Norwegian event description for quiz night"

### 4. Request Adjustments

After generation:
- "Make the hero title larger"
- "Add more features to the grid"
- "Change the CTA button text to 'Join Now'"

## Troubleshooting

### AI doesn't respond

**Check:**
- Is the assistant sidebar open?
- Is there an error message in the chat?
- Try refreshing the page

### Content not appearing in editor

**Check:**
- Are you on the correct page (editor)?
- Did the AI complete generation? (check for "idle" state)
- Try asking AI to regenerate

### Navigation not working

**Check:**
- Do you have permissions for the target page?
- Is the route valid? (e.g., `/admin/pages/new`)
- Check browser console for errors

### Generated content is wrong

**Solution:**
- Be more specific in your request
- Provide examples: "like the homepage but for events"
- Request corrections: "change the title to..."

## Technical Details

### API Endpoint

```
POST /api/admin-assistant
```

### Request Format

```json
{
  "messages": [
    { "role": "user", "content": "Create a homepage" }
  ],
  "currentPath": "/admin/pages/123/no/editor",
  "puckData": { "content": [...] }
}
```

### Response Format

Streaming response with tool calls:
- `analyzeTask` - Task analysis
- `navigate` - Page navigation
- `generatePuckContent` - Page content
- `fillFormFields` - Form population

## Examples by Content Type

### Pages (Puck Editor)

```
"Create a landing page for BISO membership"
"Add a hero section with signup form"
"Create an about page with team grid"
"Make a contact page with form and map"
```

### Events

```
"Create a quiz night event for December 15th"
"Make a networking event at Campus Bergen"
"Create a workshop on career development"
"Add a Christmas party event with ticket link"
```

### Products

```
"Create a product for BISO t-shirt, price 199 NOK"
"Add a hoodie product with size options"
"Create a membership card product"
```

### Jobs

```
"Create a job posting for summer internship at DNB"
"Add a part-time position for event coordinator"
"Create an internship listing with June deadline"
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open AI assistant (coming soon) |
| `Esc` | Close assistant sidebar |
| `Enter` | Send message |

## Best Practices

1. **Start Simple**: Begin with basic requests, then add complexity
2. **Iterate**: Generate content, review, then request adjustments
3. **Save Often**: Save drafts frequently during AI generation
4. **Verify Content**: Always review AI-generated content before publishing
5. **Provide Feedback**: The AI learns from your adjustments

## Support

For issues or questions:
- Check the [Implementation Guide](./AGENTIC_AI_SYSTEM.md)
- Review [Extensibility Guide](./AI_ASSISTANT_EXTENSIBILITY.md)
- Contact the development team

## What's Next

The AI assistant will continue to improve with:
- More content types (posts, announcements)
- Better context awareness
- Template library
- Batch operations
- Advanced customization options

---

**Ready to try it?** Open the page editor and click the AI assistant button! 🚀
