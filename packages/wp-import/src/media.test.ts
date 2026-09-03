import { describe, expect, test } from "bun:test";
import { mirrorImage } from "./media";

const pngResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "image/jpeg" },
    status: 200,
  });

describe("mirrorImage", () => {
  test("uploads the image and returns the new file id", async () => {
    const cache = new Map<string, Promise<string>>();
    const fileId = await mirrorImage(
      {
        cache,
        fetchImpl: async () => pngResponse(),
        upload: async () => ({ $id: "file-1" }),
      },
      "https://biso.no/wp-content/uploads/a.jpg"
    );

    expect(fileId).toBe("file-1");
  });

  test("does not re-upload a url it has already mirrored", async () => {
    const cache = new Map<string, Promise<string>>();
    let uploads = 0;
    const deps = {
      cache,
      fetchImpl: async () => pngResponse(),
      upload: () => {
        uploads += 1;
        return Promise.resolve({ $id: "file-1" });
      },
    };

    await mirrorImage(deps, "https://biso.no/a.jpg");
    await mirrorImage(deps, "https://biso.no/a.jpg");

    expect(uploads).toBe(1);
  });

  test("throws when the source image cannot be downloaded", async () => {
    await expect(
      mirrorImage(
        {
          cache: new Map(),
          fetchImpl: async () => new Response("", { status: 404 }),
          upload: async () => ({ $id: "unused" }),
        },
        "https://biso.no/missing.jpg"
      )
    ).rejects.toThrow("404");
  });
});

describe("mirrorImage single-flight", () => {
  test("uploads once when concurrent products share an image url", async () => {
    let uploads = 0;
    const deps = {
      cache: new Map<string, Promise<string>>(),
      fetchImpl: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return pngResponse();
      },
      upload: () => {
        uploads += 1;
        return Promise.resolve({ $id: "file-1" });
      },
    };

    // Both start before either finishes — the exact race a resolved-id cache
    // cannot catch.
    const ids = await Promise.all([
      mirrorImage(deps, "https://biso.no/shared.jpg"),
      mirrorImage(deps, "https://biso.no/shared.jpg"),
    ]);

    expect(uploads).toBe(1);
    expect(ids).toEqual(["file-1", "file-1"]);
  });

  test("evicts a failed download so a later product can retry it", async () => {
    let attempts = 0;
    const deps = {
      cache: new Map<string, Promise<string>>(),
      fetchImpl: () => {
        attempts += 1;
        return Promise.resolve(
          attempts === 1 ? new Response("", { status: 500 }) : pngResponse()
        );
      },
      upload: async () => ({ $id: "file-2" }),
    };

    await expect(
      mirrorImage(deps, "https://biso.no/flaky.jpg")
    ).rejects.toThrow("500");
    expect(await mirrorImage(deps, "https://biso.no/flaky.jpg")).toBe("file-2");
  });
});
