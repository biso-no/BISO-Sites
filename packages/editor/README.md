# @repo/editor

A production-ready, visual page builder powered by Puck with 30+ pre-built components organized into Blocks and Elements.

## Overview

This package provides a comprehensive page building solution with:

- **16 Block Components** - High-level composite sections (Hero, CTA, Stats, Features, etc.)
- **15 Element Components** - UI primitives from shadcn/ui (Card, Badge, Alert, etc.)
- **4 Content Components** - Basic content building blocks (Heading, Text, Button, Section)
- **Image Upload Support** - Integrated Appwrite storage for image uploads
- **Icon Library** - Access to lucide-react icons
- **TypeScript** - Fully typed for excellent DX

## Installation

The package is already part of your monorepo. Simply import from `@repo/editor`:

```typescript
import { PageBuilderEditor, PageBuilderRenderer } from "@repo/editor";
```

## Quick Start

### Editor Mode

```typescript
import { PageBuilderEditor } from "@repo/editor";
import { useState } from "react";

function MyEditor() {
  const [data, setData] = useState({
    root: { props: {} },
    content: [],
  });

  return (
    <PageBuilderEditor
      data={data}
      onChange={setData}
    />
  );
}
```

### Render Mode

```typescript
import { PageBuilderRenderer } from "@repo/editor";

function MyPage({ pageData }) {
  return <PageBuilderRenderer data={pageData} />;
}
```

## Component Categories

### Blocks

High-level composite sections perfect for rapid page building:

#### Hero
Full-screen hero section with background, heading, description, and CTAs.

**Props:**
- `eyebrow` - Small text above heading
- `heading` - Main heading text (required)
- `description` - Supporting description
- `backgroundImage` - Background image data
- `backgroundGradient` - Gradient preset (blue, purple, pink, cyan, green, orange, custom)
- `overlayOpacity` - Overlay opacity (0-100)
- `primaryButtonLabel/Href` - Primary CTA button
- `secondaryButtonLabel/Href` - Secondary CTA button
- `align` - Content alignment (left, center, right)
- `height` - Section height (screen, large, medium)

**Example:**
```typescript
{
  type: "Hero",
  props: {
    heading: "Build Amazing Products",
    description: "The complete platform for modern teams",
    backgroundGradient: "custom",
    primaryButtonLabel: "Get Started",
    primaryButtonHref: "/signup",
    align: "center",
  }
}
```

#### Stats
Grid of statistics with icons and numbers.

**Props:**
- `stats` - Array of stat items
  - `icon` - Icon name from lucide-react
  - `number` - Stat number/value
  - `label` - Stat label
  - `gradient` - Color gradient
- `columns` - Grid columns (1-4)
- `animated` - Enable count-up animation

#### Features
Feature grid with icons, titles, and descriptions.

**Props:**
- `features` - Array of feature items
  - `icon` - Icon name from lucide-react
  - `title` - Feature title
  - `description` - Feature description
- `columns` - Grid columns (1-4)
- `iconPosition` - Icon position (top, left)
- `cardVariant` - Card style (default, glass, gradient)

#### CTA (Call to Action)
Prominent call-to-action section with benefits and buttons.

**Props:**
- `heading` - Main heading (required)
- `description` - Supporting text
- `primaryButtonLabel/Href` - Primary button
- `secondaryButtonLabel/Href` - Secondary button
- `benefits` - Array of benefit strings
- `layout` - Layout variant (centered, split)
- `backgroundImage` - Background image
- `backgroundGradient` - Gradient preset

#### CardGrid
Flexible grid of cards with images, titles, descriptions, and links.

**Props:**
- `cards` - Array of card items
  - `image` - Card image
  - `title` - Card title
  - `description` - Card description
  - `link` - Link URL
  - `linkLabel` - Link label
- `columns` - Grid columns (1-4)
- `cardVariant` - Card style (default, glass, gradient, golden)

#### Testimonial
Customer testimonial with quote, author, avatar, and rating.

**Props:**
- `quote` - Testimonial quote (required)
- `author` - Author name (required)
- `role` - Author role/title
- `avatar` - Author avatar image
- `rating` - Star rating (1-5)
- `background` - Background color

#### FAQ
Accordion-style frequently asked questions.

**Props:**
- `heading` - Section heading
- `description` - Section description
- `faqs` - Array of FAQ items
  - `question` - Question text
  - `answer` - Answer text

#### LogoCloud
Grid or marquee of partner/sponsor logos.

**Props:**
- `logos` - Array of logo items
  - `logo` - Logo image
  - `name` - Company name
  - `link` - Company link
- `grayscale` - Apply grayscale effect
- `layout` - Layout type (grid, marquee)

#### PricingTable
Pricing tiers with features and CTAs.

**Props:**
- `heading` - Section heading
- `description` - Section description
- `tiers` - Array of pricing tiers
  - `name` - Tier name
  - `price` - Price text
  - `period` - Billing period
  - `popular` - Mark as popular
  - `features` - Array of features
  - `buttonLabel/Href` - CTA button

#### TeamGrid
Team member cards with photos, names, roles, and social links.

**Props:**
- `members` - Array of team members
  - `photo` - Member photo
  - `name` - Member name
  - `role` - Member role
  - `bio` - Member bio
  - `linkedin/twitter/email` - Social links
- `columns` - Grid columns (1-4)

#### Newsletter
Email capture form with heading and description.

**Props:**
- `heading` - Form heading (required)
- `description` - Form description
- `placeholder` - Input placeholder
- `buttonLabel` - Submit button label
- `privacyNotice` - Privacy notice text
- `background` - Background style

#### Image
Image block with aspect ratio, borders, shadows, and captions.

