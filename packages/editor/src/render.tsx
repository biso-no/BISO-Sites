"use client";

import { type Config, type Data, Render } from "@puckeditor/core";
import { config, type Props } from "./config";

export function PageRender({ data }: { data: Data<Props> }) {
  return <Render config={config as Config} data={data} />;
}

export type { Data };
