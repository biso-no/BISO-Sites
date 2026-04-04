import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, Check, Tag, DollarSign, Package, ImageIcon, Eye, ShoppingCart } from "lucide-react";

export function ProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: isNew ? '' : 'BISO Premium Hoodie',
    category: 'Apparel',
    price: '599',
    stock: '145',
    image: 'https://images.unsplash.com/photo-1695013081006-ba8cdc2cc049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob29kaWUlMjBhcHBhcmVsJTIwcHJlbWl1bSUyMGRhcmt8ZW58MXx8fHwxNzc1MjkzMDgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'published'
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1400px] mx-auto pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10 mb-8 sticky top-0 bg-[#000a16]/90 backdrop-blur-xl z-20 pt-4 -mt-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/shop')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-light tracking-tight text-white">
                {isNew ? 'Add Product' : 'Edit Product'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] uppercase tracking-widest font-mono">
                {formData.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link to="/shop" className="text-white/40 text-xs hover:text-[#3DA9E0] transition-colors">Webshop</Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="text-white/40 text-xs truncate max-w-[200px]">{formData.name || 'Untitled'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/shop')}
            className="px-5 py-2.5 rounded-full border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-all"
          >
            Discard
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-full bg-[#3DA9E0] text-[#001731] text-sm font-bold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? 'Publishing...' : (
              <>
                <Check size={16} /> Publish Item
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        {/* Left: Editorial Form */}
        <div className="flex-1 w-full space-y-16">
          <section>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Enter product name..."
              className="w-full bg-transparent text-4xl md:text-5xl font-light tracking-tight text-white placeholder:text-white/20 border-none outline-none pb-4 focus:border-b focus:border-[#3DA9E0]/50 transition-all border-b border-transparent"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
                <Tag size={12} /> Category
              </label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none"
              >
                <option value="Apparel" className="bg-[#000a16]">Apparel</option>
                <option value="Accessories" className="bg-[#000a16]">Accessories</option>
                <option value="Digital" className="bg-[#000a16]">Digital</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
                <DollarSign size={12} /> Price (NOK)
              </label>
              <input 
                type="number" 
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                placeholder="0.00"
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors"
              />
            </div>
          </section>

          <section className="space-y-8 border-l border-white/10 pl-8 relative">
            <div className="absolute top-0 -left-[1.5px] w-[3px] h-8 bg-[#3DA9E0] rounded-r-full" />
            <div className="space-y-4">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50">Product Description</label>
              <textarea 
                rows={5}
                placeholder="Details about materials, sizing, and shipping..."
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-white/90 outline-none focus:border-[#3DA9E0]/50 transition-colors resize-none custom-scrollbar leading-relaxed"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                  <ImageIcon size={12} /> Product Image URL
                </label>
                <input 
                  type="url" 
                  value={formData.image}
                  onChange={e => setFormData({...formData, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                  <Package size={12} /> Inventory Stock
                </label>
                <input 
                  type="number" 
                  value={formData.stock}
                  onChange={e => setFormData({...formData, stock: e.target.value})}
                  className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="w-full lg:w-[380px] shrink-0 sticky top-32">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Eye size={14} className="text-[#3DA9E0]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Storefront Preview</span>
          </div>

          <div className="rounded-3xl bg-[#00050d] border border-white/10 overflow-hidden group shadow-2xl">
            <div className="aspect-square relative overflow-hidden bg-[#001731] flex items-center justify-center p-6">
              {formData.image ? (
                <img src={formData.image} className="w-full h-full object-cover rounded-xl shadow-2xl group-hover:scale-105 transition-transform duration-700" alt="Product" />
              ) : (
                <Package size={48} className="text-white/20" />
              )}
            </div>
            
            <div className="p-6 relative">
              <div className="absolute top-0 right-6 -translate-y-1/2">
                <button className="w-12 h-12 rounded-full bg-[#3DA9E0] text-[#001731] flex items-center justify-center shadow-[0_0_20px_rgba(61,169,224,0.4)] hover:scale-110 transition-transform">
                  <ShoppingCart size={20} className="ml-[-2px]" />
                </button>
              </div>

              <div className="mb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#3DA9E0] uppercase">
                  {formData.category || 'Category'}
                </span>
              </div>
              <h3 className="text-xl font-medium text-white mb-4 line-clamp-1">
                {formData.name || 'Untitled Product'}
              </h3>
              
              <div className="flex items-center justify-between">
                <span className="text-2xl font-light text-white">
                  {formData.price ? `NOK ${formData.price}` : 'NOK 0'}
                </span>
                <span className="text-xs text-white/40">
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
