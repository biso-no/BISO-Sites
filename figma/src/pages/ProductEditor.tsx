import {
  Check,
  ChevronLeft,
  DollarSign,
  Eye,
  ImageIcon,
  Package,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export function ProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: isNew ? "" : "BISO Premium Hoodie",
    category: "Apparel",
    price: "599",
    stock: "145",
    image:
      "https://images.unsplash.com/photo-1695013081006-ba8cdc2cc049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob29kaWUlMjBhcHBhcmVsJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkzMDgwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    status: "published",
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate("/shop");
    }, 1000);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1400px] pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="sticky top-0 z-20 -mt-4 mb-8 flex flex-col justify-between gap-6 border-white/10 border-b bg-[#000a16]/90 pt-4 pb-8 backdrop-blur-xl md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/shop")}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-2xl text-white tracking-tight">
                {isNew ? "Add Product" : "Edit Product"}
              </h1>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                {formData.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Link
                className="text-white/40 text-xs transition-colors hover:text-[#3DA9E0]"
                to="/shop"
              >
                Webshop
              </Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="max-w-[200px] truncate text-white/40 text-xs">
                {formData.name || "Untitled"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-white/10 px-5 py-2.5 font-medium text-sm text-white/70 transition-all hover:bg-white/5"
            onClick={() => navigate("/shop")}
          >
            Discard
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-2.5 font-bold text-[#001731] text-sm shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] disabled:opacity-50"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              "Publishing..."
            ) : (
              <>
                <Check size={16} /> Publish Item
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col items-start gap-12 lg:flex-row lg:gap-16">
        {/* Left: Editorial Form */}
        <div className="w-full flex-1 space-y-16">
          <section>
            <input
              className="w-full border-transparent border-b border-none bg-transparent pb-4 font-light text-4xl text-white tracking-tight outline-none transition-all placeholder:text-white/20 focus:border-[#3DA9E0]/50 focus:border-b md:text-5xl"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name..."
              type="text"
              value={formData.name}
            />
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                <Tag size={12} /> Category
              </label>
              <select
                className="w-full appearance-none border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                value={formData.category}
              >
                <option className="bg-[#000a16]" value="Apparel">
                  Apparel
                </option>
                <option className="bg-[#000a16]" value="Accessories">
                  Accessories
                </option>
                <option className="bg-[#000a16]" value="Digital">
                  Digital
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                <DollarSign size={12} /> Price (NOK)
              </label>
              <input
                className="w-full border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                placeholder="0.00"
                type="number"
                value={formData.price}
              />
            </div>
          </section>

          <section className="relative space-y-8 border-white/10 border-l pl-8">
            <div className="absolute top-0 -left-[1.5px] h-8 w-[3px] rounded-r-full bg-[#3DA9E0]" />
            <div className="space-y-4">
              <label className="font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                Product Description
              </label>
              <textarea
                className="custom-scrollbar w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-white/90 leading-relaxed outline-none transition-colors focus:border-[#3DA9E0]/50"
                placeholder="Details about materials, sizing, and shipping..."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                  <ImageIcon size={12} /> Product Image URL
                </label>
                <input
                  className="w-full border-white/10 border-b bg-transparent pb-2 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  onChange={(e) =>
                    setFormData({ ...formData, image: e.target.value })
                  }
                  placeholder="https://..."
                  type="url"
                  value={formData.image}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                  <Package size={12} /> Inventory Stock
                </label>
                <input
                  className="w-full border-white/10 border-b bg-transparent pb-2 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  type="number"
                  value={formData.stock}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="sticky top-32 w-full shrink-0 lg:w-[380px]">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Eye className="text-[#3DA9E0]" size={14} />
            <span className="font-mono text-white/50 text-xs uppercase tracking-widest">
              Storefront Preview
            </span>
          </div>

          <div className="group overflow-hidden rounded-3xl border border-white/10 bg-[#00050d] shadow-2xl">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#001731] p-6">
              {formData.image ? (
                <img
                  alt="Product"
                  className="h-full w-full rounded-xl object-cover shadow-2xl transition-transform duration-700 group-hover:scale-105"
                  src={formData.image}
                />
              ) : (
                <Package className="text-white/20" size={48} />
              )}
            </div>

            <div className="relative p-6">
              <div className="absolute top-0 right-6 -translate-y-1/2">
                <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3DA9E0] text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.4)] transition-transform hover:scale-110">
                  <ShoppingCart className="ml-[-2px]" size={20} />
                </button>
              </div>

              <div className="mb-2">
                <span className="font-bold text-[#3DA9E0] text-[10px] uppercase tracking-wider">
                  {formData.category || "Category"}
                </span>
              </div>
              <h3 className="mb-4 line-clamp-1 font-medium text-white text-xl">
                {formData.name || "Untitled Product"}
              </h3>

              <div className="flex items-center justify-between">
                <span className="font-light text-2xl text-white">
                  {formData.price ? `NOK ${formData.price}` : "NOK 0"}
                </span>
                <span className="text-white/40 text-xs">
                  {formData.stock} in stock
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
