// Webshop dashboard — Catalog and Orders tabs.
// Catalog mirrors the Jobs/Events dashboard chrome (KPI strip, featured draft,
// filter row, table). Orders is a sister inbox under the same shell.

const shopDashCSS = `
.dash{padding: 28px 36px 56px; overflow: auto; flex: 1; min-height: 0;}

.dash-head{
  display:flex; align-items:flex-end; justify-content:space-between; gap: 24px;
  padding-bottom: 22px; border-bottom: 0.5px solid var(--rule);
}
.dash-head h1{
  font-family: var(--serif); font-size: 56px; line-height: 0.95;
  margin: 0; letter-spacing: -0.015em; font-weight: 400;
}
.dash-head h1 em{font-style: italic; color: var(--claret);}
.dash-head p{margin: 8px 0 0; color: var(--ink-3); font-size: 14.5px; max-width: 48ch;}

.compose-btn{
  display:flex; align-items:center; gap: 10px;
  appearance: none; border: 0;
  padding: 12px 18px;
  background: var(--ink); color: var(--paper);
  border-radius: 999px;
  font-size: 14px; font-weight: 500; letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(26,24,20,.25), 0 1px 0 rgba(255,255,255,.1) inset;
  transition: transform .12s, box-shadow .12s;
}
.compose-btn:hover{transform: translateY(-1px); box-shadow: 0 8px 26px rgba(26,24,20,.32), 0 1px 0 rgba(255,255,255,.12) inset;}
.compose-btn .plus{
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--paper); color: var(--ink);
  display:grid; place-items: center;
}

/* Top tabs — Catalog | Orders | Insights */
.shop-tabs{
  display:flex; align-items: center; gap: 4px;
  margin: 22px 0 6px;
  border-bottom: 0.5px solid var(--rule);
}
.shop-tabs button{
  appearance: none; border: 0; background: transparent;
  padding: 10px 14px 12px; cursor: pointer;
  font-size: 13.5px; color: var(--ink-3);
  display: flex; align-items: center; gap: 8px;
  position: relative;
  font-weight: 500;
}
.shop-tabs button:hover{color: var(--ink);}
.shop-tabs button.on{color: var(--ink);}
.shop-tabs button.on::after{
  content:""; position: absolute; left: 14px; right: 14px; bottom: -0.5px;
  height: 1.5px; background: var(--ink);
}
.shop-tabs button .c{
  font-family: var(--mono); font-size: 10.5px; color: var(--ink-4);
  padding: 1px 6px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
}
.shop-tabs button.on .c{color: var(--ink-2);}
.shop-tabs button.alert .c{color: var(--claret); background: rgba(107,30,30,.06); border-color: rgba(107,30,30,.18);}

.kpi-strip{
  display:grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  margin: 22px 0 28px;
  border: 0.5px solid var(--rule); border-radius: 14px;
  background: rgba(255,255,255,.45);
  overflow: hidden;
}
.kpi{
  padding: 18px 22px;
  border-right: 0.5px solid var(--rule);
  display:flex; flex-direction:column; gap: 4px;
  position: relative;
}
.kpi:last-child{border-right: 0;}
.kpi .lbl{font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3);}
.kpi .val{font-family: var(--serif); font-size: 42px; line-height: 1; letter-spacing: -0.02em;}
.kpi .val.small{font-size: 32px;}
.kpi .val .cur{font-size: 18px; color: var(--ink-3); margin-right: 3px; font-style: italic;}
.kpi .delta{font-size: 11.5px; color: var(--leaf); font-family: var(--mono);}
.kpi.alert .val{color: var(--claret);}
.kpi .spark{position: absolute; right: 18px; bottom: 18px; width: 64px; height: 22px; opacity:.55;}

.filter-row{display:flex; align-items:center; gap: 8px; margin: 0 0 16px;}
.seg{display:flex; align-items:center; padding: 3px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2); border-radius: 10px;}
.seg button{
  appearance: none; border: 0; background: transparent;
  padding: 6px 14px; border-radius: 7px;
  font-size: 12.5px; color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: background .12s, color .12s;
}
.seg button:hover{color: var(--ink);}
.seg button.on{background: white; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.06);}
.seg button .c{font-family: var(--mono); font-size: 10.5px; color: var(--ink-4);}
.seg button.on .c{color: var(--ink-3);}
.filter-row .spacer{flex:1;}

.chip{
  display:flex; align-items:center; gap: 6px;
  height: 30px; padding: 0 10px;
  border: 0.5px solid var(--rule-2); border-radius: 8px;
  background: rgba(255,255,255,.5); color: var(--ink-2);
  font-size: 12.5px; cursor: pointer;
}
.chip:hover{background: rgba(255,255,255,.85);}

/* Featured draft card — same chrome as jobs/events */
.featured-card{
  margin: 0 0 18px;
  display: grid; grid-template-columns: 1.1fr 1fr;
  border: 0.5px solid var(--rule);
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #f8f3e8, #f0e8d4);
  position: relative;
}
.featured-card .left{padding: 26px 28px; display:flex; flex-direction:column; gap: 8px;}
.featured-card .eyebrow{display:flex; align-items:center; gap: 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--claret); font-weight: 500;}
.featured-card .eyebrow .star{display:grid; place-items:center; width: 16px; height: 16px; color: var(--claret);}
.featured-card h2{font-family: var(--serif); font-size: 38px; line-height: 1.0; letter-spacing: -0.015em; margin: 4px 0 6px; font-weight: 400;}
.featured-card .desc{font-size: 13.5px; color: var(--ink-2); max-width: 40ch;}
.featured-card .meta{display: flex; gap: 22px; margin-top: 18px;}
.featured-card .meta div{display:flex; flex-direction:column; gap:1px;}
.featured-card .meta b{font-family: var(--serif); font-size: 26px; line-height: 1; letter-spacing: -0.01em;}
.featured-card .meta span{font-size: 11px; color: var(--ink-3); letter-spacing: .03em; text-transform: uppercase;}
.featured-card .right{
  position: relative;
  background: var(--ink);
  color: var(--paper);
  padding: 26px 28px;
  display:flex; flex-direction:column; justify-content: space-between;
}
.featured-card .right h3{font-family: var(--serif); font-size: 24px; line-height: 1.1; font-weight: 400; margin: 0; max-width: 22ch;}
.featured-card .right .timeline{display:flex; flex-direction:column; gap: 6px; margin: 22px 0;}
.featured-card .right .tl{display:flex; align-items:center; gap: 10px; font-size: 12.5px;}
.featured-card .right .tl .d{width:14px; height:14px; border-radius:50%; border: 1px solid rgba(250,247,242,.4);}
.featured-card .right .tl.done .d{background: var(--paper); border-color: var(--paper);}
.featured-card .right .tl.now .d{border-color: var(--paper); box-shadow: 0 0 0 4px rgba(250,247,242,.12);}
.featured-card .right .tl .when{margin-left:auto; font-family: var(--mono); font-size: 11px; color: rgba(250,247,242,.55);}
.featured-card .right button{
  appearance:none; border: 0.5px solid rgba(250,247,242,.25);
  background: rgba(250,247,242,.08); color: var(--paper);
  padding: 10px 16px; border-radius: 8px;
  font-size: 13px; cursor: pointer;
  display:flex; align-items:center; gap: 10px; align-self: flex-start;
}
.featured-card .right button:hover{background: rgba(250,247,242,.16);}

/* Products list — 7-column table */
.shop-list{display:flex; flex-direction:column; gap: 0;}
.shop-list-head{
  display:grid; grid-template-columns: 48px 1.6fr 0.8fr 0.7fr 0.85fr 0.7fr 0.45fr;
  gap: 12px;
  padding: 0 16px 8px;
  font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4);
}
.product-row{
  display:grid; grid-template-columns: 48px 1.6fr 0.8fr 0.7fr 0.85fr 0.7fr 0.45fr;
  align-items:center; gap: 12px;
  padding: 14px 16px;
  border-top: 0.5px solid var(--rule);
  transition: background .12s;
  cursor: pointer; position: relative;
}
.product-row:last-child{border-bottom: 0.5px solid var(--rule);}
.product-row:hover{background: rgba(255,255,255,.55);}

/* Product thumb — uses the same pattern palette as the phone hero */
.prod-thumb{
  width: 48px; height: 56px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: var(--ink);
}
.prod-thumb.p1{background: linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%);}
.prod-thumb.p2{background: linear-gradient(135deg, #2a4a7a 0%, #15263c 100%);}
.prod-thumb.p3{background: linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%);}
.prod-thumb.p4{background: linear-gradient(135deg, #b08a3e 0%, #6a5118 100%);}
.prod-thumb.p5{background: linear-gradient(180deg, #29261b 0%, #100e09 100%);}
.prod-thumb svg{position: absolute; inset: 0; width: 100%; height: 100%; opacity: .3;}
.prod-thumb .crest{
  position:absolute; right: 4px; bottom: 3px;
  font-size: 9px; color: rgba(255,255,255,.85);
  font-family: var(--serif);
}

.product-row .title-cell{display:flex; flex-direction:column; min-width:0; gap: 3px;}
.product-row .title-cell .t{
  font-weight: 500; font-size: 14.5px; letter-spacing: -0.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.product-row .title-cell .sub{font-size: 12px; color: var(--ink-3); display:flex; align-items:center; gap: 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.product-row .title-cell .lang{font-family: var(--mono); font-size: 9.5px; color: var(--ink-4); padding: 1px 4px; border: 0.5px solid var(--rule-2); border-radius: 3px;}
.product-row .vbadge{
  display: inline-flex; align-items:center; gap: 3px;
  font-size: 10px; padding: 1px 6px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  color: var(--ink-3); font-family: var(--mono);
}

.cat-cell{display:flex; align-items:center; gap: 8px; font-size: 13px;}
.cat-cell .crest{
  width: 22px; height: 22px; border-radius: 6px;
  display:grid; place-items:center;
  font-family: var(--serif); font-size: 12px;
  background: var(--paper-2); color: var(--ink-2);
  border: 0.5px solid var(--rule-2);
}

/* Status pills — extends the shared definition */
.status.published{color: var(--leaf); background: rgba(47,93,58,.06); border-color: rgba(47,93,58,.18);}
.status.published .pulse{background: var(--leaf); animation: pulse 2s infinite;}
.status.draft{color: #6a5118; background: rgba(176,138,62,.08); border-color: rgba(176,138,62,.22);}
.status.draft .pulse{background: var(--gold);}
.status.pending_approval, .status.pending{color: var(--sky); background: rgba(42,74,122,.06); border-color: rgba(42,74,122,.22);}
.status.pending_approval .pulse, .status.pending .pulse{background: var(--sky);}
.status.archived{color: var(--ink-4);}
.status.archived .pulse{background: var(--ink-4);}
.status.authorized{color: #6a5118; background: rgba(176,138,62,.08); border-color: rgba(176,138,62,.22);}
.status.authorized .pulse{background: var(--gold); animation: pulse 1.5s infinite;}
.status.paid{color: var(--leaf); background: rgba(47,93,58,.06); border-color: rgba(47,93,58,.18);}
.status.paid .pulse{background: var(--leaf);}
.status.failed{color: var(--claret); background: rgba(107,30,30,.06); border-color: rgba(107,30,30,.2);}
.status.failed .pulse{background: var(--claret);}
.status.refunded{color: var(--ink-3); background: var(--paper-2);}
.status.refunded .pulse{background: var(--ink-4);}
.status.cancelled{color: var(--claret); background: rgba(107,30,30,.06); border-color: rgba(107,30,30,.2); text-decoration: line-through;}

/* Price cell */
.price-cell{display:flex; flex-direction: column; gap: 1px; font-size: 12.5px;}
.price-cell .reg{font-family: var(--mono); color: var(--ink); font-weight: 500;}
.price-cell .mem{font-size: 10.5px; color: var(--leaf); font-family: var(--mono);}
.price-cell .range{font-family: var(--mono); font-size: 12px; color: var(--ink);}

/* Stock cell with low-stock dot */
.stock-cell{display:flex; flex-direction: column; gap: 4px; font-size: 12px; min-width: 0;}
.stock-cell .row{display:flex; align-items:center; gap: 6px;}
.stock-cell .num{font-family: var(--mono); font-weight: 500;}
.stock-cell .dot{width: 6px; height: 6px; border-radius: 50%; background: var(--ink-4); flex-shrink:0;}
.stock-cell .dot.low{background: var(--claret); animation: pulse 1.8s infinite;}
.stock-cell .dot.ok{background: var(--leaf);}
.stock-cell .dot.out{background: var(--ink-4); animation: none;}
.stock-cell .sub{font-size: 10.5px; color: var(--ink-3);}
.stock-cell .bar{height: 3px; background: var(--paper-3); border-radius: 999px; overflow:hidden;}
.stock-cell .bar i{display:block; height: 100%; background: var(--ink);}
.stock-cell .bar.low i{background: var(--claret);}
.stock-cell .bar.out i{background: var(--ink-4);}

/* Sales cell with mini sparkline */
.sales-cell{display:flex; align-items:center; gap: 8px; font-size: 12.5px;}
.sales-cell .num{font-family: var(--mono); font-weight: 500;}
.sales-cell svg{opacity: .55;}

.row-actions{display:flex; align-items: center; gap: 4px; justify-content: flex-end; opacity: 0; transition: opacity .15s;}
.product-row:hover .row-actions, .order-row:hover .row-actions{opacity: 1;}
.row-actions button{
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border: 0.5px solid var(--rule-2); border-radius: 7px;
  background: rgba(255,255,255,.7); color: var(--ink-2);
  cursor: pointer;
}
.row-actions button:hover{color: var(--ink); background: white;}

/* ============================================================
   Orders inbox
   ============================================================ */
.orders-list{display:flex; flex-direction:column; gap: 0;}
.orders-list-head{
  display:grid; grid-template-columns: 110px 1.4fr 1.5fr 0.7fr 0.85fr 0.4fr;
  gap: 12px;
  padding: 0 16px 8px;
  font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4);
}
.order-row{
  display:grid; grid-template-columns: 110px 1.4fr 1.5fr 0.7fr 0.85fr 0.4fr;
  align-items:center; gap: 12px;
  padding: 14px 16px;
  border-top: 0.5px solid var(--rule);
  cursor: pointer; transition: background .12s;
}
.order-row:last-child{border-bottom: 0.5px solid var(--rule);}
.order-row:hover{background: rgba(255,255,255,.55);}
.order-row .ref{font-family: var(--mono); font-size: 12px; color: var(--ink);
  display: flex; flex-direction: column; gap: 2px;}
.order-row .ref .when{font-size: 10.5px; color: var(--ink-3); font-family: var(--mono);}

.order-row .buyer{display:flex; align-items:center; gap: 10px; min-width:0;}
.order-row .buyer .av{
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, var(--claret), #c05a3f);
  color: white; display: grid; place-items: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
}
.order-row .buyer .av.guest{background: linear-gradient(135deg, #6b6357, #9c9385);}
.order-row .buyer .meta{display:flex; flex-direction:column; gap: 1px; min-width:0;}
.order-row .buyer .name{font-size: 13.5px; font-weight: 500; white-space: nowrap; overflow:hidden; text-overflow:ellipsis;}
.order-row .buyer .em{font-size: 11px; color: var(--ink-3); white-space: nowrap; overflow:hidden; text-overflow:ellipsis;}
.order-row .buyer .badge{
  font-size: 9.5px; padding: 1px 5px; border-radius: 999px;
  background: rgba(176,138,62,.12); color: #6a5118;
  border: 0.5px solid rgba(176,138,62,.3);
  letter-spacing: .04em;
}
.order-row .items-cell{display:flex; flex-direction:column; gap: 3px; min-width:0;}
.order-row .items-cell .ln{font-size: 12.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.order-row .items-cell .ln .qty{font-family: var(--mono); color: var(--ink-3); margin-right: 6px;}
.order-row .items-cell .ln .v{color: var(--ink-3); font-size: 11.5px;}
.order-row .items-cell .more{font-size: 11px; color: var(--ink-4);}

.order-row .total{display:flex; flex-direction:column; gap: 1px;}
.order-row .total .amt{font-family: var(--mono); font-size: 14px; font-weight: 500; color: var(--ink);}
.order-row .total .disc{font-size: 10.5px; color: var(--leaf); font-family: var(--mono);}

/* Inbox empty / footer helpers */
.empty-row{padding: 48px 16px; text-align: center; color: var(--ink-4); font-style: italic; border-top: 0.5px solid var(--rule);}
`;

