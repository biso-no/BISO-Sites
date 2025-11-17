# Dynamic Data Loading Pattern for Puck Components

This document describes the pattern for adding dynamic data loading to Puck components.

## Pattern Overview

All blocks that display lists of data can be enhanced with dynamic loading from Appwrite collections.

### 1. Update Types

Add these fields to the block props type:

```typescript
{
  dataSource?: DataSourceType;
  collection?: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
}
```

### 2. Update Configuration

#### Default Props
```typescript
defaultProps: {
  dataSource: "manual",
  // ... existing defaults
}
```

#### Fields
```typescript
fields: {
  dataSource: dataSourceField,
  // ... other common fields
}
```

#### resolveFields
```typescript
resolveFields: (data) => {
  if (data.props.dataSource === "database") {
    return {
      dataSource: dataSourceField,
      collection: collectionSelectorField,
      query: queryBuilderField,
      fieldMapping: {
        ...fieldMapperField,
        render: (props: any) => fieldMapperField.render({
          ...props,
          targetFields: [
            { key: "fieldName", label: "Field Label", required: true },
            // ... more fields
          ],
        }),
      },
      // ... other fields
    };
  }
  // Return manual mode fields (array field)
  return {
    dataSource: dataSourceField,
    items: {
      type: "array",
      // ... array configuration
    },
    // ... other fields
  };
}
```

#### resolveData
```typescript
resolveData: async ({ props }, { changed }) => {
  if (props.dataSource !== "database" || !props.collection) {
    return { props };
  }
  if (!changed.collection && !changed.query && !changed.fieldMapping) {
    return { props };
  }
  try {
    const response = await fetch("/api/admin/query-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: props.collection,
        query: props.query,
        fieldMapping: props.fieldMapping,
      }),
    });
    const result = await response.json();
    if (result.success) {
      const items = result.data.documents.map((doc: any) => ({
        id: doc.$id,
        // ... map fields
      }));
      return {
        props: { ...props, items },
        readOnly: { items: true },
      };
    }
  } catch (error) {
    console.error("Failed to load items:", error);
  }
  return { props };
}
```

## Completed Blocks

- ✅ Stats - with count/sum/average aggregation
- ✅ Hero - with image upload
- ✅ CardGrid - with full field mapping
- ✅ FAQ - with field mapping

## Blocks to Complete

Follow the same pattern for:

### TeamGrid
Target fields: name, role, bio, linkedin, twitter, email, photo (ImageData)

### PricingTable
Target fields: name, price, period, popular, buttonLabel, buttonHref
Note: Features array requires nested mapping

### LogoCloud  
Target fields: name, link, logo (ImageData)

### Testimonial
Target fields: quote, author, role, avatar (ImageData), rating

## API Endpoints Used

- `/api/admin/collections` - List available collections
- `/api/admin/collections/[id]/schema` - Get collection schema
- `/api/admin/query-documents` - Execute query and return documents
- `/api/admin/query-stat` - Compute statistics (count/sum/average)
- `/api/admin/upload-image` - Upload images
- `/api/admin/delete-image` - Delete images

## Web App Rendering

When rendering in the web app, use `resolveAllData()` to execute all data fetching server-side:

```typescript
import { resolveAllData } from "@measured/puck";
import { pageBuilderConfig } from "@repo/editor/config";
import { createSessionClient } from "@repo/api/server";

const resolvedData = await resolveAllData(pageData, pageBuilderConfig);
return <Render config={pageBuilderConfig} data={resolvedData} />;
```

This ensures:
1. Data is fetched with proper permissions (via session client)
2. No client-side data fetching in production
3. Better performance and SEO

