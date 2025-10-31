# @repo/editor

A powerful, production-ready page builder built with Puck, featuring all shadcn components, dynamic data integration, and real-time collaboration.

## Features

- 🎨 **Rich Component Library**: All 41+ shadcn components ready to use
- 📐 **Layout Components**: Section, Container, Columns, Grid, Hero
- 🎯 **Content Blocks**: CTA, Features, and more
- 🔄 **Dynamic Data**: Integrate with Appwrite, APIs, or static data
- 🎛️ **Full Styling Controls**: Spacing, colors, borders, shadows, typography
- 🎨 **Style Presets**: Pre-configured styles for common use cases
- 👥 **Real-time Collaboration**: Multi-user editing with Yjs (optional)
- 📱 **Responsive**: Built-in responsive design controls
- 🚀 **TypeScript**: Fully typed for great DX

## Installation

This package is part of the monorepo and can be used in your apps:

```json
{
  "dependencies": {
    "@repo/editor": "*"
  }
}
```

## Quick Start

### Basic Editor

```tsx
import { Editor } from "@repo/editor";

function MyEditor() {
  const handlePublish = async (data) => {
    // Save to your database
    await fetch("/api/pages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  };

  return <Editor onPublish={handlePublish} />;
}
```

### Render Published Pages

```tsx
import { Render } from "@repo/editor";

function PublishedPage({ pageData }) {
  return <Render data={pageData} />;
}
```

### Collaborative Editor

```tsx
import { CollaborativeEditor } from "@repo/editor/editor/collaborative";

function CollabEditor() {
  return (
    <CollaborativeEditor
      documentId="page-123"
      wsUrl="ws://localhost:1234"
      userName="John Doe"
      onPublish={async (data) => {
        await saveToDatabase(data);
      }}
    />
  );
}
```

## Available Components

### UI Elements
- **Button**: 12 variants including gradient, glass, glow effects
- **Card**: 7 variants with header, content, footer
- **Badge**: 9 color variants
- **Alert**: Default and destructive variants
- **Input**: Multiple input types with labels

### Layout
- **Section**: Full-width sections with background images and overlays
- **Container**: Constrained width containers
- **Columns**: Responsive column layouts (2-6 columns)
- **Grid**: CSS Grid with full control
- **Hero**: Hero sections with CTAs

### Content Blocks
- **CTA**: Call-to-action blocks
- **Features**: Feature grid with icons

### Dynamic Content
- **DynamicList**: Fetch and display lists from any data source
- **DynamicCardGrid**: Card grids populated from APIs or databases

## Styling System

Every component includes comprehensive styling controls:

```tsx
// Example: Button with custom styling
{
  text: "Click me",
  variant: "gradient",
  marginTop: "24px",
  marginBottom: "24px",
  paddingTop: "16px",
  paddingBottom: "16px",
  shadow: "lg",
  borderRadius: "xl",
}
```

### Available Style Controls

- **Spacing**: margin, padding (all sides)
- **Colors**: background, text, border
- **Border**: width, radius, style
- **Shadow**: presets from sm to 2xl
- **Typography**: size, weight, alignment, line-height
- **Layout**: display, width, height, max-width

## Dynamic Data Integration

### Appwrite Integration

```tsx
{
  dataSourceType: "appwrite",
  databaseId: "main",
  collectionId: "products",
  titleField: "name",
  descriptionField: "description",
  imageField: "image",
}
```

### API Integration

```tsx
{
  dataSourceType: "api",
  apiUrl: "https://api.example.com/products",
  titleField: "title",
  descriptionField: "desc",
}
```

### Static Data

```tsx
{
  dataSourceType: "static",
  staticData: JSON.stringify([
    { title: "Item 1", description: "Description 1" },
    { title: "Item 2", description: "Description 2" },
  ]),
}
```

## Real-time Collaboration

### Setup WebSocket Server

For development, you can use the y-websocket package:

```bash
npm install -g y-websocket
HOST=localhost PORT=1234 npx y-websocket
```

