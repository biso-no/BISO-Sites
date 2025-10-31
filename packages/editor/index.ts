/**
 * @repo/editor - Powerful Page Editor with Puck
 * 
 * A comprehensive page builder with:
 * - All shadcn components as building blocks
 * - Layout components (Section, Container, Columns, Grid, Hero)
 * - Content blocks (CTA, Features)
 * - Dynamic data integration (Appwrite, API, Static)
 * - Full styling controls
 * - Real-time collaboration with Yjs
 */

// Main editor and renderer
export { Editor } from "./editor";
export { Render } from "./render";
export { CollaborativeEditor } from "./editor/collaborative";

// Configuration
export { config } from "./config";

// Types
export * from "./types";

// Utilities
export { cn } from "./lib/utils";
export { applyStyles, generateClasses, generateInlineStyles } from "./lib/style-engine";
export { fetchData, clearDataCache, transformData, createDataSource } from "./lib/data-sources";
export { getPresetsForComponent, getPreset, presetGroups } from "./lib/presets";
export { createStyleFields } from "./lib/style-fields";

// Collaboration utilities
export { YjsAdapter, createUser, generateUserColor } from "./lib/yjs-adapter";
export { CollaborationUI, Cursor, Cursors } from "./components/collaboration-ui";

// Component wrapper utilities (for extending the editor)
export {
  createPuckComponent,
  createTextComponent,
  createVariantComponent,
  extractComponentProps,
} from "./lib/component-wrapper";

