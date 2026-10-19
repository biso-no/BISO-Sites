import { APP_LINK_COMPONENTS } from "@/lib/app-links";

export function GET() {
  return Response.json({
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ["4JQ6VWVRGY.com.biso.no"],
          components: APP_LINK_COMPONENTS,
        },
      ],
    },
  });
}
