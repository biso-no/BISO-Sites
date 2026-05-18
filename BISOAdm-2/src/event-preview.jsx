// Live preview pane for events — same shell as jobs preview but the screen
// is laid out around the date hero, capacity bar and RSVP CTA.

const evPreviewCSS = `
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
.preview-head .live{display:flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--leaf); font-weight: 500;}
.preview-head .live i{width:6px; height:6px; border-radius:50%; background: var(--leaf); animation: pulse 1.8s infinite;}
.preview-head .label{font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;}
.preview-head .spacer{flex:1}
.preview-head .viewport-seg{
  display:flex; padding: 2px; flex-shrink:0;
  background: rgba(255,255,255,.5);
  border: 0.5px solid var(--rule-2); border-radius: 7px;
}
.preview-head .viewport-seg button{
  appearance:none; border: 0; background: transparent;
  width: 28px; height: 22px;
  display:grid; place-items: center;
  border-radius: 5px;
  color: var(--ink-3); cursor: pointer;
}
.preview-head .viewport-seg button.on{background: white; color: var(--ink);}

.stage{flex: 1; min-height: 0; position: relative;
  display:flex; align-items: center; justify-content: center; padding: 24px;}
.phone{
  width: 314px; height: 640px;
  background: var(--ink);
  border-radius: 38px;
  padding: 7px;
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
  border-radius: 30px;
  overflow: hidden;
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
  width: 28px; height: 28px;
  display:grid; place-items: center;
  background: var(--paper-2); border-radius: 50%;
}
.phone-scroll{flex: 1; overflow: hidden; position: relative;}
.phone-scroll .fade{position: absolute; left: 0; right: 0; bottom: 0; height: 50px;
  background: linear-gradient(180deg, transparent, var(--paper)); pointer-events:none; z-index: 5;}

/* Event hero — bigger image area, date sits over it */
.ev-hero{
  height: 160px; position: relative;
  background: var(--ink);
  overflow: hidden;
}
.ev-hero.p1{background: linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%);}
.ev-hero.p2{background: linear-gradient(135deg, #2a4a7a 0%, #15263c 100%);}
.ev-hero.p3{background: linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%);}
.ev-hero.p4{background: linear-gradient(135deg, #b08a3e 0%, #6a5118 100%);}
.ev-hero.p5{background: linear-gradient(180deg, #29261b 0%, #100e09 100%);}
.ev-hero svg{position: absolute; inset: 0; width: 100%; height: 100%; opacity: .3;}
.ev-hero .badge{
  position: absolute; left: 14px; top: 14px;
  font-size: 9px; padding: 3px 8px; border-radius: 999px;
  background: rgba(255,255,255,.18); color: white;
  letter-spacing: .08em; text-transform: uppercase;
  border: 0.5px solid rgba(255,255,255,.25);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.ev-hero .cat-badge{left: auto; right: 14px;}
/* Date plaque overlapping bottom-left */
.ev-date-plaque{
  position: absolute; left: 14px; bottom: -22px;
  width: 60px; min-height: 66px;
  border-radius: 10px;
  background: var(--paper);
  border: 0.5px solid var(--rule-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--serif);
  overflow: hidden;
  box-shadow: 0 6px 16px rgba(0,0,0,.18);
}
.ev-date-plaque .m{
  background: var(--claret); color: var(--paper);
  font-family: var(--ui); font-size: 9px; letter-spacing: .08em;
  width: 100%; text-align: center; padding: 2px 0;
  text-transform: uppercase; font-weight: 600;
}
.ev-date-plaque .d{font-size: 28px; line-height: 1; padding: 6px 0 4px; letter-spacing: -0.02em;}
.ev-date-plaque .y{font-size: 9px; color: var(--ink-3); font-family: var(--ui); padding-bottom: 4px;}

.preview-body{padding: 32px 18px 8px; display:flex; flex-direction: column; gap: 9px;}
.ev-meta{
  display:flex; align-items: center; gap: 8px;
  font-size: 10.5px; color: var(--ink-3);
  letter-spacing: .03em;
}
.ev-meta .dot{width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4);}
.ev-title{
  font-family: var(--serif); font-size: 22px; line-height: 1.05;
  letter-spacing: -0.012em; font-weight: 400;
  color: var(--ink);
}
.ev-title em{font-style: italic; color: var(--claret);}
.ev-title .caret{display: inline-block; width: 1px; height: 0.9em; background: var(--claret); vertical-align: -2px; margin-left: 1px; animation: caret 1s steps(2) infinite;}
.ev-short{font-size: 11.5px; color: var(--ink-2); line-height: 1.5;}

/* Time + location info rows */
.ev-info-rows{display: flex; flex-direction: column; gap: 6px; margin: 6px 0 4px;}
.ev-info-row{
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 10px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  border-radius: 8px;
}
.ev-info-row .ic{
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--paper); border: 0.5px solid var(--rule-2);
  display: grid; place-items: center; flex-shrink: 0;
  color: var(--ink-2);
}
.ev-info-row .lns{display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;}
.ev-info-row .pri{font-size: 11.5px; color: var(--ink); font-weight: 500;}
.ev-info-row .sub{font-size: 10.5px; color: var(--ink-3);}
.ev-info-row .calendar-link{font-size: 10px; color: var(--claret); margin-left: auto; flex-shrink: 0; align-self: center;}

/* Capacity strip */
.ev-cap{
  display:flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: rgba(255,255,255,.5); border: 0.5px solid var(--rule-2);
  border-radius: 8px;
}
.ev-cap .col{display: flex; flex-direction: column; gap: 2px;}
.ev-cap .col .l{font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-4);}
.ev-cap .col .v{font-size: 11px; color: var(--ink); font-weight: 500; font-family: var(--mono);}
.ev-cap .bar-wrap{flex: 1; display: flex; flex-direction: column; gap: 4px;}
.ev-cap .bar{height: 3px; background: var(--paper-3); border-radius: 999px; overflow: hidden;}
.ev-cap .bar i{display: block; height: 100%; background: var(--leaf);}
.ev-cap .bar.warn i{background: var(--gold);}
.ev-cap .bar.full i{background: var(--claret);}
.ev-cap .pct{font-size: 9.5px; color: var(--ink-3); text-align: right; font-family: var(--mono);}

.preview-tags{display:flex; gap: 4px; flex-wrap: wrap;}
.preview-tag{
  font-size: 9.5px; padding: 3px 7px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  color: var(--ink-2);
}

.preview-body h4{font-family: var(--serif); font-size: 14px; line-height: 1.2;
  margin: 6px 0 0; font-weight: 400; color: var(--ink);}
.preview-body p{margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--ink-2);}
.preview-body ul{margin: 2px 0 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 4px;}
.preview-body ul li{font-size: 11.5px; line-height: 1.45; color: var(--ink-2); padding-left: 14px; position: relative;}
.preview-body ul li::before{content:""; position: absolute; left: 0; top: 7px; width: 5px; height: 1px; background: var(--claret);}

.preview-cta{
  padding: 10px 16px 14px;
  background: rgba(250,247,242,.92);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border-top: 0.5px solid var(--rule);
}
.preview-cta .pricerow{display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;}
.preview-cta .pricerow .p1{font-family: var(--serif); font-size: 18px; line-height: 1; letter-spacing: -0.01em;}
.preview-cta .pricerow .p1.free{color: var(--leaf);}
.preview-cta .pricerow .p2{font-size: 10.5px; color: var(--ink-3);}
.preview-cta .pricerow .seats{font-size: 10px; color: var(--claret); font-family: var(--mono);}
.preview-cta button{
  appearance: none; border: 0;
  width: 100%; padding: 11px;
  background: var(--ink); color: var(--paper);
  border-radius: 999px; font-size: 12.5px; font-weight: 500;
  cursor: pointer;
}

/* Flash on update */
.preview-flash{
  position: absolute; inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 35%, rgba(107,30,30,0.15), transparent 60%);
  opacity: 0; transition: opacity .2s;
}
.preview-flash.on{ opacity: 1;}

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

function EvCoverPattern({ which = 1 }) {
  if (which === 1) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      <defs><pattern id="evd1" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern></defs>
      <rect width="200" height="130" fill="url(#evd1)" />
    </svg>
  );
  if (which === 2) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      {[...Array(8)].map((_, i) => <line key={i} x1="0" y1={i*18} x2="200" y2={i*18 - 30} stroke="white" strokeWidth="0.5"/>)}
    </svg>
  );
  if (which === 3) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      <circle cx="40" cy="100" r="80" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="40" cy="100" r="60" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="40" cy="100" r="40" fill="none" stroke="white" strokeWidth="0.5" />
      <circle cx="40" cy="100" r="20" fill="none" stroke="white" strokeWidth="0.5" />
    </svg>
  );
  if (which === 4) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      {[...Array(10)].map((_, i) => (
        <path key={i} d={`M0,${60 + i*8} Q50,${40 + i*8} 100,${60 + i*8} T200,${60 + i*8}`} fill="none" stroke="white" strokeWidth="0.4" opacity={1 - i * 0.06} />
      ))}
    </svg>
  );
  if (which === 5) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      <defs><pattern id="evd5" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 11h22M11 0v22" stroke="white" strokeWidth="0.3"/></pattern></defs>
      <rect width="200" height="130" fill="url(#evd5)" />
    </svg>
  );
  return null;
}

function EventPhone({ draft, locale, animateFlash }) {
  const d = dept(draft.department);
  const c = campus(draft.campus);
  const cat = evCat(draft.category) || {};
  const title = locale === "no" ? draft.titleNo : draft.titleEn;
  const short = locale === "no" ? draft.shortNo : draft.shortEn;
  const desc = draft.descEn;
  const dur = durationHrs(draft.startDate, draft.endDate);
  const ratio = draft.capacity > 0 ? Math.min((draft.capacity * 0.62) / draft.capacity, 1) : 0;
  const seatsLeft = draft.capacity ? Math.max(0, draft.capacity - Math.round(draft.capacity * 0.62)) : null;
  const price = draft.pricingMode === "free" ? 0 : draft.price;
  const year = draft.startDate ? new Date(draft.startDate).getFullYear() : "";

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
          <div className="back"><I.back size={14} /></div>
          <span>Events</span>
          <span style={{ marginLeft: "auto", color: "var(--ink-4)" }}>♡  •••</span>
        </div>
        <div className="phone-scroll scroll">
          <div className={"ev-hero p" + (draft.coverPattern || 1)}>
            <EvCoverPattern which={draft.coverPattern || 1} />
            <div className="badge">{draft.memberOnly ? "Members only" : "Open to all"}</div>
            {cat.name && <div className="badge cat-badge">{cat.name}</div>}
            {draft.startDate ? (
              <div className="ev-date-plaque">
                <div className="m">{fmtMonth(draft.startDate)}</div>
                <div className="d">{fmtDayNum(draft.startDate)}</div>
                <div className="y">{year}</div>
              </div>
            ) : (
              <div className="ev-date-plaque" style={{ opacity: .55 }}>
                <div className="m" style={{ background: "var(--ink-4)" }}>tbd</div>
                <div className="d" style={{ fontSize: 14, fontStyle: "italic", color: "var(--ink-3)", padding: "10px 0" }}>—</div>
              </div>
            )}
          </div>
          <div className="preview-body">
            <div className="ev-meta">
              <span>{d?.name || "—"}</span>
              <span className="dot"></span>
              <span>{c?.name}</span>
              {draft.isCollection && <><span className="dot"></span><span style={{ color: "var(--claret)" }}>Series</span></>}
            </div>
            <div className="ev-title">
              {title || <em style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Your event title…</em>}
              <span className="caret"></span>
            </div>
            <div className="ev-short">{short}</div>

            <div className="ev-info-rows">
              <div className="ev-info-row">
                <div className="ic"><I.events size={13}/></div>
                <div className="lns">
                  <div className="pri">{fmtDay(draft.startDate)}{draft.startDate && draft.endDate && new Date(draft.startDate).toDateString() !== new Date(draft.endDate).toDateString() ? ` → ${fmtDay(draft.endDate)}` : ""}</div>
                  <div className="sub">{fmtTime(draft.startDate)} – {fmtTime(draft.endDate)} · {dur || "—"}</div>
                </div>
                <span className="calendar-link">Add to cal</span>
              </div>
              <div className="ev-info-row">
                <div className="ic">{draft.locationMode === "online" ? <I.globe size={13}/> : <I.pin size={13}/>}</div>
                <div className="lns">
                  <div className="pri">{draft.locationMode === "online" ? "Online" : draft.location?.split("·")[0] || "Venue TBC"}</div>
                  <div className="sub">{draft.locationMode === "online" ? "Link sent on registration" : draft.location?.split("·")[1]?.trim() || "—"}</div>
                </div>
                {draft.locationMode !== "online" && <span className="calendar-link">Map</span>}
              </div>
            </div>

            {draft.capacity > 0 && (
              <div className="ev-cap">
                <div className="bar-wrap">
                  <div className="col">
                    <div className="l">Registered</div>
                    <div className="v">{Math.round(draft.capacity * 0.62)} / {draft.capacity}</div>
                  </div>
                  <div className={"bar" + (ratio >= 0.95 ? " full" : ratio >= 0.75 ? " warn" : "")}>
                    <i style={{ width: `${ratio * 100}%` }}></i>
                  </div>
                </div>
              </div>
            )}

            <div className="preview-tags">
              {draft.tags?.map((t, i) => <span key={i} className="preview-tag">{t}</span>)}
            </div>

            {desc.map((b, i) => {
              if (b.type === "h") return <h4 key={i}>{b.text}</h4>;
              if (b.type === "p") return <p key={i}>{b.text}</p>;
              if (b.type === "l") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
              return null;
            })}

            <div style={{ height: 80 }}></div>
          </div>
          <div className="fade"></div>
        </div>
        <div className="preview-cta">
          <div className="pricerow">
            <div>
              <div className={"p1" + (price === 0 ? " free" : "")}>{fmtNOK(price)}</div>
              {price > 0 && draft.memberPrice > 0 && draft.memberPrice < price && (
                <div className="p2">{fmtNOK(draft.memberPrice)} for BISO members</div>
              )}
              {price === 0 && <div className="p2">Bring a friend</div>}
            </div>
            {seatsLeft != null && seatsLeft < 20 && seatsLeft > 0 && (
              <div className="seats">{seatsLeft} seats left</div>
            )}
          </div>
          <button>{draft.locationMode === "online" ? "Reserve my spot" : "Register"}</button>
        </div>
        <div className={"preview-flash" + (animateFlash ? " on" : "")}></div>
      </div>
    </div>
  );
}

function EventPreviewPane({ draft, locale, setLocale, viewport, setViewport, flash }) {
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
        <EventPhone draft={draft} locale={locale} animateFlash={flash} />
      </div>
      <div className="preview-foot">
        <div className="audience">Reaches <b>{draft.memberOnly ? "4,217" : "6,840"}</b> students {draft.memberOnly ? "with active BISO membership" : "on the Oslo campus"}</div>
        <span style={{ marginLeft: "auto" }}>Auto-saved 12 sec ago</span>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = evPreviewCSS; document.head.appendChild(s); })();
window.EventPreviewPane = EventPreviewPane;
window.EvCoverPattern   = EvCoverPattern;
