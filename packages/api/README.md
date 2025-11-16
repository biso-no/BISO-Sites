## `@repo/api` – Appwrite Client Package

The `@repo/api` package provides type-safe Appwrite clients and helpers for all BISO Sites applications. It centralizes client creation, authentication handling, and generated types so that apps don’t repeat low-level Appwrite setup.

For full details, see `/docs/packages/api/overview` in the docs app.

### When to Use

Use `@repo/api` whenever you need to talk to Appwrite from:

- Server Components and server actions (web/admin apps).
- API route handlers (webhooks, background jobs).
- Client components that require direct Appwrite access (rare, but supported).

### Exports

The package exposes multiple entrypoints:

- `@repo/api` – shared helpers (e.g. storage URL helpers, types).
- `@repo/api/server` – server-side clients for Next.js (session/admin).
- `@repo/api/client` – browser/client exports from the official Appwrite SDK.
- `@repo/api/page-builder` – helpers used by the page builder.
- `@repo/api/types/*` – generated TypeScript types for Appwrite collections.

See `packages/api/package.json` for the full `exports` map.

### Package Structure

```text
packages/api/
├── server.ts          # Server-side clients (Next.js)
├── client.ts          # Client-side exports (browser)
├── storage.ts         # Storage URL helpers
├── page-builder.ts    # Page builder-related helpers
├── types/
│  └── appwrite.ts     # Generated Appwrite types
├── index.ts           # Main exports
├── tsconfig.json
└── package.json
```

### Quick Start

#### Server Components & Server Actions

```ts
import { createSessionClient } from '@repo/api/server';

export default async function Page() {
  const { account, db } = await createSessionClient();

  const user = await account.get();
  const posts = await db.listDocuments('database_id', 'posts_collection');

  return <div>{user.name}</div>;
}
```

Use `createSessionClient()` for user-scoped operations and `createAdminClient()` only in privileged contexts (webhooks, system tasks).

#### Client Components

```tsx
'use client';

import { Client, Account } from '@repo/api/client';

export function AccountInfo() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!);

  const account = new Account(client);
  // Use `account` in client-side logic as needed

  return null;
}
```

### Storage Helpers

Common storage URL helpers are re-exported from `index.ts`:

```ts
import {
  getStorageFileUrl,
  getStorageFileDownloadUrl,
  getStorageFileThumbnailUrl,
} from '@repo/api';

const url = getStorageFileUrl('bucket_id', 'file_id');
```

### TypeScript Types

Generated types in `types/appwrite.ts` keep database access type-safe:

```ts
import type { Users } from '@repo/api/types/appwrite';

async function getUser(db: any, userId: string): Promise<Users> {
  return db.getDocument('users', userId);
}
```

See `/docs/packages/api/overview` for advanced usage patterns, including queries, admin clients, and storage best practices.