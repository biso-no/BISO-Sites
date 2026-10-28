import { readFile } from "node:fs/promises";
import { z } from "zod";
import { PrivateSourceUnavailable, type PrivateValueSource } from "./source";

const fileSchema = z.record(z.string(), z.string());

export function createFakeSource(filePath?: string): PrivateValueSource {
  return {
    async get(names) {
      if (!filePath) {
        throw new PrivateSourceUnavailable();
      }
      let data: Record<string, string>;
      try {
        data = fileSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
      } catch {
        throw new PrivateSourceUnavailable();
      }
      const out: Record<string, string | undefined> = {};
      for (const name of names) {
        out[name] = Object.hasOwn(data, name) ? data[name] : undefined;
      }
      return out;
    },
  };
}
