export type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
export {
  type BiDirectoryUser,
  getBiDirectoryUser,
  isBiDirectoryConfigured,
} from "./bi-directory";
export { createGraphClient } from "./graph-client";
