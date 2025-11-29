# Puck Editor Block Architecture

## Core Philosophy

**Fewer blocks, more layouts.** Instead of content-specific blocks (Events, News, Jobs), we use generic, data-driven blocks with pattern-based layout variants.

## Visual Pattern Inventory (from hardcoded pages)

| Pattern Name | Usage in Hardcoded Pages | Grid Layout |
|-------------|-------------------------|-------------|
| `card-grid` | Events, News | `md:grid-cols-2 lg:grid-cols-3` |
| `card-grid-2col` | Jobs | `md:grid-cols-2` |
| `icon-feature` | Benefits, Features | `lg:grid-cols-3` |
| `logo-grid` | Partners, Sponsors | `sm:grid-cols-4` |
| `compact-card` | Career days, Campuses | `sm:grid-cols-2 xl:grid-cols-4` |
| `team-grid` | Team members | `md:grid-cols-3 lg:grid-cols-4` |
| `stacked-list` | FAQ, Steps | Vertical stack |
| `featured-hero` | Homepage sections | 1 featured + grid |

## Generic Block Types

### 1. Collection (replaces: Events, News, Jobs, LogoGrid, TeamGrid, FeatureGrid)
**Purpose:** Display any list of items from database or manual entry.

**Layout variants:**
- `card-grid` - Image cards with title, subtitle, meta, CTA
- `compact-card` - Smaller cards for quick info
- `icon-feature` - Icon + title + description
- `logo-grid` - Images only (for partners/sponsors)
- `team-grid` - Person cards (photo, name, role)
- `stacked-list` - Vertical list items

**Field structure:**
```typescript
{
  // Simple mode (defaults)
  title?: string;
  subtitle?: string;
  
  // Layout
  layout: "card-grid" | "compact-card" | "icon-feature" | "logo-grid" | "team-grid" | "stacked-list";
  columns?: 2 | 3 | 4 | 5 | 6;
  
  // Data source (Advanced)
  dataMode: "manual" | "dynamic";
  dataSource?: DataSourceConfig;  // table, filters, sort, limit
  
  // Manual items (when dataMode = "manual")
  items?: CollectionItem[];
  
  // Display options
  showFilters?: boolean;
  showSearch?: boolean;
  emptyMessage?: string;
  ctaLabel?: string;
  ctaLink?: string;
}
```

### 2. Hero (existing, already generic)
- Layout variants: center, left, split, carousel

### 3. Section (existing)
- Wrapper with background, padding, DropZone

### 4. Columns (existing)
- Layout variants: 1:1, 2:1, 1:2, 1:1:1

### 5. CTA (existing)
- Layout variants: banner, card, inline

### 6. Accordion (existing)
- For FAQ sections

### 7. RichText (new)
- Markdown/HTML content block

### 8. Spacer (existing)
- Vertical spacing

---

## Field Mapping System

For dynamic data, each layout needs to know which data fields map to which display slots:

```typescript
type FieldMapping = {
  // Common mappings
  title: string;       // e.g., "title" | "name"
  subtitle?: string;   // e.g., "description" | "role"
  image?: string;      // e.g., "image" | "logo" | "imageUrl"
  href?: string;       // e.g., "$id" (computed to "/events/{id}")
  
  // Layout-specific
  date?: string;       // For card-grid
  badge?: string;      // For card-grid
  icon?: string;       // For icon-feature
}
```

Default mappings are provided per table, but can be overridden in Advanced settings.

---

## UX Layers

### Simple Mode (non-technical users)
- Pre-configured layouts with sensible defaults
- "Add items" array for manual content
- Quick presets: "Show upcoming events", "Show latest news"

### Advanced Mode (power users)
- Full DataSourcePicker for custom queries
- Field mapping overrides
- Filter/sort configuration
- Custom styling options

---

## Migration Map

| Old Block | New Block | Layout |
|-----------|-----------|--------|
| Events | Collection | card-grid |
| News | Collection | card-grid |
| JobsList | Collection | card-grid-2col |
| LogoGrid | Collection | logo-grid |
| TeamGrid | Collection | team-grid |
| FeatureGrid | Collection | icon-feature |
| StatsGrid | Collection | compact-card |

---

## Implementation Priority

1. ✅ Data infrastructure (types, schemas, fetch)
2. 🔄 Collection block with all layouts
3. ⏳ Field mapping system
4. ⏳ FilterBar integration
5. ⏳ Deprecate old content-specific blocks
