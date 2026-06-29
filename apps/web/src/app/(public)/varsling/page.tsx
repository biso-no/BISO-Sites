import { permanentRedirect } from "next/navigation";

// Legacy URL alias — 308 permanent redirect to the canonical /safety page.
// External links and the old footer pointed to /varsling; this preserves them.
export default function VarslingPage() {
  permanentRedirect("/safety");
}
