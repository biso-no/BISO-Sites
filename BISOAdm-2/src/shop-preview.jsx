// Live preview pane for the webshop — phone product page with image gallery,
// member-price toggle, variant picker, and an Add-to-cart CTA.

const shopPreviewCSS = `
.preview-pane{
  flex: 1; min-width: 0;
  background: linear-gradient(180deg, #efe7d4 0%, #e6dcc2 100%);
  position: relative;
  display: flex; flex-direction: column;
  overflow: hidden;
  border-left: 0.5px solid var(--rule);
}
.preview-pane::before{
  content:""; position: absolute; inset: 0;
  background-image:
    radial-gradient(circle at 30% 20%, rgba(107,30,30,0.05), transparent 50%),
    radial-gradient(circle at 70% 80%, rgba(176,138,62,0.06), transparent 55%);
  pointer-events: none;
}
.preview-head{
  display:flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--rule);
  background: rgba(250,247,242,.5);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  position: relative; z-index: 2;
  font-size: 12.5px;
  flex-wrap: nowrap; overflow: hidden;
}
.preview-head .live, .preview-head .label{flex-shrink: 0; white-space: nowrap;}
.preview-head .live{display:flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--leaf); font-weight: 500;}
.preview-head .live i{width:6px; height:6px; border-radius:50%; background: var(--leaf); animation: pulse 1.8s infinite;}
.preview-head .label{font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;}
.preview-head .spacer{flex:1}
.preview-head .viewport-seg{display:flex; padding: 2px; flex-shrink:0;
  background: rgba(255,255,255,.5);
  border: 0.5px solid var(--rule-2); border-radius: 7px;}
.preview-head .viewport-seg button{appearance:none; border: 0; background: transparent;
  width: 28px; height: 22px;
  display:grid; place-items: center;
  border-radius: 5px; color: var(--ink-3); cursor: pointer;}
.preview-head .viewport-seg button.on{background: white; color: var(--ink);}

.stage{flex: 1; min-height: 0; position: relative;
  display:flex; align-items: center; justify-content: center; padding: 24px;}
.phone{
  width: 314px; height: 640px;
  background: var(--ink);
  border-radius: 38px; padding: 7px;
  box-shadow:
    0 0 0 0.5px rgba(0,0,0,.15),
    0 30px 60px -20px rgba(26,24,20,.45),
    0 8px 20px rgba(26,24,20,.18),
    inset 0 0 0 0.5px rgba(255,255,255,.06);
  position: relative;
  animation: drift 8s ease-in-out infinite;
}
.phone-notch{position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 26px; background: #000; border-radius: 14px; z-index: 10;}
.phone-screen{
  width: 100%; height: 100%;
  background: var(--paper);
  border-radius: 30px; overflow: hidden;
  position: relative;
  display: flex; flex-direction: column;
}
.phone-status{
  display:flex; align-items: center; justify-content: space-between;
  padding: 12px 20px 6px;
  font-size: 11px; font-weight: 600; color: var(--ink);
}
.phone-status .right{display:flex; align-items:center; gap: 4px;}
.phone-status .bars{display:flex; gap: 1.5px; align-items: flex-end;}
.phone-status .bars i{width: 2.5px; background: var(--ink); border-radius: 1px;}
.phone-status .bars i:nth-child(1){height: 3px}
.phone-status .bars i:nth-child(2){height: 5px}
.phone-status .bars i:nth-child(3){height: 7px}
.phone-status .bars i:nth-child(4){height: 9px}
.phone-status .batt{width: 22px; height: 10px; border-radius: 3px; border: 1px solid var(--ink); position: relative;}
.phone-status .batt::after{content:""; position: absolute; right: -2px; top: 3px; width: 1.5px; height: 4px; background: var(--ink); border-radius: 0 1px 1px 0;}
.phone-status .batt i{display:block; height: 100%; width: 70%; background: var(--ink); border-radius: 1.5px;}

.phone-nav{
  display:flex; align-items: center; gap: 8px;
  padding: 4px 14px 10px;
  font-size: 12.5px; color: var(--ink-3);
}
.phone-nav .back{
  width: 28px; height: 28px; display:grid; place-items: center;
  background: var(--paper-2); border-radius: 50%;
}
.phone-nav .icon-r{
  width: 28px; height: 28px; display:grid; place-items:center;
  background: var(--paper-2); border-radius: 50%; margin-left: auto; position: relative;
}
.phone-nav .icon-r .pill{
  position:absolute; top: -3px; right: -3px;
  min-width: 14px; height: 14px; border-radius: 999px;
  background: var(--claret); color: white;
  font-size: 9px; font-family: var(--mono);
  padding: 0 4px;
  display: grid; place-items: center;
}

.phone-scroll{flex: 1; overflow: hidden; position: relative;}
.phone-scroll .fade{position: absolute; left: 0; right: 0; bottom: 0; height: 50px;
  background: linear-gradient(180deg, transparent, var(--paper)); pointer-events:none; z-index: 5;}

/* Product hero — image gallery with paging dots */
.prod-hero{
  height: 220px;
  position: relative;
  overflow: hidden;
}
.prod-hero .slide{position: absolute; inset: 0;}
.prod-hero .slide.p1{background: linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%);}
.prod-hero .slide.p2{background: linear-gradient(135deg, #2a4a7a 0%, #15263c 100%);}
.prod-hero .slide.p3{background: linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%);}
.prod-hero .slide.p4{background: linear-gradient(135deg, #b08a3e 0%, #6a5118 100%);}
.prod-hero .slide.p5{background: linear-gradient(180deg, #29261b 0%, #100e09 100%);}
.prod-hero .slide svg{position: absolute; inset: 0; width: 100%; height: 100%; opacity: .35;}
.prod-hero .badges{position: absolute; left: 12px; top: 12px; display:flex; gap: 6px;}
.prod-hero .badge{
  font-size: 9px; padding: 3px 8px; border-radius: 999px;
  background: rgba(255,255,255,.18); color: white;
  letter-spacing: .08em; text-transform: uppercase;
  border: 0.5px solid rgba(255,255,255,.25);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.prod-hero .crest{
  position: absolute; right: 12px; bottom: 12px;
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(255,255,255,.95);
  color: var(--ink);
  display:grid; place-items: center;
  font-family: var(--serif); font-size: 22px;
}
.prod-hero .dots{
  position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);
  display: flex; gap: 5px; z-index: 4;
}
.prod-hero .dots i{
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,.4);
  transition: background .2s, width .2s;
}
.prod-hero .dots i.on{background: white; width: 14px; border-radius: 999px;}

.prod-body{padding: 14px 16px 8px; display:flex; flex-direction: column; gap: 10px;}
.prod-meta{
  display:flex; align-items: center; gap: 8px;
  font-size: 10.5px; color: var(--ink-3);
  letter-spacing: .03em;
}
.prod-meta .dot{width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4);}
.prod-meta .cat{display:inline-flex; align-items:center; gap: 4px;
  font-size: 10px; padding: 1px 7px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2); color: var(--ink-2);}

.prod-title{
  font-family: var(--serif); font-size: 22px; line-height: 1.1;
  letter-spacing: -0.012em; font-weight: 400;
  color: var(--ink);
  min-height: 24px;
}
.prod-title em{font-style: italic; color: var(--claret);}
.prod-title .caret{display: inline-block; width: 1px; height: 0.9em; background: var(--claret); vertical-align: -2px; margin-left: 1px; animation: caret 1s steps(2) infinite;}

.prod-short{font-size: 12px; color: var(--ink-2); line-height: 1.45;}

.prod-tags{display:flex; gap: 4px; flex-wrap: wrap;}
.prod-tag{font-size: 9.5px; padding: 3px 7px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  color: var(--ink-2);}

/* Price block */
.prod-price{
  display:flex; align-items: baseline; gap: 10px;
  padding: 10px 0 6px;
  border-top: 0.5px solid var(--rule);
  border-bottom: 0.5px solid var(--rule);
  margin: 4px 0 0;
}
.prod-price .now{font-family: var(--serif); font-size: 28px; line-height: 1; color: var(--ink); letter-spacing: -0.015em;}
.prod-price .strike{font-family: var(--mono); font-size: 12px; color: var(--ink-4); text-decoration: line-through;}
.prod-price .mem-tag{
  display:inline-flex; align-items: center; gap: 3px;
  font-size: 9.5px; padding: 2px 7px; border-radius: 999px;
  background: rgba(47,93,58,.1); color: var(--leaf);
  border: 0.5px solid rgba(47,93,58,.25);
}
.prod-price .stock-tag{
  margin-left: auto;
  font-size: 9.5px; color: var(--ink-3);
  display:flex; align-items: center; gap: 4px;
}
.prod-price .stock-tag .d{width:5px; height:5px; border-radius:50%; background: var(--leaf);}
.prod-price .stock-tag.low .d{background: var(--claret); animation: pulse 1.8s infinite;}
.prod-price .stock-tag.low{color: var(--claret);}

/* Variant picker */
.prod-variants{
  display:flex; flex-direction: column; gap: 6px;
  margin-top: 2px;
}
.prod-variants .hdr{font-size: 10px; color: var(--ink-3); letter-spacing: .08em; text-transform: uppercase;}
.prod-variants .pills{display: flex; flex-direction: column; gap: 5px;}
.prod-variants .var-pill{
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 8px;
  border: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.6);
  font-size: 11.5px;
  cursor: pointer;
}
.prod-variants .var-pill.on{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.prod-variants .var-pill.out{opacity: .5; text-decoration: line-through;}
.prod-variants .var-pill .name{flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;}
.prod-variants .var-pill .price{font-family: var(--mono); font-feature-settings: "tnum" 1;}
.prod-variants .var-pill.on .stock{color: rgba(250,247,242,.6);}
.prod-variants .var-pill .stock{font-size: 9.5px; color: var(--ink-4);}

/* Description sections */
.prod-body h4{font-family: var(--serif); font-size: 15px; line-height: 1.2; margin: 6px 0 0; font-weight: 400; color: var(--ink);}
.prod-body p{margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--ink-2);}
.prod-body ul{margin: 2px 0 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 4px;}
.prod-body ul li{font-size: 11.5px; line-height: 1.45; color: var(--ink-2); padding-left: 14px; position: relative;}
.prod-body ul li::before{content:""; position: absolute; left: 0; top: 7px; width: 5px; height: 1px; background: var(--claret);}

/* Bottom CTA */
.prod-cta{
  padding: 10px 14px 14px;
  background: rgba(250,247,242,.85);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border-top: 0.5px solid var(--rule);
  display: flex; gap: 8px;
}
.prod-cta .heart{
  width: 44px; height: 44px; border-radius: 12px;
  border: 0.5px solid var(--rule-2);
  display: grid; place-items: center;
  background: white; color: var(--ink-3);
  flex-shrink: 0;
}
.prod-cta button.add{
  appearance: none; border: 0; flex: 1;
  padding: 11px;
  background: var(--ink); color: var(--paper);
  border-radius: 12px; font-size: 12.5px; font-weight: 500;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.prod-cta button.add .price-tag{
  font-family: var(--mono); padding: 2px 8px; border-radius: 999px;
  background: rgba(255,255,255,.15); color: rgba(255,255,255,.85);
  font-size: 11px;
}

.preview-flash{position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at 50% 35%, rgba(107,30,30,0.15), transparent 60%);
  opacity: 0; transition: opacity .2s;}
.preview-flash.on{opacity: 1;}

.preview-foot{
  padding: 10px 18px;
  border-top: 0.5px solid var(--rule);
  background: rgba(250,247,242,.6);
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; color: var(--ink-3);
  position: relative; z-index: 2;
}
.preview-foot .audience{display:flex; align-items:center; gap: 6px;}
.preview-foot .audience b{font-family: var(--mono); color: var(--ink); font-weight: 600;}
`;

