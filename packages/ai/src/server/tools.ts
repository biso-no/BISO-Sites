import { getDocumentStats, listSharePointSites, searchSharePoint } from "./rag";
import { searchSiteContent } from "./site-search";

export const tools = {
  searchSharePoint,
  getDocumentStats,
  listSharePointSites,
  searchSiteContent,
};
