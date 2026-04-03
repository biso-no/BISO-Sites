import { type Config, type Data } from "@puckeditor/core";
import { Render } from "@puckeditor/core/rsc";
import { renderConfig } from "./render-config";

export function PageRender({ data }: { data: Data }) {
  return <Render config={renderConfig as Config} data={data} />;
}
