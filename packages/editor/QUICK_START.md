# Quick Start Guide

Get your powerful page editor up and running in minutes!

## 🚀 Installation

The editor package is already set up in your monorepo. Install dependencies:

```bash
# From monorepo root
bun install
```

## 📝 Basic Usage

### 1. Use in Admin App

Create a new page editor route:

```tsx
// apps/admin/src/app/editor/page.tsx
"use client";

import { Editor } from "@repo/editor";
import { useState } from "react";

export default function EditorPage() {
  const handlePublish = async (data: any) => {
    // Save to your database
    const response = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      alert("Page published successfully!");
    }
  };

  return (
    <div className="h-screen">
      <Editor onPublish={handlePublish} />
    </div>
  );
}
```

### 2. Render in Web App

Display the published page:

```tsx
// apps/web/src/app/pages/[slug]/page.tsx
import { Render } from "@repo/editor";

async function getPageData(slug: string) {
  // Fetch from your database
  const response = await fetch(`/api/pages/${slug}`);
  return response.json();
}

export default async function PublishedPage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const pageData = await getPageData(params.slug);
  
  return <Render data={pageData} />;
}
```

## 🎨 Available Components

### UI Elements
- **Button**: 12 variants (gradient, glass, glow, animated)
- **Card**: 7 variants (glass, gradient, animated)
- **Badge**: 9 colors
- **Alert**: Default & destructive
- **Input**: Text, email, password, etc.

### Layout
- **Section**: Full-width with backgrounds
- **Container**: Constrained width
- **Columns**: 2-6 responsive columns
- **Grid**: Full CSS Grid control
- **Hero**: Feature-rich hero sections

### Content Blocks
- **CTA**: Call-to-action with buttons
- **Features**: Feature grid with icons

### Dynamic Content
- **DynamicList**: Fetch & display lists
- **DynamicCardGrid**: Card grids from APIs

## 🎛️ Styling Components

Every component includes comprehensive styling controls:

```tsx
// Example in the editor UI:
Button {
  text: "Get Started"
  variant: "gradient"
  size: "lg"
  // Spacing
  marginTop: "24px"
  paddingTop: "16px"
  paddingBottom: "16px"
  // Colors
  backgroundColor: "#FF6B6B"
  textColor: "#FFFFFF"
  // Border
  borderRadius: "xl"
  // Shadow
  shadow: "lg"
}
```

## 🔄 Dynamic Data

### Using Static Data

```tsx
DynamicList {
  dataSourceType: "static"
  staticData: JSON.stringify([
    { title: "Item 1", description: "Desc 1" },
    { title: "Item 2", description: "Desc 2" }
  ])
  itemTemplate: "card"
}
```

### Using API

```tsx
DynamicCardGrid {
  dataSourceType: "api"
  apiUrl: "https://api.example.com/products"
  titleField: "name"
  descriptionField: "description"
  imageField: "thumbnail"
  columns: "3"
}
```

### Using Appwrite

```tsx
DynamicList {
  dataSourceType: "appwrite"
  databaseId: "main"
  collectionId: "products"
  titleField: "title"
  limit: 10
}
```

## 👥 Real-time Collaboration (Optional)

### 1. Start WebSocket Server

For development:

```bash
# Install globally
npm install -g y-websocket

# Start server
HOST=localhost PORT=1234 npx y-websocket
```

### 2. Use Collaborative Editor

```tsx
// apps/admin/src/app/collab-editor/page.tsx
"use client";

import { CollaborativeEditor } from "@repo/editor/editor/collaborative";

export default function CollabEditorPage() {
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

### 3. Test Collaboration

1. Open the collab editor in 2+ browser windows
2. Edit in one window
3. See changes appear instantly in other windows
4. See live cursors showing where others are editing

## 🎯 Common Use Cases

### Landing Page

```tsx
// Use these components:
1. Hero (with CTA buttons)
2. Features (3-column grid)
3. CTA (Sign up section)
```

### Product Showcase

```tsx
// Use these components:
1. Hero (product image background)
2. DynamicCardGrid (from products API)
3. CTA (Buy now)
```

### Blog Layout

```tsx
// Use these components:
1. Section (header)
2. Container (content width)
3. DynamicList (blog posts from API)
```

## 📚 Learn More

- **README.md** - Complete feature documentation
- **DEVELOPMENT.md** - Developer guide & patterns
- **IMPLEMENTATION_SUMMARY.md** - What's been built

## 🆘 Need Help?

### Components not showing?
```bash
# Check Puck CSS is imported
# Check component is in config.tsx
# Check browser console for errors
```

### Styling not working?
```bash
# Ensure Tailwind is configured
# Check tailwind-merge is installed
# Inspect element with DevTools
```

### API data not loading?
```bash
# Check API URL is correct
# Check CORS settings
# Check network tab in DevTools
# Verify field mappings
```

## 🎉 You're Ready!

Start building amazing pages with your powerful editor. The system is production-ready and waiting for your creativity!

**Pro Tip**: Start with the example components, customize them, then add more shadcn components as needed using the wrapper utilities.

Happy building! 🚀