For production, consider:
- [y-sweet](https://github.com/drifting-in-space/y-sweet) - Managed Yjs backend
- [Hocuspocus](https://tiptap.dev/hocuspocus) - Self-hosted collaboration server

### Enable Collaboration

```tsx
import { CollaborativeEditor } from "@repo/editor/editor/collaborative";

<CollaborativeEditor
  documentId="unique-page-id"
  wsUrl="ws://localhost:1234"
  userName="Current User"
/>
```

Features:
- ✅ Real-time syncing across multiple users
- ✅ Live cursors showing where others are editing
- ✅ User presence indicators
- ✅ Automatic conflict resolution
- ✅ Undo/Redo support
- ✅ Connection status indicator

## Extending the Editor

### Adding Custom Components

```tsx
import { createPuckComponent } from "@repo/editor";

const MyCustomComponent = createPuckComponent(
  MyComponent,
  {
    title: { type: "text", label: "Title" },
    description: { type: "textarea", label: "Description" },
  },
  {
    category: "Custom",
    enableStyling: {
      spacing: true,
      colors: true,
      border: true,
    },
  }
);
```

### Using Style Presets

```tsx
import { getPreset } from "@repo/editor";

const heroPreset = getPreset("Hero", "fullscreen");
// Apply preset styles to your component
```

### Custom Data Sources

```tsx
import { createDataSource, fetchData } from "@repo/editor";

const myDataSource = createDataSource.api("https://api.example.com/data");
const data = await fetchData(myDataSource, { cache: true });
```

## API Reference

### Editor Component

```tsx
interface EditorProps {
  data?: EditorData;
  onPublish?: (data: EditorData) => void | Promise<void>;
  onChange?: (data: EditorData) => void;
  headerPath?: string;
}
```

### Render Component

```tsx
interface RenderProps {
  data: EditorData;
}
```

### CollaborativeEditor Component

```tsx
interface CollaborativeEditorProps {
  documentId: string;
  wsUrl: string;
  userName?: string;
  data?: EditorData;
  onPublish?: (data: EditorData) => void | Promise<void>;
  headerPath?: string;
}
```

## Architecture

```
packages/editor/
├── components/           # All Puck component definitions
│   ├── ui/              # Shadcn component wrappers
│   ├── layout/          # Layout components
│   ├── content/         # Content blocks
│   └── dynamic/         # Dynamic data components
├── lib/                 # Core utilities
│   ├── style-fields.ts  # Reusable style field groups
│   ├── style-engine.ts  # Style generation engine
│   ├── presets.ts       # Style presets
│   ├── data-sources.ts  # Data fetching utilities
│   ├── yjs-adapter.ts   # Real-time collaboration
│   └── utils.ts         # General utilities
├── types/               # TypeScript type definitions
├── editor/              # Editor components
│   ├── index.tsx        # Standard editor
│   └── collaborative.tsx # Collaborative editor
├── render/              # Render component
├── config.tsx           # Puck configuration
└── index.ts             # Public exports
```

## Development

### Adding a New Component

1. Create component in appropriate directory:
   ```tsx
   // components/ui/my-component.tsx
   import { EnhancedComponentConfig } from "../../types";
   
   export const PuckMyComponent: EnhancedComponentConfig = {
     category: "UI Elements",
     fields: { /* ... */ },
     render: (props) => { /* ... */ },
   };
   ```

2. Add to config.tsx:
   ```tsx
   import { PuckMyComponent } from "./components/ui/my-component";
   
   export const config: Config = {
     components: {
       MyComponent: PuckMyComponent,
     },
   };
   ```

### Testing

The editor can be tested standalone before integrating into your apps. Create a test page:

```tsx
// app/editor-test/page.tsx
import { Editor } from "@repo/editor";

export default function EditorTestPage() {
  return <Editor />;
}
```

## Performance Tips

- Use `React.memo` for custom components
- Enable data caching for API calls
- Use the `limit` prop on dynamic components
- Lazy load images in dynamic components

## Troubleshooting

### Components not showing
- Ensure all imports are correct in config.tsx
- Check that component has `category` defined
- Verify components are added to `categories` object

### Styling not applying
- Check Tailwind CSS is configured correctly
- Ensure `tailwind-merge` is installed
- Use browser DevTools to inspect generated classes

### Real-time collaboration issues
- Verify WebSocket server is running
- Check WebSocket URL is correct
- Ensure `yjs` and `y-websocket` are installed

## License

Private - Part of monorepo

## Contributing

This is a monorepo package. To contribute:

1. Make changes in `packages/editor`
2. Test in apps (admin/web)
3. Create pull request

## Support

For issues or questions, contact the development team.

