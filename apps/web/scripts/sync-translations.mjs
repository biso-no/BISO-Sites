#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const MESSAGES_DIR = path.join(PROJECT_ROOT, 'messages');
const REPORT_PATH = path.join(MESSAGES_DIR, 'report.json');
const LOCALES = ['en', 'no'];
const UNUSED_FILE = 'unused.json';
const COMMENT_KEY = '__comment';

async function collectFiles(rootDir) {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, {withFileTypes: true});
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }
  await walk(rootDir);
  return files;
}

function extractTranslations(content) {
  const translators = new Map();
  const translatorRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*useTranslations\(\s*['"]([^'"\\]+)['"]\s*\)/g;
  let match;
  while ((match = translatorRegex.exec(content)) !== null) {
    translators.set(match[1], match[2]);
  }

  const usedKeys = new Map();
  for (const [identifier, namespace] of translators.entries()) {
    const keyRegex = new RegExp(`${identifier}\\(\\s*['"]([^'"\\\\]+)['"]`, 'g');
    let keyMatch;
    while ((keyMatch = keyRegex.exec(content)) !== null) {
      if (!usedKeys.has(namespace)) {
        usedKeys.set(namespace, new Set());
      }
      usedKeys.get(namespace).add(keyMatch[1]);
    }
  }

  const rawStrings = [];
  const jsxTextRegex = />\s*([^<{][^<]*?)\s*<\//g;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].replace(/\s+/g, ' ').trim();
    if (text && /[A-Za-zÅÄÖÆØåäöæø]/.test(text)) {
      rawStrings.push(text);
    }
  }

  const attrRegex = /(alt|title|placeholder|aria-label|aria-labelledby|aria-describedby|aria-live|aria-role|label|tooltip)\s*=\s*["']([^"']*[A-Za-zÅÄÖÆØåäöæø][^"']*)["']/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const text = match[2].replace(/\s+/g, ' ').trim();
    if (text) {
      rawStrings.push(text);
    }
  }

  return {usedKeys, rawStrings};
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function ensureNested(target, segments) {
  let current = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!(segment in current) || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment];
  }
  return current;
}

function setValue(target, keyPath, value) {
  const segments = keyPath.split('.');
  const parent = ensureNested(target, segments);
  parent[segments.at(-1)] = value;
}

function getValue(target, keyPath) {
  const segments = keyPath.split('.');
  let current = target;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function deleteValue(target, keyPath) {
  const segments = keyPath.split('.');
  const parents = [];
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return false;
    }
    parents.push({parent: current, key: segment});
    current = current[segment];
  }
  const lastKey = segments.at(-1);
  if (!current || typeof current !== 'object' || !(lastKey in current)) {
    return false;
  }
  delete current[lastKey];
  for (let i = parents.length - 1; i >= 0; i -= 1) {
    const {parent, key} = parents[i];
    if (parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key]) && Object.keys(parent[key]).length === 0) {
      delete parent[key];
    }
  }
  return true;
}

function flatten(obj, prefix = '') {
  const result = new Map();
  if (!obj || typeof obj !== 'object') return result;
  for (const [key, value] of Object.entries(obj)) {
    if (key === COMMENT_KEY) continue;
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of flatten(value, next)) {
        result.set(nestedKey, nestedValue);
      }
    } else {
      result.set(next, value);
    }
  }
  return result;
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    const keys = Object.keys(value).sort((a, b) => {
      if (a === COMMENT_KEY) return -1;
      if (b === COMMENT_KEY) return 1;
      return a.localeCompare(b);
    });
    for (const key of keys) {
      sorted[key] = sortObject(value[key]);
    }
    return sorted;
  }
  return value;
}

