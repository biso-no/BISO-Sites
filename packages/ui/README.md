@repo/ui — Design System

Overview

- Shared tokens, theming, and UI primitives for apps in this monorepo.
- Technology: Tailwind CSS v4, Radix UI, class-variance-authority, next-themes.
- Import tokens via CSS: `@import "@repo/ui/styles/tokens.css"` in your app `globals.css`.

Getting Started

- CSS setup in app globals.css:
  - `@config "../../tailwind.config.cjs"`
  - `@plugin "tailwindcss-animate"`
  - `@import "tailwindcss"`
  - `@import "@repo/ui/styles/tokens.css"`

- Providers:
  - Wrap your app with `ThemeProvider` and `ToastProvider`, `TooltipProvider` as needed.
  - Example:

    ```tsx
    import { ThemeProvider } from "@repo/ui/components/theme-provider";
    import { ToastProvider } from "@repo/ui/components/ui/use-toast";
    import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

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

Tokens

- CSS variables for colors, spacing, radius, typography, and motion are defined in `styles/tokens.css`.
- Type-safe accessors are available in `lib/tokens.ts`:
  - `tokens.color.primary` → `hsl(var(--primary))`
  - `tokens.radius["radius-sm"]` → `var(--radius-sm)`
  - `motion.transition(["opacity","transform"], "duration-200", "ease-standard")`

Components

- Radix-wrapped UI primitives live under `components/ui/*`.
- Prefer using exported variants (CVA) for consistent sizing and intent.

Theming

- Uses `next-themes` with class attribute. Ensure `html` class switches between `dark` and light.
- Dark/light tokens are AA contrast verified for general UI; preview editorial content for brand tweaks.

Editorial

- The `.prose` class customizes rich content using the tokenized typography scale.
- Add `not-prose` to opt-out containers.

