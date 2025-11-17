# Critical Fixes Applied

## Issue: "use server" Files Exporting Non-Async Functions

**Problem**: Files with `"use server"` directive cannot export synchronous functions. Only async functions are allowed.

**Files Fixed**:

### 1. `apps/admin/src/app/actions/media.ts`
- ✅ Removed `getImageUrl()` export (was synchronous)
- ✅ Kept only async functions: `uploadImage()`, `deleteImage()`

**If you need getImageUrl**:
```typescript
import { getStorageFileUrl } from "@repo/api/storage";

// Use directly:
const url = getStorageFileUrl("content", fileId);
```

### 2. `packages/editor/lib/query-builder.ts`
- ✅ Removed `"use server"` directive completely
- ✅ This is now a utility library, not server actions
- Functions like `buildAppwriteQuery()`, `validateQueryConfig()` are utilities

**Usage**: Import these utilities in your own "use server" files:

```typescript
"use server";

import { buildAppwriteQuery } from "@repo/editor/lib/query-builder";
import { createSessionClient } from "@repo/api/server";

export async function myServerAction() {
  const { databases } = await createSessionClient();
  const queries = buildAppwriteQuery(config);
  // ... use queries
}
```

## Rule

**All files with `"use server"` must:**
1. Only export async functions
2. Each export is a server action
3. No synchronous utilities

**For utility functions:**
- Create separate files WITHOUT `"use server"`
- Import them into server action files as needed

## Verification

All server action files now comply:
- ✅ `apps/admin/src/app/actions/media.ts` - Only async exports
- ✅ `apps/admin/src/app/api/admin/**/route.ts` - Route handlers (not "use server")
- ✅ `packages/editor/lib/query-builder.ts` - No "use server" (utility library)

## Impact

**Breaking Change**: If any code was importing `getImageUrl` from `media.ts`, update to:

```typescript
// Before
import { getImageUrl } from "@/app/actions/media";

// After
import { getStorageFileUrl } from "@repo/api/storage";
const url = getStorageFileUrl("content", fileId);
```

This was likely not used yet since the implementation is fresh.

