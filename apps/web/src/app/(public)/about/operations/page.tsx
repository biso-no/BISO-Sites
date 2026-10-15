import { redirect } from "next/navigation";
import { ABOUT_REDIRECTS } from "@/lib/about-sections";

/** Folded into the merged Om BISO page; the old address keeps working. */
export default function RedirectPage() {
  redirect(ABOUT_REDIRECTS.operations);
}
