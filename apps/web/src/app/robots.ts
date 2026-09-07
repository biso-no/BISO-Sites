import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://web.biso.no";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block all API routes and authentication / member-only sections.
        // The trailing wildcard is required — robots matches by prefix
        // only when an explicit `*` is provided.
        disallow: [
          "/api/",
          "/auth/",
          "/applications",
          "/fs",
          "/profile",
          "/shop/order/",
          "/shop/checkout",
          "/shop/cart",
          "/recruitment/book/",
          // Internal design-system reference, not public content.
          "/design-system",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
