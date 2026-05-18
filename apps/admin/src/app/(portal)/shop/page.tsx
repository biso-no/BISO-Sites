import { listOrders, listProducts } from "../_actions/shop";
import { ShopStudioDashboard } from "./_components/shop-studio-dashboard";

export default async function ShopPage() {
  const [products, orders] = await Promise.all([listProducts(), listOrders()]);

  return (
    <ShopStudioDashboard initialOrders={orders} initialProducts={products} />
  );
}
