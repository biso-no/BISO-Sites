import { permanentRedirect } from "next/navigation";

// Every membership CTA on the site points at /shop/membership/. The purchase
// flow lives at /membership/join; keep the old path working. This static
// segment wins over the (public)/shop/[slug] catch-all — Next.js always
// prefers a static route over a dynamic one at the same depth.
export default function ShopMembershipRedirect(): never {
  permanentRedirect("/membership/join");
}
