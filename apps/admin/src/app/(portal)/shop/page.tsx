import { requireNavAccess } from "@/lib/authorization";
import { canViewShopOperations } from "@/lib/roles";
import { listOrders, listProducts } from "../_actions/shop";
import { ShopStudioDashboard } from "./_components/shop-studio-dashboard";

export default async function ShopPage() {
  const ctx = await requireNavAccess("portal.shop");
  // Department product authors manage their catalog only — order data is a
  // commerce operation and is neither loaded nor rendered for them.
  const showOrders = canViewShopOperations(ctx.roles);
  // The dashboard still filters client-side over one loaded window, so it asks
  // for the same window sizes these actions used before they were paginated
  // (100 products, 50 orders). Wiring it to real pagination — page/size/q from
  // searchParams, plus the count actions — is a follow-up.
  const [products, orders] = await Promise.all([
    listProducts({ page: 1, size: 100, q: "" }),
    showOrders ? listOrders({ page: 1, size: 50, q: "" }) : null,
  ]);

  return (
    <ShopStudioDashboard
      initialOrders={orders?.rows ?? []}
      initialProducts={products.rows}
      showOrders={showOrders}
    />
  );
}
