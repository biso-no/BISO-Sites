## `@repo/editor` – Puck Page Builder

The `@repo/editor` package provides a Puck-based visual page builder for BISO Sites. Editors use it in the admin app to compose pages with drag-and-drop blocks; the web app then renders those pages from stored JSON.

For a full guide, see `/docs/packages/editor/overview` in the docs app.

### When to Use

- You need a visual editor for marketing/landing pages.
- You want to render dynamic page layouts in the public web app.
- You’re adding new block types that both admin and web should understand.

### Package Structure

```text
packages/editor/
├── components/             # Block implementations
│  ├── button.tsx
│  ├── heading.tsx
│  ├── section.tsx
│  └── text.tsx
├── editor.tsx              # <Editor /> for admin (Puck UI)
├── renderer.tsx            # <Renderer /> for web (renders JSON)
├── page-builder-config.tsx # Puck configuration
├── types.ts                # Shared types
└── package.json
```

### Quick Start

#### In Admin App (Editing)

```tsx
// apps/admin/src/app/(admin)/admin/pages/[id]/edit/page.tsx
import { Editor } from '@repo/editor';

export default function PageEditor({ initialData, pageId }: { initialData: any; pageId: string }) {
  async function handlePublish(data: unknown) {
    // Save to Appwrite (simplified example)
    await updatePageDocument(pageId, {
      puck_document: JSON.stringify(data),
    });
  }

  return <Editor data={initialData} onPublish={handlePublish} />;
}
```

#### In Web App (Rendering)

```tsx
// apps/web/src/app/(public)/[slug]/page.tsx
import { Renderer } from '@repo/editor';

export default async function DynamicPage({ params }: { params: { slug: string } }) {
  const page = await getPageBySlug(params.slug);
  const data = JSON.parse(page.puck_document);

  return <Renderer data={data} />;
}
```

### Available Blocks

Out of the box, the package ships with:

- `Button` – Call-to-action buttons with variants and sizes.
- `Heading` – H1–H6 headings with alignment options.
- `Section` – Layout container with background, padding, and max-width.
- `Text` – Rich text content with markdown support.

Each block is defined in `components/*` and wired into `page-builder-config.tsx`.

### Data Model

Pages are stored as JSON compatible with Puck:

```ts
interface PuckBlock {
  type: string;
  props: Record<string, any>;
  children?: PuckBlock[];
}

interface PuckDocument {
  content: PuckBlock[];
  root?: { props?: Record<string, any> };
}
```

The admin app typically stores this document on a page record (e.g. `puck_document` field in Appwrite).

### Extending the Editor

- Add a new component under `components/`.
- Update `page-builder-config.tsx` to register the block with Puck.
- Ensure the web app’s `<Renderer />` knows how to render the new block.

See `/docs/packages/editor/overview` and the admin app docs for concrete examples and patterns.


