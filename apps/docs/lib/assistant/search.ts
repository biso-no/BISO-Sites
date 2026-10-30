import { createFromSource } from "fumadocs-core/search/server";
import { source } from "lib/source";

// One search index, shared by the search dialog route and the assistant.
// https://docs.orama.com/docs/orama-js/supported-languages
export const searchApi = createFromSource(source, { language: "english" });
