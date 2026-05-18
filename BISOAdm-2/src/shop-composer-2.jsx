// Steps 3–5 of the shop composer: Variants & price, Photos & visibility, Review.

// ============================================================================
// Step 3 — Variants & price
// ============================================================================

const VARIANT_TEMPLATES = {
  size:   ["Size · S", "Size · M", "Size · L", "Size · XL"],
  color:  ["Sage green", "Claret", "Slate black"],
  ticket: ["Standard", "VIP", "Early bird"],
};

function VariantBoard({ variants, set, draft }) {
  const setVariant = (idx, patch) => {
    const copy = (variants || []).slice();
    copy[idx] = { ...copy[idx], ...patch };
    set("variants", copy);
  };
  const remove = (idx) => {
    const copy = (variants || []).slice();
    copy.splice(idx, 1);
    set("variants", copy);
  };
  const addBlank = () => {
    const next = (variants || []).slice();
    next.push({ name: "New variant", price: draft.regularPrice || 0, memberPrice: draft.memberPrice || 0, stock: 50, sku: toSku("VAR-" + (next.length + 1)), lowStock: 10 });
    set("variants", next);
  };
  const applyTemplate = (kind) => {
    const tpl = VARIANT_TEMPLATES[kind] || [];
    const base = draft.regularPrice || (kind === "ticket" ? 490 : 199);
    const mem = Math.round(base * 0.7);
    set("variants", tpl.map((name, i) => ({
      name,
      price: base,
      memberPrice: mem,
      stock: 50,
      sku: toSku(draft.slug + "-" + name),
      lowStock: 10,
    })));
  };

  const totalStock = (variants || []).reduce((s, v) => s + (v.stock || 0), 0);
  const lowestPrice = (variants || []).reduce((m, v) => (m == null || v.price < m) ? v.price : m, null);
  const highestPrice = (variants || []).reduce((m, v) => (m == null || v.price > m) ? v.price : m, null);

  if (!variants || variants.length === 0) {
    return (
      <div className="variant-board">
        <div className="no-variants">
          <div className="ill">One SKU, one price.</div>
          <div>Add variants when you want different sizes, tiers, colours, or any other axis to ship under one product.</div>
          <div className="templates">
            <button onClick={() => applyTemplate("size")}><I.layers size={12}/> Start with sizes</button>
            <button onClick={() => applyTemplate("color")}><I.image size={12}/> Start with colours</button>
            <button onClick={() => applyTemplate("ticket")}><I.tag size={12}/> Start with ticket tiers</button>
            <button onClick={addBlank}><I.plus size={12}/> Blank variant</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="variant-board">
      <div className="board-hd">
        <div className="summary">
          <b>{variants.length}</b> variants · <b>{totalStock.toLocaleString("nb-NO")}</b> total stock ·
          price <b>{fmtNOK(lowestPrice)}{lowestPrice !== highestPrice && ` – ${fmtNOK(highestPrice)}`}</b>
        </div>
        <div className="spacer"></div>
        <div className="template" onClick={() => applyTemplate("size")}><I.layers size={11}/> Replace with sizes</div>
      </div>
      <div className="variant-row head">
        <div></div>
        <div>Variant name</div>
        <div>Price · NOK</div>
        <div>Member price</div>
        <div>Stock</div>
        <div>SKU</div>
        <div></div>
      </div>
      {variants.map((v, i) => (
        <div className="variant-row" key={i}>
          <div className="handle"><I.drag size={12}/></div>
          <input className="name-in" value={v.name} onChange={e => setVariant(i, { name: e.target.value })} placeholder="Variant name" />
          <input className="price-in" type="number" value={v.price} onChange={e => setVariant(i, { price: parseInt(e.target.value || "0", 10) })} />
          <input className="price-in" type="number" value={v.memberPrice} onChange={e => setVariant(i, { memberPrice: parseInt(e.target.value || "0", 10) })} />
          <div className="stock-stepper">
            <button onClick={() => setVariant(i, { stock: Math.max(0, (v.stock || 0) - 1) })}>−</button>
            <input type="number" value={v.stock || 0} onChange={e => setVariant(i, { stock: parseInt(e.target.value || "0", 10) })} />
            <button onClick={() => setVariant(i, { stock: (v.stock || 0) + 1 })}>+</button>
          </div>
          <input className="sku-in" value={v.sku} onChange={e => setVariant(i, { sku: e.target.value })} placeholder="SKU" />
          <button className="del" onClick={() => remove(i)} title="Remove variant"><I.trash size={13}/></button>
        </div>
      ))}
      <div className="variant-add-row">
        <button className="add" onClick={addBlank}><I.plus size={11}/> Add variant</button>
        <div style={{ flex: 1 }}></div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>
          Tip: variants don't have to be sizes — try "Day pass / Weekend / Week" or "1L / 500ml".
        </div>
      </div>
    </div>
  );
}

function ShopVariantsStep({ draft, set }) {
  const hasVariants = (draft.variants || []).length > 0;
  const variantTotalStock = (draft.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
  const lowVariants = (draft.variants || []).filter(v => v.stock < (v.lowStock || 10) && v.stock > 0);

  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          Variants &amp; the price tag.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "52ch" }}>
          A product can ship as one SKU, or as a family of variants — sizes, tiers, colours, whatever you want to track separately. Each variant carries its own price, member price, stock and SKU.
        </p>
      </div>

      <div className="field-grid">
        {!hasVariants && (
          <div className="row-2">
            <div className="field">
              <div className="field-label"><I.coin size={12}/> Regular price <span className="req">required</span></div>
              <input className="field-input" type="number" value={draft.regularPrice} onChange={e => set("regularPrice", parseInt(e.target.value || "0", 10))} />
            </div>
            <div className="field">
              <div className="field-label"><I.pct size={12}/> Member price <span className="help">0 = same as regular</span></div>
              <input className="field-input" type="number" value={draft.memberPrice} onChange={e => set("memberPrice", parseInt(e.target.value || "0", 10))} />
            </div>
          </div>
        )}

        <div className="field">
          <div className="field-label">
            <I.layers size={12}/> Variants
            <span className="help">{hasVariants ? `${draft.variants.length} variants · ${variantTotalStock} units` : "Optional"}</span>
          </div>
          <VariantBoard variants={draft.variants} set={set} draft={draft} />
        </div>

        <div className="discount-card">
          <div className="icon"><I.pct size={18}/></div>
          <div className="body">
            <b>Default member discount applied across variants</b>
            <p>Members at any BISO campus pay this share less than the regular price. You can still override per-variant above.</p>
          </div>
          <div className="pct">{draft.memberDiscountPct || 33}<span>%</span></div>
        </div>

        <div className="ai-card">
          <div className="gem"><I.spark2 size={14}/></div>
          <div className="body">
            <b>Suggest a member price.</b>
            <p>At a 33% member discount the Week Pass lands at <b>kr 990</b>, matching last year's Fadderuke psychology. Want me to apply 33% across all three variants?</p>
            <div className="actions">
              <button className="primary"><I.spark2 size={11}/> Apply 33% to all</button>
              <button>Edit individually</button>
            </div>
          </div>
        </div>

        {lowVariants.length > 0 && (
          <div className="ai-card" style={{ borderColor: "rgba(107,30,30,.4)", background: "linear-gradient(180deg, rgba(107,30,30,.04), rgba(107,30,30,.01))" }}>
            <div className="gem" style={{ background: "linear-gradient(135deg, #6b1e1e, #b04545)" }}><I.warn size={14}/></div>
            <div className="body">
              <b>One variant is running thin.</b>
              <p>"{lowVariants[0].name}" has {lowVariants[0].stock} left — below your low-stock threshold of {lowVariants[0].lowStock}. We'll automatically show "Only a few left" once it hits five.</p>
              <div className="actions">
                <button>Restock now</button>
                <button>Lower threshold</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step 4 — Photos & visibility
// ============================================================================
function GalleryTile({ photo, isHero, onSetHero, onRemove, asIs = false }) {
  return (
    <div className={"gallery-tile" + (isHero ? " hero" : "")}>
      <div className={"thumb-bg p" + (photo.pattern || 1)}>
        <CoverPattern which={photo.pattern || 1} />
      </div>
      {isHero && <div className="hero-pin"><I.star size={9}/> Hero</div>}
      <div className="label">{photo.label}</div>
      {!asIs && (
        <div className="actions">
          {!isHero && <button onClick={() => onSetHero(photo.id)} title="Set as hero"><I.star size={12}/></button>}
          <button onClick={() => onRemove(photo.id)} title="Remove"><I.trash size={12}/></button>
        </div>
      )}
    </div>
  );
}

function ShopVisibilityStep({ draft, set }) {
  const photos = draft.photos || [];
  const heroId = photos.find(p => p.isHero)?.id || photos[0]?.id;
  const setHero = (id) => set("photos", photos.map(p => ({ ...p, isHero: p.id === id })));
  const removePhoto = (id) => set("photos", photos.filter(p => p.id !== id));

  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          Photos, audience, the link.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "52ch" }}>
          Three photos is the sweet spot. The hero leads the product page; the rest become a swipe gallery. Tickets can be linked to the live event so registrations move in lockstep.
        </p>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="field-label">
            <I.image size={12}/> Product gallery
            <span className="help">{photos.length} of 5 · drag to reorder</span>
          </div>
          <div className="gallery-grid">
            {photos.map((p) => (
              <GalleryTile
                key={p.id}
                photo={p}
                isHero={p.id === heroId}
                onSetHero={setHero}
                onRemove={removePhoto}
              />
            ))}
            {photos.length < 5 && (
              <div className="gallery-tile add">
                <I.upload size={18}/>
                <span>Add photo</span>
              </div>
            )}
          </div>
        </div>

        {draft.category === "tickets" && (
          <div className="field">
            <div className="field-label"><I.events size={12}/> Linked event <span className="help">Pulls dates and capacity from the calendar</span></div>
            <div className="linked-event">
              <div className="ic"><I.events size={16}/></div>
              <div className="meta">
                <b>Fadderuke 2026 — full week pass</b>
                <span>biso.no/oslo/events/{draft.linkedEventSlug || "fadderuke-26"} · 17 Aug → 22 Aug · Draft</span>
              </div>
              <button>Change</button>
            </div>
          </div>
        )}

        <div className="settings-grid">
          <div className={"toggle-card" + (draft.memberOnly ? " on" : "")} onClick={() => set("memberOnly", !draft.memberOnly)}>
            <div className="h"><span className="ic"><I.lock size={14}/></span> Members only</div>
            <div className="desc">Only verified BISO members can add this to cart. Best for member-priced socials and limited drops.</div>
            <div className="check">{draft.memberOnly && <I.check size={11}/>}</div>
          </div>
          <div className={"toggle-card" + (!draft.memberOnly ? " on" : "")} onClick={() => set("memberOnly", false)}>
            <div className="h"><span className="ic"><I.globe size={14}/></span> Open to all BI students</div>
            <div className="desc">Anyone with a BI email can buy. Members still get the member price automatically at checkout.</div>
            <div className="check">{!draft.memberOnly && <I.check size={11}/>}</div>
          </div>

          <div className={"toggle-card" + (draft.inventoryMode === "tracked" ? " on" : "")} onClick={() => set("inventoryMode", "tracked")}>
            <div className="h"><span className="ic"><I.box size={14}/></span> Track inventory</div>
            <div className="desc">Stock counts decrement on sale. Variant goes out of stock when its count hits zero.</div>
            <div className="check">{draft.inventoryMode === "tracked" && <I.check size={11}/>}</div>
          </div>
          <div className={"toggle-card" + (draft.inventoryMode === "unlimited" ? " on" : "")} onClick={() => set("inventoryMode", "unlimited")}>
            <div className="h"><span className="ic"><I.spark2 size={14}/></span> Unlimited</div>
            <div className="desc">No stock cap. Use for digital goods, memberships, or anything print-on-demand.</div>
            <div className="check">{draft.inventoryMode === "unlimited" && <I.check size={11}/>}</div>
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.events size={12}/> Publish schedule</div>
          <div className="row-2">
            <div className={"toggle-card" + (draft.publishMode === "now" ? " on" : "")} style={{ padding: "12px 14px" }} onClick={() => set("publishMode", "now")}>
              <div className="h" style={{ fontSize: 13 }}><span className="ic" style={{ width: 22, height: 22 }}><I.arrow size={12}/></span> Publish now</div>
            </div>
            <div className={"toggle-card" + (draft.publishMode === "schedule" ? " on" : "")} style={{ padding: "12px 14px" }} onClick={() => set("publishMode", "schedule")}>
              <div className="h" style={{ fontSize: 13 }}><span className="ic" style={{ width: 22, height: 22 }}><I.clock size={12}/></span> Schedule for…</div>
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.people size={12}/> Customer support contact</div>
          <div className="row-3">
            <input className="field-input" placeholder="Name" value={draft.contactName} onChange={e => set("contactName", e.target.value)} />
            <input className="field-input" placeholder="Role" value={draft.contactRole} onChange={e => set("contactRole", e.target.value)} />
            <input className="field-input" placeholder="Email" value={draft.contactEmail} onChange={e => set("contactEmail", e.target.value)} />
          </div>
        </div>

        <div className="ai-card">
          <div className="gem"><I.spark2 size={14}/></div>
          <div className="body">
            <b>Translate the listing to Norwegian as you go</b>
            <p>I'll auto-translate the title, teaser and description into bokmål. Variant names stay as-is — you'll review them before publish.</p>
            <div className="actions">
              <button className="primary"><I.spark2 size={11}/> Turn on auto-translate</button>
              <button>Not now</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 5 — Review
// ============================================================================
function ShopReviewStep({ draft, setStep }) {
  const d = dept(draft.department), c = campus(draft.campus);
  const cat = prodCat(draft.category) || {};
  const totalSt = (draft.variants || []).reduce((s, v) => s + (v.stock || 0), 0);
  const rows = [
    { label: "Title (EN)", value: draft.titleEn, step: 0 },
    { label: "Title (NO)", value: draft.titleNo, step: 0 },
    { label: "Category · Host", value: `${cat.name || "—"} · ${d?.name || "—"}`, step: 0 },
    { label: "Teaser", value: draft.shortEn, step: 0 },
    { label: "Description", value: `${draft.descEn?.length || 0} blocks`, step: 1 },
    { label: "Variants", value: (draft.variants || []).length > 0
        ? `${draft.variants.length} variants · ${totalSt.toLocaleString("nb-NO")} units in stock`
        : `Single SKU · ${fmtNOK(draft.regularPrice)}`,
      step: 2 },
    { label: "Price range", value: priceRange(draft), step: 2 },
    { label: "Member discount", value: `${draft.memberDiscountPct || 33}% off · ${fmtNOK(Math.round((draft.regularPrice || 0) * (draft.memberDiscountPct || 33) / 100))} typical saving`, step: 2 },
    { label: "Photos", value: `${(draft.photos || []).length} photos · ${(draft.photos || []).find(p => p.isHero)?.label || "—"} as hero`, step: 3 },
    { label: "Audience", value: draft.memberOnly ? "Members only · 4,217 buyers" : "Open to all BI students · 6,840 buyers", step: 3 },
    { label: "Inventory", value: draft.inventoryMode === "tracked" ? "Tracked — decrements on sale" : "Unlimited", step: 3 },
    { label: "Linked event", value: draft.linkedEventSlug ? `events/${draft.linkedEventSlug}` : "—", step: 3 },
  ];
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          One last look.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "52ch" }}>
          Click any row to jump back. When you're happy, hit Publish — the product is on the shop floor within a minute, on every BISO campus that allows the listing.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "0.5px solid var(--rule)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,.5)" }}>
        {rows.map((row, i) => (
          <div key={i} onClick={() => setStep(row.step)} style={{
            display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 14,
            padding: "14px 18px",
            borderTop: i > 0 ? "0.5px solid var(--rule)" : "none",
            cursor: "pointer", alignItems: "center"
          }}>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", letterSpacing: ".04em", textTransform: "uppercase" }}>{row.label}</div>
            <div style={{ fontSize: 14, color: "var(--ink)" }}>{row.value || <em style={{ color: "var(--ink-4)" }}>Not set</em>}</div>
            <I.edit size={13} style={{ color: "var(--ink-4)" }} />
          </div>
        ))}
      </div>

      <div className="ai-card" style={{ marginTop: 18 }}>
        <div className="gem" style={{ background: "linear-gradient(135deg, #6b1e1e, #b04545)" }}><I.warn size={14}/></div>
        <div className="body">
          <b>Two reminders before you publish.</b>
          <p>The Norwegian translation hasn't been reviewed — Bokmål readers will see the AI draft. The linked Fadderuke event is also still in draft, so the ticket page will read "Event TBC" until both go live together.</p>
          <div className="actions">
            <button>Review NO translation</button>
            <button>Open linked event</button>
            <button className="primary">Publish anyway</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Editor wrapper
// ============================================================================
function ShopComposerEditor({ draft, set, step, setStep, dirty, onPublish }) {
  const stepTitles = ["Essentials","Description","Variants & price","Photos & visibility","Review"];
  let progress = 0.4;
  if (step === 1) progress = 0.58;
  if (step === 2) progress = 0.76;
  if (step === 3) progress = 0.92;
  if (step === 4) progress = 1;

  const d = dept(draft.department), c = campus(draft.campus);
  return (
    <div className="editor scroll">
      <StepRailShop step={step} setStep={setStep} dirty={dirty} />
      <div className="doc">
        <div className="doc-hd">
          <span className="kicker">{d?.name || "—"} · {c?.name}</span>
          <span className="dot"></span>
          <span className="step-name">Step {step+1} of 5 · {stepTitles[step]}</span>
        </div>

        {step === 0 && <ShopEssentialsStep draft={draft} set={set} />}
        {step === 1 && <ShopDescriptionStep draft={draft} set={set} />}
        {step === 2 && <ShopVariantsStep draft={draft} set={set} />}
        {step === 3 && <ShopVisibilityStep draft={draft} set={set} />}
        {step === 4 && <ShopReviewStep draft={draft} setStep={setStep} />}
      </div>
      <div className="action-bar">
        <div className="progress">
          <span>Completeness</span>
          <div className="bar"><i style={{ width: `${progress*100}%` }}></i></div>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{Math.round(progress*100)}%</span>
        </div>
        <div className="spacer"></div>
        <button className="btn"><I.eye size={13}/> Preview as student</button>
        <button className="btn">Save as draft</button>
        {step < 4 ? (
          <button className="btn next-btn" onClick={() => setStep(step+1)}>
            Continue · {stepTitles[step+1]} <I.arrow size={14}/>
          </button>
        ) : (
          <button className="btn next-btn" onClick={onPublish}>
            <I.spark2 size={13}/> Publish product
          </button>
        )}
      </div>
    </div>
  );
}

window.ShopComposerEditor = ShopComposerEditor;
