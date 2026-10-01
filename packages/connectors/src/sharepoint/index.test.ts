import { beforeEach, describe, expect, mock, test } from "bun:test";

const post = mock();
const api = mock(() => ({ post }));

mock.module("server-only", () => ({}));
mock.module("@azure/msal-node", () => ({
  ConfidentialClientApplication: class {
    acquireTokenByClientCredential() {
      return Promise.resolve({ accessToken: "token" });
    }
  },
}));
mock.module("@microsoft/microsoft-graph-client", () => ({
  Client: { init: () => ({ api }) },
  ResponseType: { ARRAYBUFFER: "arraybuffer" },
}));

const { SharePointService } = await import("./index");

const service = new SharePointService({
  authority: "https://login.microsoftonline.com/tenant",
  clientId: "client",
  clientSecret: "secret",
  tenantId: "tenant",
});

beforeEach(() => {
  post.mockReset();
  api.mockClear();
});

describe("createAnonymousViewLink", () => {
  test("requests an anonymous view link and returns its URL", async () => {
    post.mockResolvedValue({
      link: { scope: "anonymous", webUrl: "https://sp.example/:b:/g/abc" },
    });

    const url = await service.createAnonymousViewLink("drive-1", "item-1");

    expect(url).toBe("https://sp.example/:b:/g/abc");
    expect(api).toHaveBeenCalledWith("/drives/drive-1/items/item-1/createLink");
    expect(post).toHaveBeenCalledWith({ scope: "anonymous", type: "view" });
  });

  test("rejects when Graph returns no link URL", async () => {
    post.mockResolvedValue({ link: {} });

    await expect(
      service.createAnonymousViewLink("drive-1", "item-1")
    ).rejects.toThrow("SharePoint did not return a sharing link");
  });

  test("propagates a Graph refusal", async () => {
    post.mockRejectedValue(new Error("sharingDisabled"));

    await expect(
      service.createAnonymousViewLink("drive-1", "item-1")
    ).rejects.toThrow("sharingDisabled");
  });
});
