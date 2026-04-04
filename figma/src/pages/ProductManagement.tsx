import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Plus, Search, Filter, MoreHorizontal, ShoppingCart, Tag, Package } from "lucide-react";

const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'BISO Premium Hoodie',
    category: 'Apparel',
    price: 'NOK 599',
    stock: 145,
    status: 'in_stock',
    sales: 890,
    image: 'https://images.unsplash.com/photo-1695013081006-ba8cdc2cc049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob29kaWUlMjBhcHBhcmVsJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkzMDgwfDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    name: 'BISO Alumni Pin',
    category: 'Accessories',
    price: 'NOK 149',
    stock: 12,
    status: 'low_stock',
    sales: 450,
    image: 'https://images.unsplash.com/photo-1608680480325-d3ec3cdf7e60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlY29tbWVyY2UlMjBmYXNoaW9uJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export function ProductManagement() {
  const [search, setSearch] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
            Webshop
          </h1>
          <p className="text-white/50 mt-2 text-lg">Manage products, inventory, and premium merch.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/shop/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
            <Plus size={18} />
            <span>Add Product</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All Products', 'Apparel', 'Accessories', 'Digital'].map((cat) => (
            <button key={cat} className="px-5 py-2 rounded-full border border-white/10 text-white/60 text-sm whitespace-nowrap hover:bg-white/5 hover:text-white transition-all">
              {cat}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {MOCK_PRODUCTS.map((product, i) => (
          <motion.div 
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden hover:bg-white/[0.04] transition-all duration-300"
          >
            <div className="relative aspect-square overflow-hidden bg-[#001731] p-6 flex items-center justify-center">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105 shadow-2xl"
              />
              <div className="absolute top-4 right-4 bg-[#000a16]/80 backdrop-blur-md rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10 hover:bg-white/10 z-10">
                <MoreHorizontal size={16} className="text-white" />
              </div>
            </div>

            <div className="p-5 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-semibold tracking-wider text-[#3DA9E0] uppercase flex items-center gap-1">
                  <Tag size={12} /> {product.category}
                </span>
                {product.status === 'low_stock' && (
                  <span className="text-[10px] font-bold tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-sm uppercase">Low Stock</span>
                )}
              </div>
              <Link to={`/shop/${product.id}`} className="text-lg font-medium text-white group-hover:text-[#3DA9E0] transition-colors line-clamp-1 mb-4 block">
                {product.name}
              </Link>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex flex-col">
                  <span className="text-sm text-white/40 mb-1 flex items-center gap-1"><Package size={12}/> {product.stock} in stock</span>
                  <span className="text-lg font-semibold text-white">{product.price}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-white/40 mb-1 flex items-center gap-1"><ShoppingCart size={12}/> {product.sales} sold</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
