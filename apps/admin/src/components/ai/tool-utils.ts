export function cleanRagText(input?: string, max = 220): string {
  if (!input) return "";
  // Collapse filler dots and spaces produced by PDF table-of-contents extraction
  let t = input
    // Kill long dotted leaders and bullet filler
    .replace(/[\.·•]{2,}/g, " ")
    // Remove common TOC page numbers like '.... 12'
    .replace(/\s+\d{1,3}(?=\s|$)/g, " ")
    // Normalize headings like '## 10. 3 Oppløsning' -> '10.3 Oppløsning'
    .replace(/##+\s*/g, "")
    .replace(/(\d+)\s*\.\s*(\d+)/g, "$1.$2")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Prefer the part that contains a paragraph or section marker when present
  const para = t.match(/§\s*\d+(?:\.\d+)*/);
  if (para) {
    const idx = Math.max(0, t.lastIndexOf("§", para.index || 0));
    t = t.slice(idx);
  }

  // Prefer a short segment starting at the first sentence/paragraph marker
  const sentenceStart = t.search(/[A-ZÆØÅÄÖ][^.!?]{2,}[.!?]/);
  if (sentenceStart > 0 && sentenceStart < 80) {
    t = t.slice(sentenceStart);
  }

  // Truncate nicely
  if (t.length > max) {
    t = t.slice(0, max - 1).trimEnd() + "…";
  }
  return t;
}

export function summarizeSharePointResults(result: any, limit = 2) {
  const results: Array<{ title?: string; documentViewerUrl?: string; site?: string; lastModified?: string; text?: string }> =
    Array.isArray(result?.results) ? result.results : [];
  return results.slice(0, limit).map((r) => ({
    title: r.title || "Document",
    href: r.documentViewerUrl,
    site: r.site,
    lastModified: r.lastModified,
    snippet: cleanRagText(r.text),
  }));
}

export function summarizeSiteResults(result: any, limit = 3) {
  const results: Array<{ title?: string; href?: string; description?: string; index?: string }> =
    Array.isArray(result?.results) ? result.results : [];
  return results.slice(0, limit).map((r) => ({
    title: r.title || "Result",
    href: r.href,
    index: r.index,
    snippet: r.description ? cleanRagText(r.description, 200) : undefined,
  }));
}
