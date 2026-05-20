import { registerBlock } from "@/blocks/registry";
import { emptyBlock } from "@/editor/operations";
import { ProfileHeaderRender } from "./render";
import { ProfileHeaderInspector } from "./inspector";
import { ProfileHeaderThumb } from "./thumb";

registerBlock({
  type: "profileHeader",
  label: "Profile header",
  description: "Auth-aware account header",
  category: "Data",
  aiHint: "A personalised header showing the signed-in user's name, avatar, and activity stats.",
  aiProps: ["heading", "showAvatar", "showStats"],
  empty: () => emptyBlock("profileHeader") as never,
  Render: ProfileHeaderRender as never,
  Inspector: ProfileHeaderInspector as never,
  PaletteThumb: ProfileHeaderThumb,
});
