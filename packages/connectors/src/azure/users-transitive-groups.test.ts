import { describe, expect, mock, test } from "bun:test";
import { GraphUserService } from "./users";

interface FakeRequest {
  get: () => Promise<unknown>;
  select: (fields: string) => FakeRequest;
}

/** A Graph client that answers each `.api(path)` from `pages`. */
function fakeGraph(pages: Record<string, unknown>) {
  const selects: string[] = [];
  const api = mock((path: string): FakeRequest => {
    const request: FakeRequest = {
      get: async () => {
        await Promise.resolve();
        const page = pages[path];
        if (page instanceof Error) {
          throw page;
        }
        return page;
      },
      select: (fields) => {
        selects.push(fields);
        return request;
      },
    };
    return request;
  });
  return { api, selects };
}

function serviceWith(client: ReturnType<typeof fakeGraph>): GraphUserService {
  const service = new GraphUserService("tenant", "client", "secret");
  Reflect.set(service, "client", client);
  return service;
}

const GROUP = "#microsoft.graph.group";

describe("GraphUserService.listTransitiveGroupNames", () => {
  test("follows @odata.nextLink and returns every display name", async () => {
    const next =
      "https://graph.microsoft.com/v1.0/users/graph-1/transitiveMemberOf?$skiptoken=abc";
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": {
        value: [
          { "@odata.type": GROUP, id: "1", displayName: "SG-App-Campus-Oslo" },
          {
            "@odata.type": "#microsoft.graph.directoryRole",
            id: "2",
            displayName: null,
          },
          {
            "@odata.type": "#microsoft.graph.administrativeUnit",
            id: "4",
            displayName: null,
          },
        ],
        "@odata.nextLink": next,
      },
      [next]: {
        value: [
          {
            "@odata.type": GROUP,
            id: "3",
            displayName: "SG-App-Dept-Marketing",
          },
        ],
      },
    });

    const names = await serviceWith(graph).listTransitiveGroupNames("graph-1");

    expect(names).toEqual(["SG-App-Campus-Oslo", "SG-App-Dept-Marketing"]);
    expect(graph.api.mock.calls.map(([path]) => path)).toEqual([
      "/users/graph-1/transitiveMemberOf",
      next,
    ]);
    expect(graph.selects).toEqual(["id,displayName"]);
  });

  test("fails when a group comes back without its name", async () => {
    // What Graph answers when the app can read users but not groups: 200 OK,
    // each group with only @odata.type and id.
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": {
        value: [
          { "@odata.type": GROUP, id: "1", displayName: "SG-App-Campus-Oslo" },
          { "@odata.type": GROUP, id: "group-2", displayName: null },
        ],
      },
    });

    const result = serviceWith(graph).listTransitiveGroupNames("graph-1");

    await expect(result).rejects.toThrow("group-2");
    await expect(result).rejects.toThrow("GroupMember.Read.All");
  });

  test("fails when an unnamed object has no type", async () => {
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": {
        value: [{ id: "x", displayName: null }],
      },
    });

    await expect(
      serviceWith(graph).listTransitiveGroupNames("graph-1")
    ).rejects.toThrow("Directory.Read.All");
  });

  test("fails when an unnamed group is on a later page", async () => {
    const next = "https://graph.microsoft.com/v1.0/page-2";
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": {
        value: [
          { "@odata.type": GROUP, id: "1", displayName: "SG-App-Campus-Oslo" },
        ],
        "@odata.nextLink": next,
      },
      [next]: { value: [{ "@odata.type": GROUP, id: "2" }] },
    });

    await expect(
      serviceWith(graph).listTransitiveGroupNames("graph-1")
    ).rejects.toThrow("GroupMember.Read.All");
  });

  test("encodes the user id in the path", async () => {
    const graph = fakeGraph({
      "/users/a%2Fb/transitiveMemberOf": { value: [] },
    });

    await expect(
      serviceWith(graph).listTransitiveGroupNames("a/b")
    ).resolves.toEqual([]);
  });

  test("surfaces a Graph failure, normalized", async () => {
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": Object.assign(
        new Error("Resource 'graph-1' does not exist"),
        { statusCode: 404 }
      ),
    });

    await expect(
      serviceWith(graph).listTransitiveGroupNames("graph-1")
    ).rejects.toThrow("Microsoft Graph resource was not found.");
  });

  test("fails on a later page instead of returning a partial list", async () => {
    const next = "https://graph.microsoft.com/v1.0/next-page";
    const graph = fakeGraph({
      "/users/graph-1/transitiveMemberOf": {
        value: [{ id: "1", displayName: "SG-App-Campus-Oslo" }],
        "@odata.nextLink": next,
      },
      [next]: Object.assign(new Error("Service unavailable"), {
        statusCode: 503,
      }),
    });

    await expect(
      serviceWith(graph).listTransitiveGroupNames("graph-1")
    ).rejects.toThrow("Service unavailable");
  });
});
