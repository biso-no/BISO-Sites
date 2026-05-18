// Seed data for the WEBSHOP editor — mirrors appwrite WebshopProducts /
// ContentTranslations / Orders schema. Variants are admin-defined: a hoodie
// has sizes, a Fadderuke pass has tiers, a sticker pack has nothing at all.

// Extend the shared icon set with a few shop-specific marks. The base set
// already includes shop, bell, etc.
window.I = Object.assign(window.I, {
  tag:     (p) => <Icon {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/></Icon>,
  image:   (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 18 5-6 4 4 3-3 4 5"/></Icon>,
  layers:  (p) => <Icon {...p}><path d="M12 3 3 8l9 5 9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></Icon>,
  box:     (p) => <Icon {...p}><path d="M3 8 12 4l9 4v8l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/></Icon>,
  coin:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5-1.3 2-3 2.5-3 .8-3 2.5 1.3 2.5 3 2.5 3-1 3-2.5M12 5v2M12 17v2"/></Icon>,
  cart:    (p) => <Icon {...p}><path d="M3 4h2l2 12h11l2-9H7"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></Icon>,
  pct:     (p) => <Icon {...p}><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="m6 18 12-12"/></Icon>,
  truck:   (p) => <Icon {...p}><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></Icon>,
  qr:      (p) => <Icon {...p}><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><path d="M15 15h2v2M19 17v2M15 19h2M21 15v6"/></Icon>,
  refund:  (p) => <Icon {...p} d="M3 12a9 9 0 0 1 15.5-6.3M21 4v5h-5M21 12a9 9 0 0 1-15.5 6.3M3 20v-5h5"/>,
});

// CoverPattern — copies the pattern SVGs the jobs preview uses, so the
// gallery thumbs and phone hero work without loading preview.jsx.
if (!window.CoverPattern) {
  window.CoverPattern = function CoverPattern({ which = 1 }) {
    if (which === 1) return (
      <svg viewBox="0 0 200 130" preserveAspectRatio="none">
        <defs><pattern id="dots-sh-1" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern></defs>
        <rect width="200" height="130" fill="url(#dots-sh-1)" />
      </svg>
    );
    if (which === 2) return (
      <svg viewBox="0 0 200 130" preserveAspectRatio="none">
        {[...Array(8)].map((_, i) => <line key={i} x1="0" y1={i*18} x2="200" y2={i*18 - 30} stroke="white" strokeWidth="0.5"/>)}
      </svg>
    );
    if (which === 3) return (
      <svg viewBox="0 0 200 130" preserveAspectRatio="none">
        <circle cx="160" cy="20" r="80" fill="none" stroke="white" strokeWidth="0.5" />
        <circle cx="160" cy="20" r="60" fill="none" stroke="white" strokeWidth="0.5" />
        <circle cx="160" cy="20" r="40" fill="none" stroke="white" strokeWidth="0.5" />
      </svg>
    );
    if (which === 4) return (
      <svg viewBox="0 0 200 130" preserveAspectRatio="none">
        <path d="M0 80 Q 50 60 100 80 T 200 80" stroke="white" strokeWidth="0.6" fill="none" opacity=".6"/>
        <path d="M0 90 Q 50 70 100 90 T 200 90" stroke="white" strokeWidth="0.6" fill="none" opacity=".4"/>
        <path d="M0 100 Q 50 80 100 100 T 200 100" stroke="white" strokeWidth="0.6" fill="none" opacity=".25"/>
      </svg>
    );
    if (which === 5) return (
      <svg viewBox="0 0 200 130" preserveAspectRatio="none">
        <defs><pattern id="grid-sh-5" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" stroke="white" strokeWidth="0.4" fill="none"/></pattern></defs>
        <rect width="200" height="130" fill="url(#grid-sh-5)" />
      </svg>
    );
    return null;
  };
}

// Categories — admin can add more, but these are the seed pills.
const PRODUCT_CATEGORIES = [
  { id: "apparel",    name: "Apparel",    crest: "A" },
  { id: "tickets",    name: "Tickets",    crest: "T" },
  { id: "drinkware",  name: "Drinkware",  crest: "D" },
  { id: "stationery", name: "Stationery", crest: "S" },
  { id: "stickers",   name: "Stickers",   crest: "•" },
  { id: "books",      name: "Books",      crest: "B" },
];

// WebshopProductStatus enum: draft | pending_approval | published | archived
const SAMPLE_PRODUCTS = [
  {
    id: "p1", slug: "esn-welcome-hoodie-26",
    titleEn: "ESN Welcome Hoodie '26",
    titleNo: "ESN Velkomstgenser '26",
    category: "apparel", department: "esn", campus: "oslo",
    status: "published",
    regularPrice: 449, memberPrice: 349,
    memberOnly: false,
    stock: 84, lowStockThreshold: 10,
    variants: [
      { name: "Size · S", price: 449, memberPrice: 349, stock: 4,  sku: "ESN-HOOD-26-S" },
      { name: "Size · M", price: 449, memberPrice: 349, stock: 22, sku: "ESN-HOOD-26-M" },
      { name: "Size · L", price: 449, memberPrice: 349, stock: 28, sku: "ESN-HOOD-26-L" },
      { name: "Size · XL", price: 449, memberPrice: 349, stock: 30, sku: "ESN-HOOD-26-XL" },
    ],
    sold30: 142, image: "p1",
  },
  {
    id: "p2", slug: "fadderuke-26-pass",
    titleEn: "Fadderuke '26 — Week Pass",
    titleNo: "Fadderuke '26 — Uketicket",
    category: "tickets", department: "esn", campus: "oslo",
    status: "draft",
    regularPrice: 1490, memberPrice: 990,
    memberOnly: false,
    stock: 1200, lowStockThreshold: 100,
    variants: [
      { name: "Full Week Pass",  price: 1490, memberPrice: 990, stock: 800, sku: "FAD-26-WEEK" },
      { name: "Weekend Only",    price: 590,  memberPrice: 390, stock: 300, sku: "FAD-26-WKND" },
      { name: "VIP Add-on",      price: 290,  memberPrice: 240, stock: 100, sku: "FAD-26-VIP"  },
    ],
    sold30: 0, image: "p3",
  },
  {
    id: "p3", slug: "biso-recycled-bottle",
    titleEn: "BISO Recycled Steel Bottle",
    titleNo: "BISO Resirkulert Stålflaske",
    category: "drinkware", department: "sustain", campus: "oslo",
    status: "published",
    regularPrice: 199, memberPrice: 149,
    memberOnly: false,
    stock: 6, lowStockThreshold: 10,
    variants: [
      { name: "Sage green",   price: 199, memberPrice: 149, stock: 2, sku: "BTL-SG" },
      { name: "Claret",       price: 199, memberPrice: 149, stock: 0, sku: "BTL-CL" },
      { name: "Slate black",  price: 199, memberPrice: 149, stock: 4, sku: "BTL-SL" },
    ],
    sold30: 58, image: "p3",
  },
  {
    id: "p4", slug: "bi-oslo-cap",
    titleEn: "BI Oslo Cap",
    titleNo: "BI Oslo Caps",
    category: "apparel", department: "marketing", campus: "oslo",
    status: "published",
    regularPrice: 249, memberPrice: 199,
    memberOnly: false,
    stock: 41, lowStockThreshold: 8,
    variants: [],
    sold30: 22, image: "p4",
  },
  {
    id: "p5", slug: "vinterball-26",
    titleEn: "Vinterball 2026 — Ticket",
    titleNo: "Vinterball 2026 — Billett",
    category: "tickets", department: "esn", campus: "oslo",
    status: "published",
    regularPrice: 890, memberPrice: 690,
    memberOnly: true,
    stock: 12, lowStockThreshold: 20,
    variants: [
      { name: "Standard seating", price: 890,  memberPrice: 690,  stock: 8, sku: "VB-26-STD" },
      { name: "Premium table (8 pers.)", price: 8200, memberPrice: 6400, stock: 4, sku: "VB-26-TBL" },
    ],
    sold30: 188, image: "p2",
  },
  {
    id: "p6", slug: "biso-notebook-a5",
    titleEn: "BISO Notebook · A5",
    titleNo: "BISO Notatbok · A5",
    category: "stationery", department: "marketing", campus: "oslo",
    status: "published",
    regularPrice: 129, memberPrice: 99,
    memberOnly: false,
    stock: 220, lowStockThreshold: 30,
    variants: [
      { name: "Lined",    price: 129, memberPrice: 99, stock: 120, sku: "NB-A5-L" },
      { name: "Dotted",   price: 129, memberPrice: 99, stock: 100, sku: "NB-A5-D" },
    ],
    sold30: 19, image: "p4",
  },
  {
    id: "p7", slug: "esn-sticker-pack",
    titleEn: "ESN Sticker Pack — 8 pcs",
    titleNo: "ESN Klistremerker — 8 stk",
    category: "stickers", department: "esn", campus: "oslo",
    status: "pending_approval",
    regularPrice: 49, memberPrice: 0,
    memberOnly: false,
    stock: 0, lowStockThreshold: 20,
    variants: [],
    sold30: 0, image: "p1",
  },
  {
    id: "p8", slug: "from-aud-max-to-atrium",
    titleEn: "From Aud-Max to Atrium — Field Guide",
    titleNo: "Fra Aud-Max til Atrium — Guide",
    category: "books", department: "media", campus: "oslo",
    status: "archived",
    regularPrice: 199, memberPrice: 149,
    memberOnly: false,
    stock: 0, lowStockThreshold: 5,
    variants: [],
    sold30: 0, image: "p5",
  },
];

// The product currently being composed — Fadderuke '26 Week Pass.
// Three flexible variants (not sizes!) showcasing the admin-defined system.
const PRODUCT_DRAFT_DEFAULT = {
  id: "p2",
  status: "draft",
  campus: "oslo",
  department: "esn",
  category: "tickets",
  slug: "fadderuke-26-pass",
  titleEn: "Fadderuke '26 — Week Pass",
  titleNo: "Fadderuke '26 — Uketicket",
  shortEn: "Eight nights, three campuses, every welcome-week social on a single QR code that lives on your lock screen.",
  shortNo: "Åtte kvelder, tre campuser, hele velkomstuken på én QR-kode som bor på låseskjermen din.",
  descEn: [
    { type: "h", text: "What's in the pass" },
    { type: "p", text: "The Week Pass is the lazy-but-not-too-lazy way to do Fadderuke. One ticket, every official BISO event from doors at Atrium on Monday to recovery brunch the following Saturday. No queueing at the table outside D2-040 every night." },
    { type: "p", text: "Each variant below is its own SKU with its own stock count — pick the version that fits your week, your wallet, and how much sleep you're willing to skip." },
    { type: "h", text: "Run-of-show" },
    { type: "l", items: [
      "Mon — Welcome night at Atrium (doors 19:00)",
      "Tue — Speed dating with the buddies (Kantina)",
      "Wed — Pub crawl through Grünerløkka (meet 20:00 at Schous)",
      "Thu — International dinner at Vulkan",
      "Fri — Concert at Sentrum Scene (DJ Lineup TBA)",
      "Sat — Recovery brunch & farewell, BI Oslo Forum",
    ]},
    { type: "h", text: "What you'll need" },
    { type: "l", items: [
      "A valid BI student email",
      "The BISO app installed for QR scan-in",
      "ID at any venue serving 18+",
      "A water bottle (we'll lose count of how often we say this)",
    ]},
  ],
  // Variants — admin-defined! Tiers here, not sizes.
  variants: [
    { name: "Full Week Pass",  price: 1490, memberPrice: 990, stock: 800, sku: "FAD-26-WEEK", lowStock: 100 },
    { name: "Weekend Only (Fri+Sat)", price: 590, memberPrice: 390, stock: 300, sku: "FAD-26-WKND", lowStock: 50 },
    { name: "VIP Add-on (front-row at Sentrum Scene)", price: 290, memberPrice: 240, stock: 100, sku: "FAD-26-VIP", lowStock: 20 },
  ],
  // Visibility / restrictions
  memberOnly: false,
  publishMode: "now",
  // Inventory mode
  inventoryMode: "tracked", // tracked | unlimited
  // Pricing rule applied across variants (default member discount %)
  memberDiscountPct: 33,
  // Photos — multi-image gallery
  photos: [
    { id: "ph1", label: "Atrium opening night, '25", pattern: 1, isHero: true },
    { id: "ph2", label: "Buddy speed dating", pattern: 3 },
    { id: "ph3", label: "Sentrum Scene concert", pattern: 2 },
  ],
  coverPattern: 1,
  // Linked event (because this is a ticket!)
  linkedEventSlug: "fadderuke-26",
  // Contact / support
  contactName: "Kari Berg",
  contactRole: "ESN Vice President",
  contactEmail: "esn-vp@biso.no",
  tags: ["Welcome week", "Bundle", "International", "Best value"],
};

// ============================================================================
// Sample orders — for the Orders inbox tab
// OrderStatus: pending | authorized | paid | cancelled | failed | refunded
// ============================================================================
const SAMPLE_ORDERS = [
  {
    id: "o-148", ref: "BISO-26-0148",
    buyer: "Sofia Lindqvist", email: "sofia.l@bi.no", isMember: true,
    items: [{ name: "ESN Welcome Hoodie '26", variant: "Size · M", qty: 1 }],
    subtotal: 449, memberDiscount: 100, total: 349,
    status: "paid", placedAt: "2026-05-13T11:42",
    fulfillment: "pickup", paid: true,
  },
  {
    id: "o-147", ref: "BISO-26-0147",
    buyer: "Markus Hauge", email: "m.hauge@bi.no", isMember: true,
    items: [
      { name: "Fadderuke '26 — Week Pass", variant: "Full Week Pass", qty: 1 },
      { name: "BISO Recycled Steel Bottle", variant: "Claret", qty: 1 },
    ],
    subtotal: 1689, memberDiscount: 550, total: 1139,
    status: "authorized", placedAt: "2026-05-13T10:18",
    fulfillment: "digital + pickup", paid: false,
  },
  {
    id: "o-146", ref: "BISO-26-0146",
    buyer: "Yuki Tanaka", email: "y.tanaka@bi.no", isMember: false,
    items: [{ name: "Vinterball 2026 — Ticket", variant: "Premium table (8 pers.)", qty: 1 }],
    subtotal: 8200, memberDiscount: 0, total: 8200,
    status: "paid", placedAt: "2026-05-13T09:55",
    fulfillment: "digital", paid: true,
  },
  {
    id: "o-145", ref: "BISO-26-0145",
    buyer: "Olav Strand", email: "olav.s@bi.no", isMember: true,
    items: [{ name: "BI Oslo Cap", variant: "—", qty: 2 }],
    subtotal: 498, memberDiscount: 100, total: 398,
    status: "pending", placedAt: "2026-05-13T09:32",
    fulfillment: "pickup", paid: false,
  },
  {
    id: "o-144", ref: "BISO-26-0144",
    buyer: "Camilla Berg", email: "camilla.b@bi.no", isMember: false,
    items: [{ name: "BISO Notebook · A5", variant: "Dotted", qty: 3 }],
    subtotal: 387, memberDiscount: 0, total: 387,
    status: "paid", placedAt: "2026-05-12T18:04",
    fulfillment: "pickup", paid: true,
  },
  {
    id: "o-143", ref: "BISO-26-0143",
    buyer: "Anh Pham", email: "anh.pham@bi.no", isMember: true,
    items: [{ name: "ESN Welcome Hoodie '26", variant: "Size · S", qty: 1 }],
    subtotal: 449, memberDiscount: 100, total: 349,
    status: "refunded", placedAt: "2026-05-12T16:21",
    fulfillment: "pickup", paid: true, refundReason: "Wrong size",
  },
  {
    id: "o-142", ref: "BISO-26-0142",
    buyer: "Jonas Vik", email: "jonas.vik@bi.no", isMember: false,
    items: [{ name: "Vinterball 2026 — Ticket", variant: "Standard seating", qty: 2 }],
    subtotal: 1780, memberDiscount: 0, total: 1780,
    status: "failed", placedAt: "2026-05-12T14:11",
    fulfillment: "digital", paid: false, failureReason: "Card declined",
  },
  {
    id: "o-141", ref: "BISO-26-0141",
    buyer: "Maria Sørensen", email: "maria.s@bi.no", isMember: true,
    items: [
      { name: "BISO Notebook · A5", variant: "Lined", qty: 1 },
      { name: "ESN Sticker Pack — 8 pcs", variant: "—", qty: 2 },
    ],
    subtotal: 227, memberDiscount: 30, total: 197,
    status: "paid", placedAt: "2026-05-12T12:48",
    fulfillment: "pickup", paid: true,
  },
];

window.PRODUCT_CATEGORIES    = PRODUCT_CATEGORIES;
window.SAMPLE_PRODUCTS       = SAMPLE_PRODUCTS;
window.PRODUCT_DRAFT_DEFAULT = PRODUCT_DRAFT_DEFAULT;
window.SAMPLE_ORDERS         = SAMPLE_ORDERS;
window.prodCat = (id) => PRODUCT_CATEGORIES.find(c => c.id === id);

// Shop-specific helpers (fmtNOK is provided by event-data; we re-define a
// safe local fallback in case the shop is loaded standalone)
if (!window.fmtNOK) {
  window.fmtNOK = (n) => {
    if (n == null || n === 0) return "Free";
    return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
  };
}

// Total stock across variants (or root stock if no variants)
window.totalStock = (p) => {
  if (!p.variants || p.variants.length === 0) return p.stock || 0;
  return p.variants.reduce((s, v) => s + (v.stock || 0), 0);
};

// Lowest-stock variant — used for "low stock" warnings on a product row
window.lowestVariant = (p) => {
  if (!p.variants || p.variants.length === 0) return null;
  return p.variants.reduce((min, v) => (min == null || v.stock < min.stock) ? v : min, null);
};

// Format a price range across variants ("kr 290 – 1 490")
window.priceRange = (p) => {
  if (!p.variants || p.variants.length === 0) return fmtNOK(p.regularPrice);
  const prices = p.variants.map(v => v.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  if (lo === hi) return fmtNOK(lo);
  return `${fmtNOK(lo)} – ${fmtNOK(hi)}`;
};

// Date formatter for orders ("13 May · 11:42")
window.fmtOrderDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// Simple SKU sluggifier
window.toSku = (str) => (str || "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 20);
