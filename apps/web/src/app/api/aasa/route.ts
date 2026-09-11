export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ["4JQ6VWVRGY.com.biso.no"],
          components: [{ "/": "/auth/*" }],
        },
      ],
    },
  });
}
