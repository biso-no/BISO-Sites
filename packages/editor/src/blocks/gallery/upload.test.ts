import { describe, expect, test } from "bun:test";
import { uploadGalleryFiles } from "./upload";

const file = (name: string) => new File(["x"], name, { type: "image/png" });

describe("uploadGalleryFiles", () => {
  test("uploads every file in order", async () => {
    const result = await uploadGalleryFiles(
      [file("a.png"), file("b.png")],
      (fd) => {
        const name = (fd.get("file") as File).name;
        return Promise.resolve({ fileId: name, url: `https://cdn/${name}` });
      }
    );

    expect(result).toEqual({
      added: [
        { fileId: "a.png", mime: "image/png", src: "https://cdn/a.png" },
        { fileId: "b.png", mime: "image/png", src: "https://cdn/b.png" },
      ],
      error: null,
    });
  });

  test("keeps the files uploaded before a failure and reports it", async () => {
    // A throw out of the transition used to reach the editor's error
    // boundary and blank the whole editor, and the files already in the
    // bucket were lost from the page.
    const result = await uploadGalleryFiles(
      [file("a.png"), file("bad.png"), file("c.png")],
      (fd) => {
        const name = (fd.get("file") as File).name;
        if (name === "bad.png") {
          return Promise.reject(new Error("Unsupported file type"));
        }
        return Promise.resolve({ fileId: name, url: `https://cdn/${name}` });
      }
    );

    expect(result.added).toEqual([
      { fileId: "a.png", mime: "image/png", src: "https://cdn/a.png" },
    ]);
    expect(result.error).toBe("Unsupported file type");
  });

  test("a file the browser gives no type gets no mime", async () => {
    const result = await uploadGalleryFiles([new File(["x"], "a")], () =>
      Promise.resolve({ fileId: "a", url: "https://cdn/a" })
    );
    expect(result.added).toEqual([{ fileId: "a", src: "https://cdn/a" }]);
  });
});
