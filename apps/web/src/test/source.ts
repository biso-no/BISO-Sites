/**
 * Helpers for tests that assert on source text.
 *
 * `codeOnly` exists because assertions of the form "this file must NOT contain
 * X" match the doc comment explaining why X is absent. That has now caught two
 * tests (RD-008's scroll-trigger check, RD-009's prose check) — strip comments
 * before asserting absence.
 */
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /\/\/.*$/gm;

export function codeOnly(source: string): string {
  return source.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}