**Props:**
- `image` - Image data (required)
- `caption` - Image caption
- `aspectRatio` - Aspect ratio (auto, square, video, wide, portrait)
- `border` - Border size (none, sm, md, lg)
- `shadow` - Shadow size (none, sm, md, lg, xl)
- `rounded` - Rounded corners

#### Spacer
Vertical spacing control.

**Props:**
- `size` - Preset size (none, sm, md, lg)
- `customHeight` - Custom height in pixels

### Elements

UI primitives from shadcn/ui wrapped for Puck:

#### CardElement
Container component with multiple variants.

**Variants:** default, glass, glass-dark, gradient, gradient-border, animated, golden

#### BadgeElement
Label component with color variants.

**Variants:** default, secondary, destructive, outline, glass-dark, gradient, gold, purple, green

#### AlertElement
Alert/notification message component.

**Variants:** default, destructive

#### SeparatorElement
Horizontal or vertical divider line.

#### AvatarElement
User avatar with image and fallback.

**Sizes:** sm, md, lg

#### TabsElement
Tabbed content sections.

#### AccordionElement
Collapsible accordion items.

**Types:** single (one open), multiple (many open)

#### ProgressElement
Progress bar with optional label.

#### SkeletonElement
Loading placeholder component.

**Variants:** text, circular, rectangular

#### CheckboxElement
Checkbox form input.

#### InputElement
Text input field.

**Types:** text, email, password, number

#### TextareaElement
Multi-line text input.

#### SelectElement
Dropdown select menu.

#### SwitchElement
Toggle switch component.

#### TableElement
Data table with columns and rows.

### Layout & Content

#### Section
Container section with background, padding, width, and alignment options.

**Props:**
- `background` - Background color (default, muted, primary)
- `gradient` - Gradient preset (overrides background)
- `backgroundImage` - Background image
- `overlayOpacity` - Image overlay opacity (0-100)
- `padding` - Vertical padding (none, sm, md, lg)
- `width` - Content max-width (default, lg, xl, full)
- `align` - Content alignment (left, center, right)
- `border` - Show border
- `shadow` - Shadow size (none, sm, md, lg, xl)

#### Heading
Text heading with multiple levels and sizes.

**Levels:** h1-h6  
**Sizes:** xs, sm, md, lg, xl, 2xl, 3xl

#### Text
Paragraph text with sizing and tone options.

**Sizes:** sm, base, lg, xl  
**Tones:** default, muted

#### Button
Call-to-action button with variants and sizes.

**Variants:** primary, secondary, outline  
**Sizes:** sm, md, lg

## Image Upload

The editor includes built-in image upload support using Appwrite storage.

### Setup Image Upload API

Create an API route in your admin app to handle uploads:

```typescript
// app/api/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { storage } from "@repo/api/server";
import { ID } from "node-appwrite";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileId = ID.unique();
    await storage.createFile(
      "content", // bucket ID
      fileId,
      file
    );

    return NextResponse.json({ fileId });
  } catch (error) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
```

Images are automatically displayed using `getStorageFileUrl()` from `@repo/api/storage`.

## Icon Integration

Components support lucide-react icons. Just enter the icon name (e.g., "Users", "Heart", "Star") in icon fields.

Available icons: https://lucide.dev/icons/

## Example Templates

Pre-built page templates are available:

```typescript
import { landingPageTemplate, aboutPageTemplate } from "@repo/editor/examples";

// Use as starting point
<PageBuilderEditor data={landingPageTemplate} />
```

### Landing Page Template

Includes:
- Hero section
- Stats grid
- Features section
- Testimonial
- Pricing table
- FAQ
- Final CTA

### About Page Template

Includes:
- Hero section
- Mission statement
- Company values
- Stats
- Team grid
- Timeline
- Join us CTA

## TypeScript Types

All components are fully typed. Import types from the package:

```typescript
import type {
  PageBuilderDocument,
  PageBuilderComponents,
  HeroBlockProps,
  StatsBlockProps,
  // ... etc
} from "@repo/editor";
```

## Customization

### Custom Header

```typescript
<PageBuilderEditor
  data={data}
  onChange={setData}
  overrides={{
    headerActions: ({ children }) => (
      <div className="flex gap-2">
        <CustomSaveButton />
        {children}
      </div>
    ),
  }}
/>
```

### Custom Field Types

Extend the editor with custom field types:

```typescript
<PageBuilderEditor
  data={data}
  onChange={setData}
  overrides={{
    fields: {
      customField: CustomFieldComponent,
    },
  }}
/>
```

## Best Practices

1. **Use Sections** - Wrap content in Section components for consistent spacing
2. **Mobile-First** - All components are responsive by default
3. **Accessibility** - Use semantic headings (h1 → h6) in proper order
4. **Images** - Always provide alt text for images
5. **Performance** - Use appropriate image sizes and aspect ratios

## Migration Guide

### From Simple Components to Blocks

**Before:**
```typescript
<Section>
  <Heading>Title</Heading>
  <Text>Description</Text>
  <Button>CTA</Button>
</Section>
```

**After:**
```typescript
<CTA
  heading="Title"
  description="Description"
  primaryButtonLabel="CTA"
/>
```

Blocks reduce boilerplate and provide consistent styling.

## Troubleshooting

### Images not displaying

Ensure:
1. Upload API route is configured
2. Appwrite storage bucket "content" exists
3. File permissions are set correctly

### Icons not showing

- Verify icon name matches lucide-react exactly (case-sensitive)
- Check icon exists at https://lucide.dev/icons/

### Linter errors

Run type checking:
```bash
bun run check-types
```

## Contributing

When adding new components:

1. Create component in `/components/blocks` or `/components/elements`
2. Add type definition to `types.ts`
3. Register in `page-builder-config.tsx`
4. Export from `index.ts`
5. Update this README

## License

Part of the BISO monorepo.
