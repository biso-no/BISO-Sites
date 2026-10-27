import { expect, test } from "bun:test";
import { allBlocks } from "@/blocks/registry";
import { BLOCK_TYPES, pageEditorTools } from "./index";

const HEX = /#[0-9a-f]{6}/i;

const execute = (name: keyof typeof pageEditorTools, input: unknown) =>
  (
    pageEditorTools[name] as unknown as {
      execute: (i: unknown) => unknown;
    }
  ).execute(input);

const enumOf = (name: keyof typeof pageEditorTools): readonly string[] => {
  const schema = pageEditorTools[name].inputSchema as unknown as {
    shape: { type: { options: readonly string[] } };
  };
  return schema.shape.type.options;
};

test("the insert_block enum equals the registry keys", () => {
  const keys = allBlocks().map((def) => def.type);
  expect([...enumOf("insert_block")].sort()).toEqual([...keys].sort());
  expect([...BLOCK_TYPES].sort()).toEqual([...keys].sort());
});

test("insert_section is a tool with column presets", () => {
  expect(pageEditorTools.insert_section).toBeDefined();
});

test("bind_collection says source is a department id", () => {
  const { description, inputSchema } =
    pageEditorTools.bind_collection as unknown as {
      description: string;
      inputSchema: { shape: { source: { description: string } } };
    };
  expect(`${description} ${inputSchema.shape.source.description}`).toContain(
    "department"
  );
  expect(inputSchema.shape.source.description).not.toContain("collection ID");
});

test("set_theme refuses a failing theme with the colour, ratio and suggestion", () => {
  const result = execute("set_theme", {
    accent: "#3aa3e1",
    dark: "#9b5de5",
  }) as { message: string; status: string };
  expect(result.status).toBe("error");
  expect(result.message).toContain("dark");
  expect(result.message).toMatch(HEX);
});

test("set_theme accepts a passing theme and a reset", () => {
  expect(
    (
      execute("set_theme", { accent: "#3aa3e1", dark: "#001a35" }) as {
        status: string;
      }
    ).status
  ).toBe("applied");
  expect(
    (execute("set_theme", { reset: true }) as { status: string }).status
  ).toBe("applied");
});
