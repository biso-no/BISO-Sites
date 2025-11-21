"use client";

import { type Data, Render } from "@measured/puck";
import { config } from "./config";

export function PageRender({ data }: { data: Data }) {
  return <Render config={config} data={data} />;
}

export type { Data };
