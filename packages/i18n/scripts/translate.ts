#!/usr/bin/env bun

/**
 * JSON Translation Script
 *
 * Translates all JSON files from messages/en to messages/no.
 * Preserves the structure of nested JSON objects and handles complex translations.
 * Runs through the shared AI stack (`@repo/ai/models` + the Vercel AI SDK) so the
 * model choice stays in one place — see packages/ai/src/models.ts.
 *
 * Usage:
 *   OPENAI_API_KEY=your_key bun run translate
 *
 * Options:
 *   --dry-run    Preview translations without writing files
 *   --file=name  Translate only a specific file (e.g., --file=admin.json)
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fastModel } from "@repo/ai/models";
import { generateObject } from "ai";

// Configuration
const SOURCE_LANG = "en";
const TARGET_LANG = "no";
const SOURCE_DIR = join(import.meta.dirname, "../messages", SOURCE_LANG);
const TARGET_DIR = join(import.meta.dirname, "../messages", TARGET_LANG);

// Fail fast with a useful message; the AI SDK reads OPENAI_API_KEY itself.
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Error: OPENAI_API_KEY environment variable is required");
  console.error("Usage: OPENAI_API_KEY=your_key bun run translate");
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const fileArg = args.find((arg) => arg.startsWith("--file="));
const specificFile = fileArg ? fileArg.split("=")[1] : null;

interface TranslationStats {
  errors: number;
  filesProcessed: number;
  keysTranslated: number;
  startTime: number;
}

const stats: TranslationStats = {
  filesProcessed: 0,
  keysTranslated: 0,
  errors: 0,
  startTime: Date.now(),
};

/**
 * Translates a JSON object with the fast model tier.
 *
 * Uses `output: "no-schema"` because the shape is whatever the source file
 * happens to be — the structure is verified against the source afterwards by
 * `assertSameShape` rather than by a JSON schema.
 */
async function translateWithOpenAI(
  content: Record<string, unknown>,
  fileName: string
): Promise<Record<string, unknown>> {
  const prompt = `You are a professional Norwegian translator specializing in technical and business content.

Translate the following JSON content from English to Norwegian (Bokmål).

IMPORTANT RULES:
1. Preserve the exact JSON structure - do not change any keys
2. Only translate the VALUES, never the keys
3. Maintain any HTML tags, placeholders like {variable}, or special formatting
4. Use natural, professional Norwegian (Bokmål)
5. Keep technical terms appropriate for a business/admin context
6. For navigation and UI elements, use commonly accepted Norwegian translations
7. Return ONLY valid JSON, no explanations or markdown

Context: This is from a file named "${fileName}" in a business administration system.

English JSON to translate:
${JSON.stringify(content, null, 2)}

Norwegian (Bokmål) translation:`;

  try {
    console.log("  🤖 Sending for translation...");

    const { object } = await generateObject({
      model: fastModel,
      output: "no-schema",
      // Reasoning models reject a custom `temperature`; low effort is the
      // equivalent lever for consistent, cheap, mechanical output.
      reasoning: "low",
      instructions:
        "You are a professional translator that outputs only valid JSON. You translate from English to Norwegian (Bokmål) while preserving the exact structure and keys of the input JSON.",
      prompt,
    });

    if (
      object === null ||
      typeof object !== "object" ||
      Array.isArray(object)
    ) {
      throw new Error("Model did not return a JSON object");
    }

    const parsed = object as Record<string, unknown>;
    assertSameShape(content, parsed, fileName);

    // Count translated keys
    stats.keysTranslated += countKeys(parsed);

    console.log("  ✅ Translation completed");
    return parsed;
  } catch (error) {
    console.error("  ❌ Translation failed:", error);
    stats.errors += 1;
    throw error;
  }
}

/**
 * Collect every leaf key path in a nested object, e.g. "nav.settings.title".
 */
function collectKeyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      paths.push(...collectKeyPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

/**
 * Guard against the failure mode of asking a model to echo a whole document:
 * dropped, renamed, or invented keys. These files ship to users, so a shape
 * mismatch must abort the file rather than silently overwrite good messages.
 */
function assertSameShape(
  source: Record<string, unknown>,
  translated: Record<string, unknown>,
  fileName: string
): void {
  const sourcePaths = new Set(collectKeyPaths(source));
  const translatedPaths = new Set(collectKeyPaths(translated));

  const missing = [...sourcePaths].filter((p) => !translatedPaths.has(p));
  const added = [...translatedPaths].filter((p) => !sourcePaths.has(p));

  if (missing.length === 0 && added.length === 0) {
    return;
  }

  const details = [
    missing.length > 0
      ? `missing ${missing.length}: ${missing.slice(0, 5).join(", ")}`
      : null,
    added.length > 0
      ? `unexpected ${added.length}: ${added.slice(0, 5).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  throw new Error(
    `Translated ${fileName} does not match the source shape — ${details}`
  );
}

/**
 * Count total number of leaf keys in a nested object
 */
function countKeys(obj: Record<string, unknown>): number {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      count += countKeys(value as Record<string, unknown>);
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Process a single translation file
 */
async function translateFile(fileName: string): Promise<void> {
  console.log(`\n📄 Processing: ${fileName}`);

  try {
    // Read source file
    const sourcePath = join(SOURCE_DIR, fileName);
    const sourceContent = await readFile(sourcePath, "utf-8");
    const sourceJson = JSON.parse(sourceContent);

    console.log(`  📖 Read ${countKeys(sourceJson)} translation keys`);

    // Translate content
    const translatedJson = await translateWithOpenAI(sourceJson, fileName);

    if (isDryRun) {
      console.log(
        `  🔍 [DRY RUN] Would write to: ${join(TARGET_DIR, fileName)}`
      );
      console.log("  📝 Preview (first 500 chars):");
      console.log(
        `${JSON.stringify(translatedJson, null, 2).slice(0, 500)}...\n`
      );
    } else {
      // Ensure target directory exists
      await mkdir(TARGET_DIR, { recursive: true });

      // Write translated file
      const targetPath = join(TARGET_DIR, fileName);
      await writeFile(
        targetPath,
        `${JSON.stringify(translatedJson, null, 2)}\n`,
        "utf-8"
      );

      console.log(`  💾 Saved to: ${targetPath}`);
    }

    stats.filesProcessed += 1;
  } catch (error) {
    console.error(`  ❌ Failed to process ${fileName}:`, error);
    stats.errors += 1;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🌍 JSON Translation Script");
  console.log("━".repeat(50));
  console.log(`Source: ${SOURCE_DIR}`);
  console.log(`Target: ${TARGET_DIR}`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "WRITE FILES"}`);
  if (specificFile) {
    console.log(`File: ${specificFile} (single file mode)`);
  }
  console.log("━".repeat(50));

  try {
    // Get list of files to translate
    let files: string[];

    if (specificFile) {
      files = [specificFile];
    } else {
      const allFiles = await readdir(SOURCE_DIR);
      files = allFiles.filter((file) => file.endsWith(".json"));
    }

    console.log(`\n📚 Found ${files.length} file(s) to translate\n`);

    // Process each file sequentially to avoid rate limits
    for (const file of files) {
      await translateFile(file);

      // Add a small delay between files to avoid rate limits
      if (files.indexOf(file) < files.length - 1) {
        console.log("  ⏳ Waiting 1 second before next file...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    console.log(`\n${"━".repeat(50)}`);
    console.log("📊 Translation Summary");
    console.log("━".repeat(50));
    console.log(`✅ Files processed: ${stats.filesProcessed}/${files.length}`);
    console.log(`🔑 Keys translated: ${stats.keysTranslated}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log("━".repeat(50));

    if (isDryRun) {
      console.log("\n💡 This was a dry run. Remove --dry-run to write files.");
    } else if (stats.errors === 0) {
      console.log("\n🎉 Translation completed successfully!");
    } else {
      console.log("\n⚠️  Translation completed with errors. Check logs above.");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
main();
