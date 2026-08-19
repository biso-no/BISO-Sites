import { describe, expect, test } from "bun:test";
import { mirrorImage } from "./media";

const pngResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "image/jpeg" },
    status: 200,
  });

describe("mirrorImage", () => {
  test("uploads the image and returns the new file id", async () => {
    const cache = new Map<string, string>();
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
    const cache = new Map<string, string>();
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
