import {
  Filter,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const MOCK_PRODUCTS = [
  {
    id: "1",
    name: "BISO Premium Hoodie",
    category: "Apparel",
    price: "NOK 599",
    stock: 145,
    status: "in_stock",
    sales: 890,
    image:
      "https://images.unsplash.com/photo-1695013081006-ba8cdc2cc049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob29kaWUlMjBhcHBhcmVsJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkzMDgwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "2",
    name: "BISO Alumni Pin",
    category: "Accessories",
    price: "NOK 149",
    stock: 12,
    status: "low_stock",
    sales: 450,
    image:
      "https://images.unsplash.com/photo-1608680480325-d3ec3cdf7e60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlY29tbWVyY2UlMjBmYXNoaW9uJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function ProductManagement() {
  const [search, setSearch] = useState("");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-light text-4xl text-white tracking-tight md:text-5xl">
            Webshop
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Manage products, inventory, and premium merch.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/shop/new"
          >
            <Plus size={18} />
            <span>Add Product</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search
            className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40"
            size={18}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pr-4 pl-12 text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-[#3DA9E0]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["All Products", "Apparel", "Accessories", "Digital"].map((cat) => (
            <button
              className="whitespace-nowrap rounded-full border border-white/10 px-5 py-2 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
              key={cat}
            >
              {cat}
            </button>
          ))}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MOCK_PRODUCTS.map((product, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="group overflow-hidden rounded-3xl border border-white/5 bg-white/2 transition-all duration-300 hover:bg-white/4"
            initial={{ opacity: 0, y: 20 }}
            key={product.id}
            transition={{ delay: i * 0.1 }}
          >
            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#001731] p-6">
              <img
                alt={product.name}
                className="h-full w-full rounded-xl object-cover shadow-2xl transition-transform duration-700 group-hover:scale-105"
                src={product.image}
              />
              <div className="absolute top-4 right-4 z-10 cursor-pointer rounded-lg border border-white/10 bg-[#000a16]/80 p-2 opacity-0 backdrop-blur-md transition-opacity hover:bg-white/10 group-hover:opacity-100">
                <MoreHorizontal className="text-white" size={16} />
              </div>
            </div>

            <div className="flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between">
                <span className="flex items-center gap-1 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-wider">
                  <Tag size={12} /> {product.category}
                </span>
                {product.status === "low_stock" && (
                  <span className="rounded-sm bg-amber-400/10 px-2 py-0.5 font-bold text-[10px] text-amber-400 uppercase tracking-wider">
                    Low Stock
                  </span>
                )}
              </div>
              <Link
                className="mb-4 line-clamp-1 block font-medium text-lg text-white transition-colors group-hover:text-[#3DA9E0]"
                to={`/shop/${product.id}`}
              >
                {product.name}
              </Link>

              <div className="mt-auto flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="mb-1 flex items-center gap-1 text-sm text-white/40">
                    <Package size={12} /> {product.stock} in stock
                  </span>
                  <span className="font-semibold text-lg text-white">
                    {product.price}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="mb-1 flex items-center gap-1 text-sm text-white/40">
                    <ShoppingCart size={12} /> {product.sales} sold
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
