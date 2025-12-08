#!/usr/bin/env bun
/**
 * Theme Color Migration Script
 *
 * This script migrates hardcoded Tailwind color classes to semantic theme tokens.
 * It uses context-aware detection to choose the correct replacement.
 *
 * Usage: bun run scripts/migrate-theme-colors.ts [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Preview changes without writing files
 *   --verbose   Show detailed replacement information
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join, relative } from "path";

const args = Bun.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");

// Target directory - relative to repo root
const REPO_ROOT = join(import.meta.dir, "..");
const TARGET_DIR = join(REPO_ROOT, "apps/web/src");

// Files to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /styles\.css$/, // Don't modify the CSS file itself
];

// Track statistics
const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
  byType: {} as Record<string, number>,
};

/**
 * Replacement rules with context detection
 * Order matters - more specific patterns should come first
 */
const REPLACEMENT_RULES: Array<{
  pattern: RegExp;
  replacement: string | ((match: string, context: string) => string | null);
  description: string;
  skipInContext?: RegExp[];
}> = [
  // ============================================
  // BACKGROUND COLORS
  // ============================================
  // NOTE: Order matters! More specific (longer) patterns must come FIRST

  // Section backgrounds with gradients (must come before standalone bg-white)
  {
    pattern: /\bfrom-gray-50\s+to-white\b/g,
    replacement: "from-section to-background",
    description: "from-gray-50 to-white → from-section to-background",
  },
  {
    pattern: /\bfrom-white\s+to-gray-50\b/g,
    replacement: "from-background to-section",
    description: "from-white to-gray-50 → from-background to-section",
  },
  {
    pattern: /\bbg-linear-to-b\s+from-gray-50\s+to-white\b/g,
    replacement: "bg-linear-to-b from-section to-background",
    description: "gradient gray-50 to white → section to background",
  },
  {
    pattern: /\bbg-linear-to-b\s+from-white\s+to-gray-50\b/g,
    replacement: "bg-linear-to-b from-background to-section",
    description: "gradient white to gray-50 → background to section",
  },

  // bg-white - context aware (after gradient rules)
  {
    pattern: /\bbg-white\b/g,
    replacement: (match, context) => {
      // If inside a Card className, remove bg-white entirely (Card has bg-card by default)
      // We detect this by checking if the context shows <Card with className containing bg-white
      if (/<Card[^>]*className="[^"]*bg-white/.test(context)) {
        return ""; // Remove - Card already has bg-card
      }
      return "bg-background";
    },
    description: "bg-white → bg-background (or removed in Card)",
  },

  // Standalone gray backgrounds
  {
    pattern: /\bbg-gray-50\b/g,
    replacement: "bg-section",
    description: "bg-gray-50 → bg-section",
  },
  {
    pattern: /\bbg-gray-100\b/g,
    replacement: "bg-muted",
    description: "bg-gray-100 → bg-muted",
  },
  {
    pattern: /\bbg-gray-200\b/g,
    replacement: "bg-muted",
    description: "bg-gray-200 → bg-muted",
  },

  // Footer/inverted backgrounds
  {
    pattern: /\bbg-gray-900\b/g,
    replacement: "bg-inverted",
    description: "bg-gray-900 → bg-inverted",
  },
  {
    pattern: /\bbg-gray-800\b/g,
    replacement: "bg-inverted",
    description: "bg-gray-800 → bg-inverted",
  },

  // ============================================
  // TEXT COLORS
  // ============================================

  // Primary text (headings, important text)
  {
    pattern: /\btext-gray-900\b/g,
    replacement: "text-foreground",
    description: "text-gray-900 → text-foreground",
  },
  {
    pattern: /\btext-gray-800\b/g,
    replacement: "text-foreground",
    description: "text-gray-800 → text-foreground",
  },

  // Secondary/muted text
  {
    pattern: /\btext-gray-700\b/g,
    replacement: "text-muted-foreground",
    description: "text-gray-700 → text-muted-foreground",
  },
  {
    pattern: /\btext-gray-600\b/g,
    replacement: "text-muted-foreground",
    description: "text-gray-600 → text-muted-foreground",
  },
  {
    pattern: /\btext-gray-500\b/g,
    replacement: "text-muted-foreground",
    description: "text-gray-500 → text-muted-foreground",
  },

  // text-gray-400 - context dependent
  // In dark sections (footer, bg-gray-900, bg-inverted) → text-inverted-muted
  // Otherwise → text-muted-foreground
  {
    pattern: /\btext-gray-400\b/g,
    replacement: (match, context) => {
      // Check if we're in a dark/inverted section
      const isDarkSection = /bg-gray-900|bg-gray-800|bg-inverted|footer|Footer/.test(context);
      return isDarkSection ? "text-inverted-muted" : "text-muted-foreground";
    },
    description: "text-gray-400 → text-muted-foreground (or text-inverted-muted in dark sections)",
  },
  {
    pattern: /\btext-gray-300\b/g,
    replacement: "text-muted-foreground",
    description: "text-gray-300 → text-muted-foreground",
  },

  // ============================================
  // BORDER COLORS
  // ============================================
  {
    pattern: /\bborder-gray-200\b/g,
    replacement: "border-border",
    description: "border-gray-200 → border-border",
  },
  {
    pattern: /\bborder-gray-300\b/g,
    replacement: "border-border",
    description: "border-gray-300 → border-border",
  },
  {
    pattern: /\bborder-gray-100\b/g,
    replacement: "border-border",
    description: "border-gray-100 → border-border",
  },
  {
    pattern: /\bborder-gray-800\b/g,
    replacement: "border-border",
    description: "border-gray-800 → border-border",
  },

  // ============================================
  // DIVIDE COLORS
  // ============================================
  {
    pattern: /\bdivide-gray-200\b/g,
    replacement: "divide-border",
    description: "divide-gray-200 → divide-border",
  },
  {
    pattern: /\bdivide-gray-100\b/g,
    replacement: "divide-border",
    description: "divide-gray-100 → divide-border",
  },

  // ============================================
  // RING COLORS
  // ============================================
  {
    pattern: /\bring-gray-200\b/g,
    replacement: "ring-border",
    description: "ring-gray-200 → ring-border",
  },
  {
    pattern: /\bring-gray-300\b/g,
    replacement: "ring-border",
    description: "ring-gray-300 → ring-border",
  },

  // ============================================
  // PLACEHOLDER COLORS
  // ============================================
  {
    pattern: /\bplaceholder-gray-400\b/g,
    replacement: "placeholder-muted-foreground",
    description: "placeholder-gray-400 → placeholder-muted-foreground",
  },
  {
    pattern: /\bplaceholder-gray-500\b/g,
    replacement: "placeholder-muted-foreground",
    description: "placeholder-gray-500 → placeholder-muted-foreground",
  },

  // ============================================
  // DARK MODE VARIANTS (dark: prefix)
  // These are explicit dark mode overrides that should use tokens
  // ============================================
  {
    pattern: /\bdark:text-gray-100\b/g,
    replacement: "dark:text-foreground",
    description: "dark:text-gray-100 → dark:text-foreground",
  },
  {
    pattern: /\bdark:text-gray-200\b/g,
    replacement: "dark:text-foreground",
    description: "dark:text-gray-200 → dark:text-foreground",
  },
  {
    pattern: /\bdark:text-gray-300\b/g,
    replacement: "dark:text-muted-foreground",
    description: "dark:text-gray-300 → dark:text-muted-foreground",
  },
  {
    pattern: /\bdark:text-gray-400\b/g,
    replacement: "dark:text-muted-foreground",
    description: "dark:text-gray-400 → dark:text-muted-foreground",
  },
  {
    pattern: /\bdark:bg-gray-900\b/g,
    replacement: "dark:bg-background",
    description: "dark:bg-gray-900 → dark:bg-background",
  },
  {
    pattern: /\bdark:bg-gray-800\b/g,
    replacement: "dark:bg-card",
    description: "dark:bg-gray-800 → dark:bg-card",
  },
  {
    pattern: /\bdark:bg-gray-700\b/g,
    replacement: "dark:bg-muted",
    description: "dark:bg-gray-700 → dark:bg-muted",
  },
  {
    pattern: /\bdark:border-gray-700\b/g,
    replacement: "dark:border-border",
    description: "dark:border-gray-700 → dark:border-border",
  },
  {
    pattern: /\bdark:border-gray-600\b/g,
    replacement: "dark:border-border",
    description: "dark:border-gray-600 → dark:border-border",
  },
  {
    pattern: /\bdark:from-gray-950\b/g,
    replacement: "dark:from-background",
    description: "dark:from-gray-950 → dark:from-background",
  },
  {
    pattern: /\bdark:to-gray-900\b/g,
    replacement: "dark:to-card",
    description: "dark:to-gray-900 → dark:to-card",
  },
  {
    pattern: /\bdark:from-gray-900\b/g,
    replacement: "dark:from-card",
    description: "dark:from-gray-900 → dark:from-card",
  },
  {
    pattern: /\bdark:to-gray-950\b/g,
    replacement: "dark:to-background",
    description: "dark:to-gray-950 → dark:to-background",
  },
  {
    pattern: /\bdark:via-blue-900\b/g,
    replacement: "dark:via-card",
    description: "dark:via-blue-900 → dark:via-card",
  },
  {
    pattern: /\bdark:to-indigo-900\b/g,
    replacement: "dark:to-card",
    description: "dark:to-indigo-900 → dark:to-card",
  },
  // Spinner border - keep as muted
  {
    pattern: /\bborder-gray-400\b/g,
    replacement: "border-muted-foreground",
    description: "border-gray-400 → border-muted-foreground",
  },

  // ============================================
  // HOVER STATES
  // ============================================
  {
    pattern: /\bhover:bg-gray-50\b/g,
    replacement: "hover:bg-muted",
    description: "hover:bg-gray-50 → hover:bg-muted",
  },
  {
    pattern: /\bhover:bg-gray-100\b/g,
    replacement: "hover:bg-muted",
    description: "hover:bg-gray-100 → hover:bg-muted",
  },
  {
    pattern: /\bhover:bg-white\b/g,
    replacement: "hover:bg-background",
    description: "hover:bg-white → hover:bg-background",
  },

  // ============================================
  // FOCUS STATES
  // ============================================
  {
    pattern: /\bfocus:ring-gray-200\b/g,
    replacement: "focus:ring-ring",
    description: "focus:ring-gray-200 → focus:ring-ring",
  },
  {
    pattern: /\bfocus:ring-gray-300\b/g,
    replacement: "focus:ring-ring",
    description: "focus:ring-gray-300 → focus:ring-ring",
  },

  // ============================================
  // SHADOW COLORS (less common but worth catching)
  // ============================================
  {
    pattern: /\bshadow-gray-200\b/g,
    replacement: "shadow-border",
    description: "shadow-gray-200 → shadow-border",
  },

  // ============================================
  // SPECIFIC BLUE COLORS (non-brand, should use primary)
  // ============================================
  {
    pattern: /\btext-blue-600\b/g,
    replacement: "text-primary",
    description: "text-blue-600 → text-primary",
    skipInContext: [/from-blue|to-blue|via-blue/], // Skip if part of gradient
  },
  {
    pattern: /\bborder-blue-600\b/g,
    replacement: "border-primary",
    description: "border-blue-600 → border-primary",
  },
  {
    pattern: /\bhover:bg-blue-50\b/g,
    replacement: "hover:bg-accent",
    description: "hover:bg-blue-50 → hover:bg-accent",
  },
];

