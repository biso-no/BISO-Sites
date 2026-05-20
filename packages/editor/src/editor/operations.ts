// Pure document mutations. Every UI action and AI tool call goes through here.
// Takes an immer draft of PageDoc (or a WritableDraft via zustand/immer).

import type { Block, BlockType, PageDoc, PageMeta } from "./types";

function rid(): string {
  return "b-" + Math.random().toString(36).slice(2, 8);
}

export function emptyBlock(type: BlockType): Block {
  const id = rid();
  switch (type) {
    case "hero":     return { id, type, variant: "split", eyebrow: "Eyebrow", title: "A headline that earns the size.", subtitle: "One sentence about what your unit does.", ctaLabel: "Get involved", ctaUrl: "#", imageAlt: "" };
    case "stats":    return { id, type, items: [{ num: "1", label: "Thing" }, { num: "2", label: "Other" }, { num: "3", label: "More" }] };
    case "text":     return { id, type, body: [{ type: "h", text: "Section heading" }, { type: "p", text: "Tell the story like you'd tell a friend." }] };
    case "quote":    return { id, type, text: "Drop a line worth standing on its own.", author: "Someone", role: "Their role" };
    case "team":     return { id, type, heading: "The team", members: [{ name: "Name", role: "Role", initials: "NN", hue: "claret" }] };
    case "events":   return { id, type, heading: "Coming up", source: "auto", items: [{ date: "Soon", title: "Event title", where: "Where", going: 0 }] };
    case "faq":      return { id, type, heading: "Questions", items: [{ q: "A question", a: "An answer." }] };
    case "contact":  return { id, type, heading: "Find us", email: "team@biso.no", instagram: "@biso", address: "Campus", hours: "Mon–Fri" };
    case "callout":  return { id, type, tone: "info", title: "Heads up", body: "Something worth flagging." };
    case "image":    return { id, type, caption: "", aspect: "16/9" };
    case "gallery":  return { id, type, images: [] };
    case "video":    return { id, type, caption: "" };
    case "cta":      return { id, type, title: "Ready to jump in?", label: "Join the unit", url: "#" };
    case "marquee":  return { id, type, text: "Tuesdays · Tromsø · Glögg · Buddies · Welcome week" };
    case "timeline": return { id, type, heading: "Our story", items: [{ year: "2024", text: "Founded." }] };
    case "twoCol":   return { id, type, left: "Left column copy.", right: "Right column copy." };
    case "signup":   return { id, type, heading: "Stay in the loop", placeholder: "you@bi.no" };
    case "news":     return { id, type, heading: "Latest news" };
    case "jobs":     return { id, type, heading: "Open roles" };
    case "featureGrid": return { id, type, heading: "What we offer", columns: 3, variant: "cards", items: [
      { icon: "★", title: "Feature one", body: "Describe this benefit in one sentence." },
      { icon: "◆", title: "Feature two", body: "Describe this benefit in one sentence." },
      { icon: "●", title: "Feature three", body: "Describe this benefit in one sentence." },
    ] };
    case "partners": return { id, type, heading: "Our partners", source: "auto" };
    case "linkTileGrid": return { id, type, heading: "Explore", items: [
      { icon: "→", title: "Page one", description: "Short description.", href: "#" },
      { icon: "→", title: "Page two", description: "Short description.", href: "#" },
      { icon: "→", title: "Page three", description: "Short description.", href: "#" },
    ] };
    case "tabs": return { id, type, variant: "underline", tabs: [
      { label: "Overview", body: "Overview content goes here." },
      { label: "Details", body: "Detailed content goes here." },
    ] };
    case "departmentGrid": return { id, type, heading: "Departments", layout: "grid", showFilters: true };
    case "documents": return { id, type, heading: "Documents", items: [] };
    case "featuredCards": return { id, type, heading: "Featured", items: [
      { title: "Project one", body: "Short description.", stripeAccent: "var(--claret)", eyebrow: "Featured" },
      { title: "Project two", body: "Short description.", stripeAccent: "var(--leaf)" },
    ] };
    case "campusSelector": return { id, type, mode: "cards", heading: "Choose your campus" };
    case "stepGrid": return { id, type, heading: "How it works", items: [
      { number: "01", title: "First step", body: "Describe the first step." },
      { number: "02", title: "Second step", body: "Describe the second step." },
      { number: "03", title: "Third step", body: "Describe the third step." },
    ] };
    case "scrollRow": return { id, type, heading: "Benefits", items: [
      { icon: "★", title: "Benefit one", body: "Short description." },
      { icon: "◆", title: "Benefit two", body: "Short description." },
      { icon: "●", title: "Benefit three", body: "Short description." },
      { icon: "▲", title: "Benefit four", body: "Short description." },
    ] };
    case "productGrid": return { id, type, heading: "Shop", source: "auto" };
    case "filterBar": return { id, type, target: "news" };
    case "profileHeader": return { id, type, heading: "My BISO", showAvatar: true, showStats: true };
    case "multiStepForm": return { id, type, heading: "Get in touch", submitTarget: { collection: "submissions" }, steps: [
      { title: "Your message", fields: [
        { name: "name", label: "Name", fieldType: "text", required: true },
        { name: "email", label: "Email", fieldType: "email", required: true },
        { name: "message", label: "Message", fieldType: "textarea", required: true },
      ] },
    ] };
  }
}

