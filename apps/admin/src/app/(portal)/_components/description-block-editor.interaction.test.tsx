import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import type { InlineMediaUpload } from "@/lib/inline-media";
import {
  findButton,
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
} from "@/test/react-dom-harness";
import {
  DescriptionBlockEditor,
  type DescriptionBlockEditorProps,
} from "./description-block-editor";

type UploadMedia = (file: File) => Promise<InlineMediaUpload>;

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement | null = null;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  container = null;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

async function renderEditor(
  props: DescriptionBlockEditorProps & { uploadMedia: UploadMedia }
): Promise<TestElement> {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(createElement(DescriptionBlockEditor, props));
  });
  return container;
}

function selectFile(containerElement: TestElement, file: File): void {
  const input = findByAriaLabel(containerElement, "Upload media");
  input.files = [file];
  input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}

const uploadedFile = (
  overrides: Partial<InlineMediaUpload> = {}
): InlineMediaUpload => ({
  fileId: "guide-1",
  fileName: "guide.pdf",
  mediaKind: "file",
  mimeType: "application/pdf",
  size: 5,
  url: "https://appwrite.biso.no/guide.pdf",
  ...overrides,
});

test("selecting a file commits the successful upload", async () => {
  const upload = deferred<InlineMediaUpload>();
  const changes: string[] = [];
  const editor = await renderEditor({
    onChange: (value) => changes.push(value),
    uploadMedia: (file) =>
      file.name === "guide.pdf" && file.type === "application/pdf"
        ? upload.promise
        : Promise.reject(new Error("Wrong selected file")),
    value: "<p>Before</p>",
  });

  await act(async () => findButton(editor, "Media").click());
  await act(async () => {
    selectFile(
      editor,
      new File(["guide"], "guide.pdf", { type: "application/pdf" })
    );
    await Promise.resolve();
  });
  expect(changes).toHaveLength(0);

  await act(async () => {
    upload.resolve(uploadedFile());
    await upload.promise;
  });

  expect(changes).toHaveLength(1);
  expect(changes[0]).toContain('data-file-id="guide-1"');
  expect(changes[0]).toContain("<p>Before</p><figure");
});

test("a failed selection preserves blocks and shows its error", async () => {
  const upload = deferred<InlineMediaUpload>();
  const changes: string[] = [];
  const editor = await renderEditor({
    onChange: (value) => changes.push(value),
    uploadMedia: (file) =>
      file.name === "bad.pdf"
        ? upload.promise
        : Promise.reject(new Error("Wrong failed file")),
    value: "<p>Unchanged</p>",
  });

  await act(async () => findButton(editor, "Media").click());
  await act(async () => {
    selectFile(
      editor,
      new File(["bad"], "bad.pdf", { type: "application/pdf" })
    );
    upload.reject(new Error("Upload rejected"));
    await upload.promise.catch(() => undefined);
  });

  expect(changes).toHaveLength(0);
  const alert = findElements(
    editor,
    (element) => element.getAttribute("role") === "alert"
  )[0];
  expect(alert?.textContent).toBe("Upload rejected");
});

test("replace targets only the selected media block", async () => {
  const upload = deferred<InlineMediaUpload>();
  const changes: string[] = [];
  const editor = await renderEditor({
    onChange: (value) => changes.push(value),
    uploadMedia: (file) =>
      file.name === "new.pdf"
        ? upload.promise
        : Promise.reject(new Error("Wrong replacement file")),
    value:
      '<figure data-media-kind="file" data-url="https://appwrite.biso.no/first.pdf" data-file-id="first" data-file-name="first.pdf" data-mime-type="application/pdf" data-alt="" data-caption="Keep caption"></figure><figure data-media-kind="file" data-url="https://appwrite.biso.no/second.pdf" data-file-id="second" data-file-name="second.pdf" data-mime-type="application/pdf" data-alt="" data-caption="Second"></figure>',
  });
  const firstReplace = findElements(
    editor,
    (element) =>
      element.tagName === "BUTTON" && element.textContent === "Replace"
  )[0];
  if (!firstReplace) {
    throw new Error("First replace button not found");
  }

  await act(async () => firstReplace.click());
  await act(async () => {
    selectFile(
      editor,
      new File(["new"], "new.pdf", { type: "application/pdf" })
    );
    upload.resolve(
      uploadedFile({
        fileId: "replacement",
        fileName: "new.pdf",
        url: "https://appwrite.biso.no/new.pdf",
      })
    );
    await upload.promise;
  });

  expect(changes).toHaveLength(1);
  expect(changes[0]).toContain('data-file-id="replacement"');
  expect(changes[0]).toContain('data-caption="Keep caption"');
  expect(changes[0]).toContain('data-file-id="second"');
  expect(changes[0]).not.toContain('data-file-id="first"');
});

test("a completion from a stale controlled value does not commit", async () => {
  const upload = deferred<InlineMediaUpload>();
  const changes: string[] = [];
  const uploadMedia: UploadMedia = () => upload.promise;
  const editor = await renderEditor({
    onChange: (value) => changes.push(value),
    placeholder: "English body",
    uploadMedia,
    value: "<p>English</p>",
  });

  await act(async () => findButton(editor, "Media").click());
  await act(async () => {
    selectFile(
      editor,
      new File(["late"], "late.pdf", { type: "application/pdf" })
    );
    await Promise.resolve();
  });
  await act(() => {
    root?.render(
      createElement(DescriptionBlockEditor, {
        onChange: (value) => changes.push(value),
        placeholder: "Norwegian body",
        uploadMedia,
        value: "<p>Norwegian</p>",
      })
    );
  });
  await act(async () => {
    upload.resolve(uploadedFile({ fileId: "late" }));
    await upload.promise;
  });

  expect(changes).toHaveLength(0);
  expect(editor.textContent).not.toContain("guide.pdf");
});

test("the keyboard reorder control commits media in its new order", async () => {
  const changes: string[] = [];
  const editor = await renderEditor({
    onChange: (value) => changes.push(value),
    uploadMedia: () => Promise.resolve(uploadedFile()),
    value:
      '<figure data-media-kind="file" data-url="https://appwrite.biso.no/first.pdf" data-file-id="first" data-file-name="first.pdf" data-mime-type="application/pdf" data-alt="" data-caption="First"></figure><figure data-media-kind="file" data-url="https://appwrite.biso.no/second.pdf" data-file-id="second" data-file-name="second.pdf" data-mime-type="application/pdf" data-alt="" data-caption="Second"></figure>',
  });

  const moveDown = findByAriaLabel(editor, "Move media block down");
  expect(moveDown.tagName).toBe("BUTTON");
  const enter = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(enter, "key", { value: "Enter" });
  await act(async () => moveDown.dispatchEvent(enter));

  expect(changes).toHaveLength(1);
  expect(changes[0]?.indexOf('data-file-id="second"')).toBeLessThan(
    changes[0]?.indexOf('data-file-id="first"') ?? -1
  );
});