async function writeJson(filePath, data) {
  const sorted = sortObject(data);
  await fs.writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

async function collectNamespaces() {
  const entries = await fs.readdir(path.join(MESSAGES_DIR, 'en'));
  return entries
    .filter((entry) => entry.endsWith('.json') && entry !== UNUSED_FILE)
    .map((entry) => entry.replace(/\.json$/, ''))
    .sort();
}

async function syncMessages(usage) {
  const namespaces = await collectNamespaces();
  const added = new Map();
  const unused = new Map();
  const coverage = new Map();

  for (const namespace of namespaces) {
    const usedKeys = usage.usedKeys.get(namespace) ?? new Set();

    const localeData = new Map();
    const unusedData = new Map();

    for (const locale of LOCALES) {
      const basePath = path.join(MESSAGES_DIR, locale, `${namespace}.json`);
      const unusedPath = path.join(MESSAGES_DIR, locale, UNUSED_FILE);
      const data = await readJson(basePath);
      const unusedContent = await readJson(unusedPath);
      localeData.set(locale, {path: basePath, data});
      unusedData.set(locale, {path: unusedPath, data: unusedContent});
    }

    const addedList = [];
    const unusedList = [];

    for (const key of usedKeys) {
      for (const locale of LOCALES) {
        const {data} = localeData.get(locale);
        const {data: unusedContent} = unusedData.get(locale);
        const fromUnused = getValue(unusedContent, key);
        if (fromUnused !== undefined) {
          setValue(data, key, fromUnused);
          deleteValue(unusedContent, key);
        }
        if (getValue(data, key) === undefined) {
          const englishValue = getValue(localeData.get('en').data, key) ?? key;
          let valueToUse = englishValue;
          if (locale !== 'en') {
            valueToUse = `TODO: ${englishValue}`;
          } else if (englishValue === key) {
            valueToUse = `TODO: ${key}`;
          }
          setValue(data, key, valueToUse);
          addedList.push(`${locale}:${namespace}.${key}`);
        }
      }
    }

    const englishMap = flatten(localeData.get('en').data);
    for (const key of englishMap.keys()) {
      if (!usedKeys.has(key)) {
        unusedList.push(`${namespace}.${key}`);
        for (const locale of LOCALES) {
          const {data} = localeData.get(locale);
          const {data: unusedContent} = unusedData.get(locale);
          const value = getValue(data, key);
          if (value !== undefined) {
            setValue(unusedContent, key, value);
            deleteValue(data, key);
          }
        }
      }
    }

    for (const locale of LOCALES) {
      const {path: basePath, data} = localeData.get(locale);
      await writeJson(basePath, data);
      const {path: unusedPath, data: unusedContent} = unusedData.get(locale);
      if (Object.keys(unusedContent).length === 0) {
        unusedContent[COMMENT_KEY] = locale === 'en'
          ? 'Unused keys retained for review.'
          : 'Ubrukte nøkler beholdt for gjennomgang.';
      }
      await writeJson(unusedPath, unusedContent);
    }

    const totals = {};
    for (const locale of LOCALES) {
      const flattened = flatten(localeData.get(locale).data);
      let translated = 0;
      for (const key of usedKeys) {
        const value = flattened.get(key);
        if (value && typeof value === 'string' && !value.startsWith('TODO:')) {
          translated += 1;
        }
      }
      totals[locale] = {translated};
    }

    for (const [locale, info] of Object.entries(totals)) {
      if (!coverage.has(locale)) {
        coverage.set(locale, {total: 0, translated: 0});
      }
      coverage.get(locale).total += usedKeys.size;
      coverage.get(locale).translated += info.translated;
    }

    if (addedList.length) {
      added.set(namespace, addedList.sort());
    }
    if (unusedList.length) {
      unused.set(namespace, unusedList.sort());
    }
  }

  const coverageSummary = {};
  for (const [locale, {total, translated}] of coverage.entries()) {
    const ratio = total === 0 ? 1 : translated / total;
    coverageSummary[locale] = {
      total,
      translated,
      coverage: Number(ratio.toFixed(3)),
    };
  }

  return {added, unused, coverage: coverageSummary};
}

async function main() {
  const files = await collectFiles(SRC_DIR);
  const usage = {usedKeys: new Map(), rawStrings: []};

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const {usedKeys, rawStrings} = extractTranslations(content);
    for (const [namespace, keys] of usedKeys.entries()) {
      if (!usage.usedKeys.has(namespace)) {
        usage.usedKeys.set(namespace, new Set());
      }
      for (const key of keys) {
        usage.usedKeys.get(namespace).add(key);
      }
    }
    usage.rawStrings.push(...rawStrings.map((text) => ({file: path.relative(PROJECT_ROOT, filePath), text})));
  }

  const result = await syncMessages(usage);

  const report = {
    generatedAt: new Date().toISOString(),
    addedKeys: Object.fromEntries([...result.added.entries()]),
    unusedKeys: Object.fromEntries([...result.unused.entries()]),
    coverage: result.coverage,
    rawStrings: usage.rawStrings,
  };

  await writeJson(REPORT_PATH, report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