/** Insert a new block after `afterId`, or at end if not provided. */
export function insertBlock(doc: PageDoc, type: BlockType, afterId?: string): string {
  const block = emptyBlock(type);
  const idx = afterId
    ? doc.blocks.findIndex((b) => b.id === afterId) + 1
    : doc.blocks.length;
  doc.blocks.splice(idx < 0 ? doc.blocks.length : idx, 0, block);
  return block.id;
}

/** Remove a block by id. */
export function removeBlock(doc: PageDoc, id: string): void {
  const idx = doc.blocks.findIndex((b) => b.id === id);
  if (idx !== -1) doc.blocks.splice(idx, 1);
}

/** Duplicate a block, inserting the copy immediately after. Returns new id. */
export function duplicateBlock(doc: PageDoc, id: string): string | null {
  const src = doc.blocks.find((b) => b.id === id);
  if (!src) return null;
  const copy = { ...(JSON.parse(JSON.stringify(src)) as Block), id: rid() };
  const idx = doc.blocks.findIndex((b) => b.id === id);
  doc.blocks.splice(idx + 1, 0, copy as Block);
  return copy.id;
}

/** Move block from fromIndex to toIndex. */
export function reorder(doc: PageDoc, fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  const [block] = doc.blocks.splice(fromIndex, 1);
  doc.blocks.splice(toIndex, 0, block);
}

/** Set a nested property on a block using dot-notation path. */
export function setProp(doc: PageDoc, id: string, path: string, value: unknown): void {
  const block = doc.blocks.find((b) => b.id === id) as unknown as Record<string, unknown>;
  if (!block) return;
  const parts = path.split(".");
  let node: Record<string, unknown> = block;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = node[key];
    if (next === null || typeof next !== "object") {
      node[key] = isNaN(Number(parts[i + 1])) ? {} : [];
    }
    node = node[key] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

/** Set the layout variant on a block. */
export function setVariant(doc: PageDoc, id: string, variant: string): void {
  const block = doc.blocks.find((b) => b.id === id) as Record<string, unknown> | undefined;
  if (block) block.variant = variant;
}

/** Bind a data-fetch block to an Appwrite source string. */
export function bindCollection(doc: PageDoc, id: string, source: string): void {
  const block = doc.blocks.find((b) => b.id === id) as Record<string, unknown> | undefined;
  if (block) block.source = source;
}

/** Update the page accent colour and propagate to meta. */
export function applyAccent(doc: PageDoc, hex: string): void {
  doc.meta.accentColor = hex;
}

/** Update a top-level meta field. */
export function setMeta<K extends keyof PageMeta>(doc: PageDoc, key: K, value: PageMeta[K]): void {
  doc.meta[key] = value;
}
