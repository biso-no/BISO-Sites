import type { Config, Data } from "@puckeditor/core";
import { Render } from "@puckeditor/core/rsc";
import { config } from "./config";
import { migratePuckData } from "./migrate";

export function PageRender({ data }: { data: unknown }) {
  const migrated = migratePuckData(data) as Data;
  return <Render config={config as unknown as Config} data={migrated} />;
}
