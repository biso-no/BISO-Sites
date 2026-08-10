import { expect, test } from "bun:test";
import { INLINE_MEDIA_MAX_BYTES } from "@/lib/inline-media";
import { handleInlineMediaUpload, type InlineMediaUploadInput } from "./route";

test("rejects an unauthenticated upload before reading or storing it", async () => {
  let bodyReads = 0;
  let createCalls = 0;
  const request = new Request("http://admin.test/api/media/upload", {
    body: new Blob(["photo"], { type: "image/jpeg" }),
    headers: { "content-type": "image/jpeg", "x-filename": "photo.jpg" },
    method: "POST",
  });
  Object.defineProperty(request, "blob", {
    value: () => {
      bodyReads += 1;
      return Promise.resolve(new Blob(["photo"], { type: "image/jpeg" }));
    },
  });

  const response = await handleInlineMediaUpload(request, {
    authenticate: () => Promise.resolve(false),
    createFile: () => {
      createCalls += 1;
      return Promise.resolve({ fileId: "unexpected" });
    },
  });

  expect(response.status).toBe(401);
  expect(bodyReads).toBe(0);
  expect(createCalls).toBe(0);
});

test("rejects an extension and MIME mismatch before storage", async () => {
  let createCalls = 0;
  const response = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob(["script"], { type: "application/javascript" }),
      headers: {
        "content-type": "application/javascript",
        "x-filename": "photo.jpg",
      },
      method: "POST",
    }),
    {
      authenticate: () => Promise.resolve(true),
      createFile: () => {
        createCalls += 1;
        return Promise.resolve({ fileId: "unexpected" });
      },
    }
  );

  expect(response.status).toBe(415);
  expect(createCalls).toBe(0);
});

test("rejects an oversized content length before reading the body", async () => {
  let bodyReads = 0;
  const request = new Request("http://admin.test/api/media/upload", {
    body: new Blob(["photo"], { type: "image/jpeg" }),
    headers: {
      "content-length": String(INLINE_MEDIA_MAX_BYTES + 1),
      "content-type": "image/jpeg",
      "x-filename": "photo.jpg",
    },
    method: "POST",
  });
  Object.defineProperty(request, "blob", {
    value: () => {
      bodyReads += 1;
      return Promise.resolve(new Blob(["photo"], { type: "image/jpeg" }));
    },
  });

  const response = await handleInlineMediaUpload(request, {
    authenticate: () => Promise.resolve(true),
    createFile: () => Promise.resolve(new Response(null, { status: 201 })),
  });

  expect(response.status).toBe(413);
  expect(bodyReads).toBe(0);
  expect(await response.json()).toEqual({
    error: "File too large (max 10 MB)",
  });
});

test("rejects empty and actually oversized request bodies", async () => {
  const dependencies = {
    authenticate: () => Promise.resolve(true),
    createFile: () => Promise.resolve(new Response(null, { status: 201 })),
  };
  const emptyResponse = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob([], { type: "application/pdf" }),
      headers: {
        "content-type": "application/pdf",
        "x-filename": "guide.pdf",
      },
      method: "POST",
    }),
    dependencies
  );
  const oversizedResponse = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob([new Uint8Array(INLINE_MEDIA_MAX_BYTES + 1)], {
        type: "image/png",
      }),
      headers: { "content-type": "image/png", "x-filename": "photo.png" },
      method: "POST",
    }),
    dependencies
  );

  expect(emptyResponse.status).toBe(400);
  expect(await emptyResponse.json()).toEqual({ error: "Empty upload" });
  expect(oversizedResponse.status).toBe(413);
});

test("stores a validated upload and returns the storage response", async () => {
  let createdInput: InlineMediaUploadInput | undefined;
  const response = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob(["photo"], { type: "image/jpeg" }),
      headers: {
        "content-type": "image/jpeg",
        "x-filename": encodeURIComponent("Board photo.JPG"),
      },
      method: "POST",
    }),
    {
      authenticate: () => Promise.resolve(true),
      createFile: (input: InlineMediaUploadInput) => {
        createdInput = input;
        return Promise.resolve(
          Response.json({
            file: {
              fileId: "file-1",
              fileName: input.fileName,
              mediaKind: input.mediaKind,
              mimeType: input.mimeType,
              size: input.size,
              url: "https://cloud.appwrite.test/file-1",
            },
          })
        );
      },
    }
  );

  expect(response.status).toBe(200);
  expect(createdInput).toMatchObject({
    fileName: "Board_photo.JPG",
    mediaKind: "image",
    mimeType: "image/jpeg",
    size: 5,
  });
  expect(createdInput?.bytes.toString()).toBe("photo");
  expect(await response.json()).toEqual({
    file: {
      fileId: "file-1",
      fileName: "Board_photo.JPG",
      mediaKind: "image",
      mimeType: "image/jpeg",
      size: 5,
      url: "https://cloud.appwrite.test/file-1",
    },
  });
});

test("rejects malformed encoded filenames before storage", async () => {
  let createCalls = 0;
  const response = await handleInlineMediaUpload(
    new Request("http://admin.test/api/media/upload", {
      body: new Blob(["photo"], { type: "image/jpeg" }),
      headers: { "content-type": "image/jpeg", "x-filename": "%E0%A4%A" },
      method: "POST",
    }),
    {
      authenticate: () => Promise.resolve(true),
      createFile: () => {
        createCalls += 1;
        return Promise.resolve(new Response(null, { status: 201 }));
      },
    }
  );

  expect(response.status).toBe(415);
  expect(createCalls).toBe(0);
});