function PhoneProduct({ draft, locale, animateFlash }) {
  const d = dept(draft.department);
  const c = campus(draft.campus);
  const cat = prodCat(draft.category) || {};
  const title = locale === "no" ? draft.titleNo : draft.titleEn;
  const short = locale === "no" ? draft.shortNo : draft.shortEn;
  const desc = draft.descEn;
  const photos = draft.photos || [];

  // First in-stock variant is default; user can flip in preview
  const variants = draft.variants || [];
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  React.useEffect(() => {
    if (selectedIdx >= variants.length) setSelectedIdx(0);
  }, [variants.length]);
  const selected = variants[selectedIdx];

  // Show member or regular price based on locale toggle context (we just pick member here)
  const [showMember, setShowMember] = React.useState(true);

  const displayPrice = selected
    ? (showMember && selected.memberPrice > 0 && selected.memberPrice < selected.price ? selected.memberPrice : selected.price)
    : (showMember && draft.memberPrice > 0 && draft.memberPrice < draft.regularPrice ? draft.memberPrice : draft.regularPrice);
  const regularPrice = selected ? selected.price : draft.regularPrice;
  const isDiscounted = displayPrice < regularPrice;

  const stockCount = selected ? selected.stock : (draft.stock || 0);
  const lowStock = stockCount > 0 && stockCount <= (selected?.lowStock || draft.lowStockThreshold || 10);
  const outOfStock = stockCount === 0 && draft.inventoryMode !== "unlimited";

  const [photoIdx, setPhotoIdx] = React.useState(0);
  const heroPhoto = photos[photoIdx] || photos[0] || { pattern: draft.coverPattern || 1, label: "Hero" };

  return (
    <div className="phone">
      <div className="phone-notch"></div>
      <div className="phone-screen">
        <div className="phone-status">
          <span>09:41</span>
          <div className="right">
            <div className="bars"><i></i><i></i><i></i><i></i></div>
            <div className="batt"><i></i></div>
          </div>
        </div>
        <div className="phone-nav">
          <div className="back"><I.back size={14}/></div>
          <span>Shop</span>
          <div className="icon-r"><I.cart size={14}/><span className="pill">2</span></div>
        </div>
        <div className="phone-scroll scroll">
          {/* Gallery hero */}
          <div className="prod-hero">
            <div className={"slide p" + (heroPhoto.pattern || 1)}>
              <CoverPattern which={heroPhoto.pattern || 1} />
            </div>
            <div className="badges">
              {draft.memberOnly && <div className="badge">Members only</div>}
              {cat.name && <div className="badge">{cat.name}</div>}
            </div>
            <div className="crest">{d?.crest || "B"}</div>
            {photos.length > 1 && (
              <div className="dots">
                {photos.map((_, i) => (
                  <i key={i} className={i === photoIdx ? "on" : ""} onClick={() => setPhotoIdx(i)}></i>
                ))}
              </div>
            )}
          </div>

          <div className="prod-body">
            <div className="prod-meta">
              <span>{d?.name}</span>
              <span className="dot"></span>
              <span>{c?.name}</span>
              {photos.length > 0 && (
                <>
                  <span className="dot"></span>
                  <span style={{ fontFamily: "var(--mono)" }}>{photoIdx + 1} / {photos.length}</span>
                </>
              )}
            </div>

            <div className="prod-title">
              {title || <em style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Your product title…</em>}
              <span className="caret"></span>
            </div>

            <div className="prod-short">{short}</div>

            {draft.tags?.length > 0 && (
              <div className="prod-tags">
                {draft.tags.map((t, i) => <span key={i} className="prod-tag">{t}</span>)}
              </div>
            )}

            {/* Price + stock */}
            <div className="prod-price">
              <span className="now">{fmtNOK(displayPrice)}</span>
              {isDiscounted && <span className="strike">{fmtNOK(regularPrice)}</span>}
              {isDiscounted && <span className="mem-tag" onClick={() => setShowMember(!showMember)}><I.pct size={9}/> Member price</span>}
              {draft.inventoryMode === "unlimited" ? (
                <span className="stock-tag"><span className="d"></span> In stock</span>
              ) : outOfStock ? (
                <span className="stock-tag low"><span className="d"></span> Sold out</span>
              ) : lowStock ? (
                <span className="stock-tag low"><span className="d"></span> Only {stockCount} left</span>
              ) : (
                <span className="stock-tag"><span className="d"></span> {stockCount} in stock</span>
              )}
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="prod-variants">
                <div className="hdr">Pick a variant</div>
                <div className="pills">
                  {variants.map((v, i) => {
                    const out = v.stock === 0;
                    return (
                      <div key={i} className={"var-pill" + (i === selectedIdx ? " on" : "") + (out ? " out" : "")}
                        onClick={() => !out && setSelectedIdx(i)}>
                        <span className="name">{v.name}</span>
                        <span className="stock">{v.stock} left</span>
                        <span className="price">{fmtNOK(showMember && v.memberPrice > 0 && v.memberPrice < v.price ? v.memberPrice : v.price)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description blocks */}
            {desc?.map((b, i) => {
              if (b.type === "h") return <h4 key={i}>{b.text}</h4>;
              if (b.type === "p") return <p key={i}>{b.text}</p>;
              if (b.type === "l") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
              return null;
            })}

            <div style={{ height: 60 }}></div>
          </div>
          <div className="fade"></div>
        </div>

        <div className="prod-cta">
          <div className="heart"><I.benefits size={16}/></div>
          <button className="add" disabled={outOfStock}>
            <I.cart size={14}/>
            {outOfStock ? "Notify me" : "Add to cart"}
            {!outOfStock && <span className="price-tag">{fmtNOK(displayPrice)}</span>}
          </button>
        </div>
        <div className={"preview-flash" + (animateFlash ? " on" : "")}></div>
      </div>
    </div>
  );
}

function ShopPreviewPane({ draft, locale, setLocale, viewport, setViewport, flash }) {
  return (
    <div className="preview-pane">
      <div className="preview-head">
        <span className="live"><i></i> Live preview</span>
        <span className="label">As students see it</span>
        <div className="spacer"></div>
        <div className="viewport-seg">
          <button className={viewport === "phone" ? "on" : ""} onClick={() => setViewport("phone")} title="Phone">
            <svg width="11" height="13" viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="10" height="12" rx="1.5"/><circle cx="5.5" cy="10.5" r=".7" fill="currentColor"/></svg>
          </button>
          <button className={viewport === "card" ? "on" : ""} onClick={() => setViewport("card")} title="Card">
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="13" height="12" rx="1.5"/><path d="M.5 5h13"/></svg>
          </button>
        </div>
        <div className="viewport-seg" style={{ marginLeft: 4 }}>
          <button className={locale === "en" ? "on" : ""} onClick={() => setLocale("en")} style={{ fontSize: 10.5, fontWeight: 500, width: "auto", padding: "0 8px" }}>EN</button>
          <button className={locale === "no" ? "on" : ""} onClick={() => setLocale("no")} style={{ fontSize: 10.5, fontWeight: 500, width: "auto", padding: "0 8px" }}>NO</button>
        </div>
      </div>
      <div className="stage">
        <PhoneProduct draft={draft} locale={locale} animateFlash={flash} />
      </div>
      <div className="preview-foot">
        <div className="audience">
          Reaches <b>{draft.memberOnly ? "4,217" : "6,840"}</b> {draft.memberOnly ? "BISO members" : "BI students"}
        </div>
        <span style={{ marginLeft: "auto" }}>Auto-saved 8 sec ago</span>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = shopPreviewCSS; document.head.appendChild(s); })();
window.ShopPreviewPane = ShopPreviewPane;
