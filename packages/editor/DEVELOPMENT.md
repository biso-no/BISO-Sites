# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- Package manager (npm, pnpm, or bun)
- Basic understanding of React and Puck

### Local Development

1. Install dependencies:
```bash
bun install
```

2. Start the development server (from root):
```bash
turbo dev
```

3. Test the editor in your app:
```tsx
// app/test-editor/page.tsx
import { Editor } from "@repo/editor";

export default function TestPage() {
  return (
    <div className="h-screen">
      <Editor
        onPublish={(data) => {
          console.log("Published data:", data);
        }}
      />
    </div>
  );
}
```

## Architecture Overview

### Component Structure

Every Puck component follows this structure:

```tsx
import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";

interface MyComponentProps {
  // Component-specific props
  title: string;
  description?: string;
  
  // Styling props (optional)
  marginTop?: string;
  paddingTop?: string;
  backgroundColor?: string;
  // ... etc
}

export const PuckMyComponent: EnhancedComponentConfig<MyComponentProps> = {
  // Category for organization
  category: "UI Elements",
  
  // Field definitions for the sidebar
  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
    // Add styling fields
    marginTop: { type: "text", label: "Margin Top" },
    // ... more fields
  },
  
  // Default values
  defaultProps: {
    title: "Default Title",
  },
  
  // Render function
  render: (props) => {
    const {
      title,
      description,
      marginTop,
      // ... extract props
    } = props;

    // Apply styling
    const { className, style } = applyStyles({
      marginTop,
      // ... pass style props
    });

    return (
      <div className={className} style={style}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    );
  },
};
```

### Adding a New Component

1. **Create the component file:**

```bash
# UI component
touch packages/editor/components/ui/my-component.tsx

# Layout component
touch packages/editor/components/layout/my-layout.tsx

# Content block
touch packages/editor/components/content/my-block.tsx
```

2. **Implement the component** (follow structure above)

3. **Add to config.tsx:**

```tsx
import { PuckMyComponent } from "./components/ui/my-component";

export const config: Config = {
  components: {
    // ... existing components
    MyComponent: PuckMyComponent,
  },
  categories: {
    "UI Elements": {
      components: ["Button", "Card", "MyComponent"], // Add here
    },
  },
};
```

## Style System

### Using Style Fields

Pre-built style field groups are available:

```tsx
import { createStyleFields } from "../../lib/style-fields";

fields: {
  ...createStyleFields({
    spacing: true,
    colors: true,
    border: true,
    shadow: true,
  }),
  // Your component fields
  title: { type: "text", label: "Title" },
}
```

### Applying Styles

```tsx
import { applyStyles } from "../../lib/style-engine";

const { className, style } = applyStyles({
  marginTop: props.marginTop,
  paddingTop: props.paddingTop,
  backgroundColor: props.backgroundColor,
  // ... all style props
});

return <div className={className} style={style}>{children}</div>;
```

### Creating Style Presets

Add presets in `lib/presets.ts`:

```tsx
export const myComponentPresets: StylePreset[] = [
  {
    name: "modern",
    label: "Modern",
    description: "Modern style with shadows and rounded corners",
    styles: {
      border: { radius: "xl" },
      shadow: { preset: "lg" },
      spacing: {
        padding: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
      },
    },
  },
];

// Add to presetGroups
export const presetGroups: PresetGroup[] = [
  // ... existing
  {
    name: "MyComponent",
    presets: myComponentPresets,
  },
];
```

## Dynamic Data Components

### Basic Dynamic Component

```tsx
export const PuckDynamicComponent: EnhancedComponentConfig = {
  dataBinding: true, // Enable data binding
  
  fields: {
    dataSourceType: {
      type: "select",
      options: [
        { label: "API", value: "api" },
        { label: "Appwrite", value: "appwrite" },
        { label: "Static", value: "static" },
      ],
    },
    apiUrl: { type: "text", label: "API URL" },
    // ... more config fields
  },
  
  resolveData: async (props) => {
    const { dataSourceType, apiUrl } = props;
    
    let dataSource;
    if (dataSourceType === "api") {
      dataSource = createDataSource.api(apiUrl);
    }
    // ... handle other types
    
    const data = await fetchData(dataSource, { cache: true });
    return { items: data };
  },
  
  render: (props) => {
    const { items = [] } = props as any; // resolveData injects items
    
    return (
      <div>
        {items.map((item, index) => (
          <div key={index}>{item.title}</div>
        ))}
      </div>
    );
  },
};
```

## Testing Real-time Collaboration

### 1. Start WebSocket Server

