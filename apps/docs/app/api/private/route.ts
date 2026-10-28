import { getViewer } from "@/lib/auth/viewer";
import { createPrivateHandler } from "@/lib/private/handler";
import { getPrivateSource } from "@/lib/private/source";

export const dynamic = "force-dynamic";

export const GET = createPrivateHandler({
  getViewer: () => getViewer(),
  getSource: () => getPrivateSource(process.env),
});
