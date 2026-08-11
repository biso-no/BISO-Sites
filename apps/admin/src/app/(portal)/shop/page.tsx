import { requireNavAccess } from "@/lib/authorization";
import { canViewShopOperations } from "@/lib/roles";
import { listOrders, listProducts } from "../_actions/shop";
import { ShopStudioDashboard } from "./_components/shop-studio-dashboard";

export default async function ShopPage() {
  const ctx = await requireNavAccess("portal.shop");
  // Department product authors manage their catalog only — order data is a
  // commerce operation and is neither loaded nor rendered for them.
  const showOrders = canViewShopOperations(ctx.roles);
  const [products, orders] = await Promise.all([
    listProducts(),
    showOrders ? listOrders() : Promise.resolve([]),
  ]);

  return (
    <ShopStudioDashboard
      initialOrders={orders}
      initialProducts={products}
      showOrders={showOrders}
    />
  );
}
