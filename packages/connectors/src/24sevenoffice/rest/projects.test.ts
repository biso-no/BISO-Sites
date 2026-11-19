import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { finago } from "./client";
import { getProjects } from "./projects";

type GetResult = { data: unknown; error?: unknown; response: Response };

function page(data: unknown, nextToken?: string): GetResult {
  const headers = new Headers();
  if (nextToken) {
    headers.set(
      "Link",
      `<https://rest.api.24sevenoffice.com/v1/dimensions/1/elements?continuationToken=${nextToken}>; rel="next"`
    );
  }
  return { data, response: new Response(null, { headers }) };
}

function mockGet(results: GetResult[]) {
  let call = 0;
  // biome-ignore lint/suspicious/noExplicitAny: partial openapi-fetch mock
  return spyOn(finago, "GET").mockImplementation((async () => {
    const result = results[call];
    call += 1;
    return result;
    // biome-ignore lint/suspicious/noExplicitAny: partial openapi-fetch mock
  }) as any);
}

afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: restore spies
  (finago.GET as any).mockRestore?.();
});

describe("getProjects", () => {
  test("follows the continuation token across pages", async () => {
    const spy = mockGet([
      page([{ value: 1, name: "Alpha" }], "tok2"),
      page([{ value: 2, name: "Beta" }]),
    ]);
    const projects = await getProjects();
    expect(projects).toEqual([
      { projectId: "1", name: "Alpha" },
      { projectId: "2", name: "Beta" },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
    // biome-ignore lint/suspicious/noExplicitAny: inspecting mock call args
    const second = spy.mock.calls[1] as any;
    expect(second[1].params.query).toEqual({ continuationToken: "tok2" });
    expect(second[1].params.path).toEqual({ dimensionType: 1 });
  });
});
