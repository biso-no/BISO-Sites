import { type Config } from "@puckeditor/core";
import { Render } from "@puckeditor/core/rsc";
import { config } from "./config";
import { migratePuckData } from "./migrate";

export function PageRender({ data }: { data: unknown }) {
  const migratedData = migratePuckData(data);
  return <Render config={config as unknown as Config} data={migratedData} />;
}
