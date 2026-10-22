/**
 * The paths iOS hands to the BISO app (Universal Links). Only the app's own
 * links belong here: the website's sign-in returns (`/auth/callback`,
 * `/auth/oauth`) must stay in the browser. The static
 * `public/.well-known/apple-app-site-association` mirrors this list; a test
 * keeps them in sync.
 */
export const APP_LINK_COMPONENTS = [
  { "/": "/auth/verify", comment: "app sign-in link" },
  { "/": "/app/*", comment: "app shortcuts and returns" },
];