```bash
# Install y-websocket globally
npm install -g y-websocket

# Start server
HOST=localhost PORT=1234 npx y-websocket
```

### 2. Use Collaborative Editor

```tsx
import { CollaborativeEditor } from "@repo/editor/editor/collaborative";

export default function CollabTestPage() {
  return (
    <CollaborativeEditor
      documentId="test-doc-1"
      wsUrl="ws://localhost:1234"
      userName="Developer"
      onPublish={(data) => console.log(data)}
    />
  );
}
```

### 3. Test with Multiple Windows

1. Open the same page in 2+ browser windows
2. Edit in one window
3. See changes appear in real-time in other windows
4. See cursors and user presence

## Common Patterns

### Variant Component

For components with multiple visual variants:

```tsx
import { createVariantComponent } from "../../lib/component-wrapper";

export const PuckMyVariantComponent = createVariantComponent(
  MyUIComponent,
  {
    // Additional fields
    content: { type: "text", label: "Content" },
  },
  [
    { label: "Default", value: "default" },
    { label: "Primary", value: "primary" },
    { label: "Secondary", value: "secondary" },
  ],
  {
    category: "UI Elements",
    enableStyling: { spacing: true, colors: true },
  }
);
```

### Text-only Component

For simple text components:

```tsx
import { createTextComponent } from "../../lib/component-wrapper";

export const PuckHeading = createTextComponent(
  ({ children }) => <h2 className="text-3xl font-bold">{children}</h2>,
  {
    label: "Heading Text",
    category: "UI Elements",
    enableStyling: { typography: true, spacing: true },
  }
);
```

## Performance Optimization

### 1. Memoize Expensive Components

```tsx
import { memo } from "react";

const ExpensiveComponent = memo(({ data }) => {
  // Complex rendering logic
  return <div>{/* ... */}</div>;
});
```

### 2. Data Fetching with Cache

```tsx
resolveData: async (props) => {
  const data = await fetchData(dataSource, {
    cache: true,
    cacheDuration: 10 * 60 * 1000, // 10 minutes
  });
  return { data };
}
```

### 3. Lazy Load Images

```tsx
<img
  src={image}
  alt={title}
  loading="lazy"
  className="w-full h-auto"
/>
```

## Debugging

### Enable Puck Dev Tools

```tsx
<Puck
  config={config}
  data={data}
  // Enable dev tools
  iframe={{ enabled: false }} // Disable iframe for easier debugging
/>
```

### Log Component Props

```tsx
render: (props) => {
  console.log("Component props:", props);
  // ... rest of render
}
```

### Inspect Yjs State

```tsx
const adapter = new YjsAdapter(/* ... */);
console.log("Current data:", adapter.getData());
console.log("Awareness:", adapter.getAwareness());
console.log("Connection:", adapter.getConnectionStatus());
```

## Extending the Editor

### Custom Field Types

Create custom Puck field types in `fields/`:

```tsx
// fields/color-picker-field.tsx
export const ColorPickerField = {
  type: "custom",
  render: ({ value, onChange, name }) => {
    return (
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
};
```

### Custom Overrides

Override Puck UI elements:

```tsx
const overrides = {
  componentItem: ({ name }) => (
    <div className="custom-component-item">
      <Icon name={name} />
      {name}
    </div>
  ),
};

<Puck config={config} overrides={overrides} />
```

## Best Practices

1. **Always use TypeScript** - Leverage the type system
2. **Organize by category** - Keep components well-organized
3. **Provide sensible defaults** - Make components work out of the box
4. **Add descriptions** - Help users understand what each field does
5. **Test responsive** - Ensure components work on all screen sizes
6. **Cache data** - Use caching for dynamic data
7. **Handle errors** - Gracefully handle API failures
8. **Document presets** - Explain what each preset does

## Troubleshooting

### TypeScript Errors

If you get type errors:

```bash
# Clean and rebuild
rm -rf node_modules/.cache
bun install
turbo build
```

### Components Not Showing

1. Check import in config.tsx
2. Verify category exists
3. Check console for errors
4. Ensure component is exported

### Styling Not Working

1. Verify Tailwind is configured
2. Check tailwind-merge is installed
3. Use browser DevTools to inspect
4. Check for CSS specificity issues

### Collaboration Not Syncing

1. Check WebSocket server is running
2. Verify correct WebSocket URL
3. Check browser console for errors
4. Test with simple data first

## Resources

- [Puck Documentation](https://puckeditor.com/docs)
- [Yjs Documentation](https://docs.yjs.dev/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

