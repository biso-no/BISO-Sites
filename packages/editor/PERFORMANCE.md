# Performance Optimization Guide

This document outlines the performance optimizations implemented in the Puck editor.

## Implemented Optimizations

### 1. Content Editable Fields

Enabled inline editing for Heading and Text components:

```typescript
fields: {
  text: {
    type: "text",
    contentEditable: true, // Enable inline editing
  }
}
```

**Benefits:**
- Faster editing workflow
- Reduced UI re-renders
- Better user experience

### 2. Conditional resolveData Execution

All `resolveData` implementations check the `changed` parameter:

```typescript
resolveData: async ({ props }, { changed }) => {
  // Only re-fetch if relevant fields changed
  if (!changed.collection && !changed.query && !changed.fieldMapping) {
    return { props };
  }
  // ... fetch data
}
```

**Benefits:**
- Avoids unnecessary API calls
- Reduces server load
- Faster editor response

### 3. Read-Only Computed Fields

Database-loaded content is marked as read-only:

```typescript
return {
  props: { ...props, items: loadedItems },
  readOnly: { items: true }, // Prevent manual editing of DB content
};
```

**Benefits:**
- Prevents conflicting edits
- Clear distinction between manual/computed data
- Better data integrity

### 4. Loading States

Visual feedback during data fetching:

```typescript
<PageBuilderEditor 
  data={data}
  overrides={{
    fields: ({ children, isLoading }) => (
      <div className="relative">
        {children}
        {isLoading && <LoadingSpinner />}
      </div>
    )
  }}
/>
```

## Recommended Additional Optimizations

### 1. Debouncing Query Preview

For query builder, debounce preview execution:

```typescript
import { debounce } from "../lib/field-helpers";

const debouncedPreview = debounce(async (query) => {
  // Execute preview
}, 500);
```

### 2. Collection Schema Caching

Cache collection schemas in memory:

```typescript
const schemaCache = new Map<string, CollectionSchema>();

async function getCollectionSchema(id: string) {
  if (schemaCache.has(id)) {
    return schemaCache.get(id);
  }
  const schema = await fetchSchema(id);
  schemaCache.set(id, schema);
  return schema;
}
```

### 3. Lazy Loading Field Components

Use dynamic imports for heavy field components:

```typescript
const QueryBuilderField = dynamic(
  () => import("./fields/query-builder-field"),
  { loading: () => <LoadingSkeleton /> }
);
```

### 4. Memoization in Render Functions

Use React.memo for expensive renders:

```typescript
export const Stats = React.memo(({ stats, columns }) => {
  // ... rendering logic
});
```

### 5. Virtual Scrolling for Large Lists

For array fields with many items, implement virtualization:

```typescript
import { FixedSizeList } from "react-window";

// Use in array field rendering
```

### 6. Server-Side Caching

Cache resolved data with appropriate TTL:

```typescript
import { cache } from "react";

export const getResolvedPage = cache(async (pageId: string) => {
  const data = await fetchPage(pageId);
  return await resolveAllData(data, config);
});
```

### 7. Incremental Static Regeneration (ISR)

For web app pages using Puck content:

```typescript
export const revalidate = 3600; // Revalidate every hour

export default async function Page({ params }) {
  const data = await getResolvedPage(params.slug);
  return <ServerRenderer data={data} />;
}
```

## Performance Monitoring

### Key Metrics to Track

1. **resolveData Execution Time**
   - Monitor API response times
   - Set timeouts for queries
   - Log slow queries

2. **Editor Load Time**
   - Initial render time
   - Time to interactive
   - Component mount times

3. **Data Transfer Size**
   - Minimize payload size
   - Use field selection in queries
   - Compress responses

### Monitoring Implementation

```typescript
// Add to resolveData functions
const startTime = performance.now();
try {
  // ... data fetching
} finally {
  const duration = performance.now() - startTime;
  if (duration > 1000) {
    console.warn(`Slow resolveData: ${duration}ms`);
  }
}
```

## Best Practices

1. **Limit Query Results**: Default to reasonable limits (10-50 items)
2. **Use Pagination**: For large datasets, implement pagination
3. **Field Selection**: Only query fields you need
4. **Lazy Load Images**: Use next/image for optimized loading
5. **Debounce User Input**: Especially in query builder
6. **Cache Aggressively**: Both client and server side
7. **Monitor Bundle Size**: Keep editor bundle small

## Performance Checklist

- [x] ContentEditable fields for inline editing
- [x] Conditional resolveData execution
- [x] Read-only computed fields
- [x] Loading states in editor
- [ ] Debounced query preview
- [ ] Collection schema caching
- [ ] Lazy-loaded field components
- [ ] Memoized render functions
- [ ] Virtual scrolling for large arrays
- [ ] Server-side data caching
- [ ] ISR for public pages
- [ ] Performance monitoring