/**
 * Patterns to SKIP - these are intentional and should not be changed
 * NOTE: These patterns check the CONTEXT around a match, not the match itself
 * Be careful not to make them too broad or they'll skip valid replacements
 */
const SKIP_PATTERNS_IN_CONTENT: RegExp[] = [
  // Currently empty - all patterns are handled by skipInContext on individual rules
  // Add patterns here only if they should skip ALL replacements in that context
];

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      // Skip certain directories/files
      if (SKIP_PATTERNS.some((p) => p.test(fullPath))) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

function processFile(content: string, filePath: string): { newContent: string; changes: string[] } {
  let newContent = content;
  const changes: string[] = [];
  const seenChanges = new Set<string>();

  for (const rule of REPLACEMENT_RULES) {
    // Reset the regex lastIndex for global patterns
    rule.pattern.lastIndex = 0;

    // Use replaceAll with a function to check context for each match
    newContent = newContent.replace(rule.pattern, (match, ...args) => {
      // Get the offset (second to last argument for replace callback)
      const offset = args[args.length - 2] as number;
      const fullString = args[args.length - 1] as string;

      // Get context (surrounding 200 chars)
      const contextStart = Math.max(0, offset - 100);
      const contextEnd = Math.min(fullString.length, offset + match.length + 100);
      const context = fullString.slice(contextStart, contextEnd);

      // Check if we should skip this based on context
      if (rule.skipInContext?.some((p) => p.test(context))) {
        return match; // Keep original
      }

      // Check if this is in a skip pattern
      if (SKIP_PATTERNS_IN_CONTENT.some((p) => p.test(context))) {
        return match; // Keep original
      }

      let replacement: string | null;
      if (typeof rule.replacement === "function") {
        replacement = rule.replacement(match, context);
      } else {
        replacement = rule.replacement;
      }

      if (replacement === null) {
        return match; // Keep original
      }

      // Track the change (deduplicate for summary)
      if (!seenChanges.has(rule.description)) {
        changes.push(`  ${rule.description}`);
        seenChanges.add(rule.description);
      }
      stats.replacements++;
      stats.byType[rule.description] = (stats.byType[rule.description] || 0) + 1;

      return replacement;
    });
  }

  // Clean up any double spaces created by removals
  newContent = newContent.replace(/  +/g, " ");

  return { newContent, changes };
}

