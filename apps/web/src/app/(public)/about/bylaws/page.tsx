import { redirect } from "next/navigation";

/**
 * The bylaws used to be a page of static copy that told readers to ask the
 * Operations Unit for the current documents. The documents themselves are
 * published on /documents, so this address opens that shelf.
 */
export default function BylawsPage() {
  redirect("/documents?category=campus-bylaws");
}