function ShopSpark({ data, color = "currentColor", w = 64, h = 22 }) {
  const max = Math.max(...data, 1);
  const step = w / Math.max(1, data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width={w} height={h}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ShopKpi({ label, value, delta, alert, spark, currency }) {
  return (
    <div className={"kpi" + (alert ? " alert" : "")}>
      <div className="lbl">{label}</div>
      <div className="val">{currency && <span className="cur">kr</span>}{value}</div>
      {delta && <div className="delta">{delta}</div>}
      {spark && <ShopSpark data={spark} color={alert ? "var(--claret)" : "var(--ink-3)"} />}
    </div>
  );
}

function ShopStatusPill({ s }) {
  const labels = { pending_approval: "pending review" };
  return <span className={"status " + s}><span className="pulse"></span>{labels[s] || s}</span>;
}

function FeaturedProductDraftCard({ onResume }) {
  return (
    <div className="featured-card">
      <div className="left">
        <div className="eyebrow"><span className="star"><I.spark2 size={12} /></span> Pick up where you left off</div>
        <h2>Fadderuke '26 — <em style={{ fontStyle: "italic", color: "var(--claret)" }}>three variants ready</em></h2>
        <div className="desc">Description and the three pass tiers are in. We still need a hero photo from last year's opening night, and the linked event needs to come out of draft.</div>
        <div className="meta">
          <div><b>3</b><span>Variants</span></div>
          <div><b>72%</b><span>Complete</span></div>
          <div><b>14w</b><span>Until on sale</span></div>
        </div>
      </div>
      <div className="right">
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(250,247,242,.55)", marginBottom: 8 }}>Publishing checklist</div>
          <h3>Five steps from draft to a QR-coded ticket.</h3>
        </div>
        <div className="timeline">
          <div className="tl done"><span className="d"></span> Title, category, host <span className="when">✓</span></div>
          <div className="tl done"><span className="d"></span> Description (EN + NO) <span className="when">✓</span></div>
          <div className="tl done"><span className="d"></span> Three variants priced <span className="when">✓</span></div>
          <div className="tl now"><span className="d"></span> Hero photo + gallery <span className="when">now</span></div>
          <div className="tl"><span className="d"></span> Link event & publish <span className="when">—</span></div>
        </div>
        <button onClick={onResume}>Resume composer <I.arrow size={14} /></button>
      </div>
    </div>
  );
}

function ProductThumb({ image, crest }) {
  return (
    <div className={"prod-thumb " + image}>
      <svg viewBox="0 0 48 56" preserveAspectRatio="none">
        <defs>
          <pattern id={"pt-" + image} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="white"/>
          </pattern>
        </defs>
        <rect width="48" height="56" fill={"url(#pt-" + image + ")"}/>
      </svg>
      <span className="crest">{crest}</span>
    </div>
  );
}

function ProductRow({ p, onOpen }) {
  const cat = prodCat(p.category) || { name: "—", crest: "?" };
  const d = dept(p.department);
  const total = totalStock(p);
  const low = lowestVariant(p);
  const isLow = total > 0 && total <= (p.lowStockThreshold || 10);
  const isOut = total === 0;
  const stockClass = isOut ? "out" : isLow ? "low" : "ok";
  const fillRatio = Math.min(total / Math.max(50, (p.lowStockThreshold || 10) * 5), 1);

  return (
    <div className="product-row" onClick={onOpen}>
      <ProductThumb image={p.image} crest={d?.crest || "·"} />
      <div className="title-cell">
        <div className="t">
          {p.titleEn}
          {p.variants?.length > 0 && (
            <span className="vbadge" style={{ marginLeft: 8 }}><I.layers size={9}/> {p.variants.length}</span>
          )}
          {p.memberOnly && (
            <span className="vbadge" style={{ marginLeft: 6, color: "#6a5118", borderColor: "rgba(176,138,62,.3)", background: "rgba(176,138,62,.08)" }}><I.lock size={9}/> members</span>
          )}
        </div>
        <div className="sub">
          <span className="lang">NO</span>
          {p.titleNo}
        </div>
      </div>
      <div className="cat-cell">
        <span className="crest">{cat.crest}</span>
        {cat.name}
      </div>
      <div><ShopStatusPill s={p.status} /></div>
      <div className="price-cell">
        <span className="reg">{priceRange(p)}</span>
        {p.memberPrice > 0 && p.memberPrice < p.regularPrice && (
          <span className="mem">{fmtNOK(p.memberPrice)} memb.</span>
        )}
      </div>
      <div className="stock-cell">
        <div className="row">
          <span className={"dot " + stockClass}></span>
          <span className="num">{total}</span>
          {low && low.stock === 0 && <span className="sub">· {low.name} out</span>}
          {low && low.stock > 0 && isLow && <span className="sub">· low</span>}
        </div>
        <div className={"bar " + stockClass}><i style={{ width: `${fillRatio * 100}%` }}></i></div>
      </div>
      <div className="row-actions">
        <button title="Preview"><I.eye size={14}/></button>
        <button title="Duplicate"><I.copy size={14}/></button>
        <button title="More"><I.drag size={14}/></button>
      </div>
    </div>
  );
}

function CatalogTab({ onCompose, onOpenProduct }) {
  const [filter, setFilter] = React.useState("all");
  const counts = {
    all: SAMPLE_PRODUCTS.length,
    published: SAMPLE_PRODUCTS.filter(p => p.status === "published").length,
    draft: SAMPLE_PRODUCTS.filter(p => p.status === "draft").length,
    pending_approval: SAMPLE_PRODUCTS.filter(p => p.status === "pending_approval").length,
    archived: SAMPLE_PRODUCTS.filter(p => p.status === "archived").length,
  };
  const visible = filter === "all" ? SAMPLE_PRODUCTS : SAMPLE_PRODUCTS.filter(p => p.status === filter);

  return (
    <React.Fragment>
      <div className="kpi-strip">
        <ShopKpi label="Live products" value="6" delta="+1 this week" spark={[3,3,4,5,5,5,6,6]} />
        <ShopKpi label="Revenue · last 30d" value="48 240" currency delta="+18% vs prev. month" spark={[20,28,30,34,36,40,44,48]} />
        <ShopKpi label="Avg. order value" value="312" currency delta="kr +24 vs last month" spark={[260,270,275,288,295,300,305,312]} />
        <ShopKpi label="Low or out of stock" value="3" alert delta="2 SKUs at zero" />
      </div>

      <FeaturedProductDraftCard onResume={onCompose} />

      <div className="filter-row">
        <div className="seg">
          {[
            ["all", "All"],
            ["published", "Published"],
            ["draft", "Drafts"],
            ["pending_approval", "Pending"],
            ["archived", "Archived"],
          ].map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label} <span className="c">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <button className="chip"><I.filter size={13}/> Category</button>
        <button className="chip"><I.map size={13}/> Campus: Oslo</button>
        <button className="chip"><I.clock size={13}/> Last 30 days</button>
      </div>

      <div className="shop-list">
        <div className="shop-list-head">
          <div></div>
          <div>Product</div>
          <div>Category</div>
          <div>Status</div>
          <div>Price</div>
          <div>Stock</div>
          <div></div>
        </div>
        {visible.map(p => <ProductRow key={p.id} p={p} onOpen={onOpenProduct} />)}
        {visible.length === 0 && <div className="empty-row">Nothing here yet.</div>}
      </div>
    </React.Fragment>
  );
}

// ----------------------------------------------------------------------------
// Orders inbox
// ----------------------------------------------------------------------------
function OrderRow({ o }) {
  const initials = o.buyer.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const itemCount = o.items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="order-row">
      <div className="ref">
        <span>{o.ref}</span>
        <span className="when">{fmtOrderDate(o.placedAt)}</span>
      </div>
      <div className="buyer">
        <div className={"av" + (o.isMember ? "" : " guest")}>{initials}</div>
        <div className="meta">
          <span className="name">
            {o.buyer}
            {o.isMember && <span className="badge" style={{ marginLeft: 6 }}>MEMBER</span>}
          </span>
          <span className="em">{o.email}</span>
        </div>
      </div>
      <div className="items-cell">
        {o.items.slice(0, 2).map((it, i) => (
          <div key={i} className="ln">
            <span className="qty">×{it.qty}</span>
            {it.name}
            {it.variant && it.variant !== "—" && <span className="v"> · {it.variant}</span>}
          </div>
        ))}
        {o.items.length > 2 && <div className="more">+{o.items.length - 2} more items</div>}
        <div className="more">{itemCount} item{itemCount === 1 ? "" : "s"} · {o.fulfillment}</div>
      </div>
      <div className="total">
        <span className="amt">{fmtNOK(o.total)}</span>
        {o.memberDiscount > 0 && <span className="disc">−{fmtNOK(o.memberDiscount)} member</span>}
      </div>
      <div><ShopStatusPill s={o.status} /></div>
      <div className="row-actions">
        <button title="View"><I.eye size={14}/></button>
        {o.paid && o.status === "paid" && <button title="Refund"><I.refund size={14}/></button>}
        <button title="More"><I.drag size={14}/></button>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [filter, setFilter] = React.useState("all");

  const counts = {
    all: SAMPLE_ORDERS.length,
    paid: SAMPLE_ORDERS.filter(o => o.status === "paid").length,
    pending: SAMPLE_ORDERS.filter(o => o.status === "pending" || o.status === "authorized").length,
    refunded: SAMPLE_ORDERS.filter(o => o.status === "refunded").length,
    failed: SAMPLE_ORDERS.filter(o => o.status === "failed" || o.status === "cancelled").length,
  };
  const visible = filter === "all" ? SAMPLE_ORDERS :
                  filter === "pending" ? SAMPLE_ORDERS.filter(o => o.status === "pending" || o.status === "authorized") :
                  filter === "failed" ? SAMPLE_ORDERS.filter(o => o.status === "failed" || o.status === "cancelled") :
                  SAMPLE_ORDERS.filter(o => o.status === filter);

  // KPI calculations (snapshot)
  const todayCount = 4;
  const awaitingPayment = counts.pending;
  const refundsPending = 1;
  const aov = Math.round(SAMPLE_ORDERS.reduce((s, o) => s + o.total, 0) / SAMPLE_ORDERS.length);

  return (
    <React.Fragment>
      <div className="kpi-strip">
        <ShopKpi label="Orders today" value={todayCount} delta="+1 in last hour" spark={[1,2,2,3,3,3,4,4]} />
        <ShopKpi label="Awaiting payment" value={awaitingPayment} alert={awaitingPayment > 0} delta="Authorized but unpaid" />
        <ShopKpi label="Refunds pending" value={refundsPending} alert={refundsPending > 0} delta="Manual review needed" />
        <ShopKpi label="Avg. order value" value={aov} currency delta="Last 30 days" spark={[180,210,240,260,275,290,300,aov]} />
      </div>

      <div className="filter-row">
        <div className="seg">
          {[
            ["all", "All"],
            ["paid", "Paid"],
            ["pending", "Awaiting"],
            ["refunded", "Refunded"],
            ["failed", "Failed"],
          ].map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label} <span className="c">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <button className="chip"><I.filter size={13}/> Product</button>
        <button className="chip"><I.events size={13}/> Date range</button>
        <button className="chip"><I.upload size={13}/> Export CSV</button>
      </div>

      <div className="orders-list">
        <div className="orders-list-head">
          <div>Reference</div>
          <div>Customer</div>
          <div>Line items</div>
          <div>Total</div>
          <div>Status</div>
          <div></div>
        </div>
        {visible.map(o => <OrderRow key={o.id} o={o} />)}
        {visible.length === 0 && <div className="empty-row">No orders in this view.</div>}
      </div>
    </React.Fragment>
  );
}

function ShopDashboard({ onCompose, onOpenProduct }) {
  const [tab, setTab] = React.useState("catalog"); // "catalog" | "orders"

  return (
    <div className="dash scroll">
      <div className="dash-head">
        <div>
          <h1>Shop floor <em>this term.</em></h1>
          <p>Six products live, three running low. Vinterball tickets need a restock; the Fadderuke bundle is still in draft.</p>
        </div>
        <button className="compose-btn" onClick={onCompose}>
          <span className="plus"><I.plus size={14} /></span>
          Compose new product
        </button>
      </div>

      <div className="shop-tabs">
        <button className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>
          <I.box size={14}/> Catalog <span className="c">{SAMPLE_PRODUCTS.length}</span>
        </button>
        <button className={"alert " + (tab === "orders" ? "on" : "")} onClick={() => setTab("orders")}>
          <I.cart size={14}/> Orders <span className="c">{SAMPLE_ORDERS.filter(o => o.status === "pending" || o.status === "authorized").length} new</span>
        </button>
        <button>
          <I.spark2 size={14}/> Insights <span className="c">soon</span>
        </button>
      </div>

      {tab === "catalog" && <CatalogTab onCompose={onCompose} onOpenProduct={onOpenProduct} />}
      {tab === "orders" && <OrdersTab />}
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = shopDashCSS; document.head.appendChild(s); })();
window.ShopDashboard = ShopDashboard;