async function processFiles() {
  console.log("🎨 Theme Color Migration Script");
  console.log("================================");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no files will be modified)" : "LIVE"}`);
  console.log(`Target: ${TARGET_DIR}`);
  console.log("");

  const files = await getAllFiles(TARGET_DIR);
  console.log(`Found ${files.length} files to scan\n`);

  for (const filePath of files) {
    stats.filesScanned++;
    const content = await readFile(filePath, "utf-8");
    const { newContent, changes } = processFile(content, filePath);

    if (changes.length > 0) {
      stats.filesModified++;
      const relativePath = relative(REPO_ROOT, filePath);

      if (VERBOSE || DRY_RUN) {
        console.log(`📝 ${relativePath}`);
        for (const change of changes) {
          console.log(change);
        }
        console.log("");
      }

      if (!DRY_RUN) {
        await writeFile(filePath, newContent, "utf-8");
      }
    }
  }

  // Print summary
  console.log("\n================================");
  console.log("📊 Summary");
  console.log("================================");
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Total replacements: ${stats.replacements}`);
  console.log("");

  if (Object.keys(stats.byType).length > 0) {
    console.log("Replacements by type:");
    const sorted = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted) {
      console.log(`  ${type}: ${count}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n⚠️  This was a dry run. No files were modified.");
    console.log("   Run without --dry-run to apply changes.");
  } else {
    console.log("\n✅ Migration complete!");
    console.log("   Run 'bun run dev' to verify the changes.");
  }
}

// Run the script
processFiles().catch(console.error);
