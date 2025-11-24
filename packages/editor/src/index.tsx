// Server-safe entry for the editor package.
// Only re-export types here so this module can be imported from Server Components
// without pulling in client-only Puck runtime APIs.
export type { Config, Data } from "@measured/puck";

export type { PageBuilderDocument } from "./types";
