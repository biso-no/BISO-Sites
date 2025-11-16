## `@repo/ui` – Design System

The `@repo/ui` package is the shared design system for BISO Sites. It provides tokens, theming, and UI primitives built on Tailwind CSS v4, Radix UI, and `class-variance-authority`, and is used across the web, admin, and docs apps.

For a full catalogue and patterns, see `/docs/packages/ui/overview` in the docs app.

### What’s Included

- Shared tokens for colors, spacing, radius, typography, and motion.
- 30+ Radix-based UI primitives under `components/ui/*`.
- Composite patterns (filter bars, resource cards, etc.).
- Theme provider and dark/light mode handling.
- Utilities (`cn`, tokens helpers) and global styles.

### Package Structure

```text
packages/ui/
├── components/
│  ├── ui/               # shadcn/Radix components
│  ├── patterns/         # Composite patterns
│  ├── theme-provider.tsx
│  └── image.tsx, mode-toggle.tsx, ...
├── hooks/
│  └── use-mobile.ts
├── lib/
│  ├── utils.ts          # cn(), helpers
│  ├── fonts.ts
│  └── tokens.ts         # typed token helpers
├── styles/
│  └── globals.css       # global styles & tokens import
└── package.json
```

### Setup in an App

In your app `globals.css`:

```css
@config "../../tailwind.config.cjs";
@plugin "tailwindcss-animate";
@import "tailwindcss";
@import "@repo/ui/styles/tokens.css";
```

Wrap your app with the theme and UI providers:

```tsx
import { ThemeProvider } from '@repo/ui/components/theme-provider';
import { ToastProvider } from '@repo/ui/components/ui/use-toast';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
```

### Tokens

- CSS variables are defined in `styles/tokens.css`.
- Typed helpers in `lib/tokens.ts`:

```ts
import { tokens, motion } from '@repo/ui/lib/tokens';

const primary = tokens.color.primary; // hsl(var(--primary))
const radiusSm = tokens.radius['radius-sm']; // var(--radius-sm)
const transition = motion.transition(['opacity', 'transform'], 'duration-200', 'ease-standard');
```

### Components

- Radix-wrapped primitives live under `components/ui/*` (button, card, dialog, table, etc.).
- Prefer using CVA-based variants over custom classes to stay consistent.

Typical usage:

```tsx
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/ui/card';

export function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="primary">Click me</Button>
      </CardContent>
    </Card>
  );
}
```

### Theming & Editorial

- Uses `next-themes` with `class` attribute; make sure the root `html` element toggles between `dark` and light.
- Dark/light tokens are AA contrast-checked for general UI; editorial content may need visual QA.
- `.prose` applies rich text styling using the tokenized typography scale; use `not-prose` to opt out for specific containers.
