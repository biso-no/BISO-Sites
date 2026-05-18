// Live preview pane — phone frame showing how the job appears to students.

const previewCSS = `
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
  flex-wrap: nowrap;
  overflow: hidden;
}
.preview-head .live, .preview-head .label{flex-shrink: 0; white-space: nowrap;}
.preview-head .viewport-seg{flex-shrink: 0;}
.preview-head .live{
  display:flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--leaf);
  font-weight: 500;
}
.preview-head .live i{width:6px; height:6px; border-radius:50%; background: var(--leaf); animation: pulse 1.8s infinite;}
.preview-head .label{font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;}
.preview-head .spacer{flex:1}
.preview-head .viewport-seg{
  display:flex; padding: 2px;
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

.stage{
  flex: 1; min-height: 0; position: relative;
  display:flex; align-items: center; justify-content: center;
  padding: 24px;
}
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
.phone-notch{
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 26px;
  background: #000; border-radius: 14px;
  z-index: 10;
}
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
  font-size: 11px; font-weight: 600;
  font-family: var(--ui);
  color: var(--ink);
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

.phone-scroll{
  flex: 1; overflow: hidden; position: relative;
}
.phone-scroll .fade{
  position: absolute; left: 0; right: 0; bottom: 0; height: 50px;
  background: linear-gradient(180deg, transparent, var(--paper));
  pointer-events:none; z-index: 5;
}

.preview-cover{
  height: 132px; position: relative;
  background: var(--ink);
  overflow: hidden;
}
.preview-cover.p1{background: linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%);}
.preview-cover.p2{background: linear-gradient(135deg, #2a4a7a 0%, #15263c 100%);}
.preview-cover.p3{background: linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%);}
.preview-cover.p4{background: linear-gradient(135deg, #b08a3e 0%, #6a5118 100%);}
.preview-cover.p5{background: linear-gradient(180deg, #29261b 0%, #100e09 100%);}
.preview-cover svg{position: absolute; inset: 0; width: 100%; height: 100%; opacity: .35;}
.preview-cover .badge{
  position: absolute; left: 14px; top: 14px;
  font-size: 9px; padding: 3px 8px; border-radius: 999px;
  background: rgba(255,255,255,.18); color: white;
  letter-spacing: .08em; text-transform: uppercase;
  border: 0.5px solid rgba(255,255,255,.25);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.preview-cover .dept-crest{
  position: absolute; right: 14px; bottom: 14px;
  width: 44px; height: 44px;
  border-radius: 10px;
  background: rgba(255,255,255,.95);
  color: var(--ink);
  display:grid; place-items: center;
  font-family: var(--serif); font-size: 26px; line-height: 1;
}

.preview-body{padding: 14px 18px 8px; display:flex; flex-direction: column; gap: 10px;}
.preview-meta{
  display:flex; align-items: center; gap: 8px;
  font-size: 10.5px; color: var(--ink-3);
  letter-spacing: .03em;
}
.preview-meta .dot{width: 3px; height: 3px; border-radius: 50%; background: var(--ink-4);}
.preview-title{
  font-family: var(--serif); font-size: 24px; line-height: 1.05;
  letter-spacing: -0.012em; font-weight: 400;
  color: var(--ink);
  min-height: 26px;
}
.preview-title em{font-style: italic; color: var(--claret);}
.preview-title .caret{display: inline-block; width: 1px; height: 0.9em; background: var(--claret); vertical-align: -2px; margin-left: 1px; animation: caret 1s steps(2) infinite;}
.preview-short{
  font-size: 12px; color: var(--ink-2); line-height: 1.45;
}
.preview-tags{display:flex; gap: 4px; flex-wrap: wrap;}
.preview-tag{
  font-size: 9.5px; padding: 3px 7px; border-radius: 999px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  color: var(--ink-2);
}

.preview-facts{
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
  margin: 4px 0 0;
  background: var(--rule);
  border: 0.5px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
}
.preview-fact{
  padding: 8px 10px;
  background: var(--paper);
  display:flex; flex-direction: column; gap: 2px;
}
.preview-fact .l{font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-4);}
.preview-fact .v{font-size: 11.5px; color: var(--ink); font-weight: 500; display:flex; align-items: center; gap: 4px;}

.preview-body h4{
  font-family: var(--serif); font-size: 15px; line-height: 1.2;
  margin: 6px 0 0; font-weight: 400; color: var(--ink);
}
.preview-body p{margin: 0; font-size: 11.5px; line-height: 1.55; color: var(--ink-2);}
.preview-body ul{margin: 2px 0 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 4px;}
.preview-body ul li{font-size: 11.5px; line-height: 1.45; color: var(--ink-2); padding-left: 14px; position: relative;}
.preview-body ul li::before{content:""; position: absolute; left: 0; top: 7px; width: 5px; height: 1px; background: var(--claret);}

.preview-cta{
  padding: 10px 16px 14px;
  background: rgba(250,247,242,.85);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border-top: 0.5px solid var(--rule);
}
.preview-cta button{
  appearance: none; border: 0;
  width: 100%; padding: 11px;
  background: var(--ink); color: var(--paper);
  border-radius: 999px; font-size: 12.5px; font-weight: 500;
  cursor: pointer;
}
.preview-cta .deadline-row{display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; color: var(--ink-3); margin-bottom: 8px;}
.preview-cta .deadline-row .num{color: var(--claret); font-family: var(--mono); font-weight: 500;}

/* Update flash animation */
.preview-flash{
  position: absolute; inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 35%, rgba(107,30,30,0.15), transparent 60%);
  opacity: 0;
  transition: opacity .2s;
}
.preview-flash.on{ opacity: 1;}

/* Footer info */
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

function CoverPattern({ which = 1 }) {
  if (which === 1) return (
    <svg viewBox="0 0 200 130" preserveAspectRatio="none">
      <defs><pattern id="dots1" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern></defs>
      <rect width="200" height="130" fill="url(#dots1)" />
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
  return null;
}

function Phone({ draft, locale, animateFlash }) {
  const d = dept(draft.department);
  const c = campus(draft.campus);
  const title = locale === "no" ? draft.titleNo : draft.titleEn;
  const short = locale === "no" ? draft.shortNo : draft.shortEn;
  const desc = draft.descEn; // we'll render same blocks for demo
  const dl = daysLeft(draft.deadline);

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
          <span>Jobs</span>
          <span style={{ marginLeft: "auto", color: "var(--ink-4)" }}>•••</span>
        </div>
        <div className="phone-scroll scroll">
          <div className={"preview-cover p" + (draft.coverPattern || 1)}>
            <CoverPattern which={draft.coverPattern || 1} />
            <div className="badge">{draft.isMemberOnly ? "Members only" : "Open to all"}</div>
            <div className="dept-crest">{d.crest}</div>
          </div>
          <div className="preview-body">
            <div className="preview-meta">
              <span>{d.name}</span>
              <span className="dot"></span>
              <span>{c.name}</span>
            </div>
            <div className="preview-title">
              {title || <em style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Your job title…</em>}
              <span className="caret"></span>
            </div>
            <div className="preview-short">{short}</div>
            <div className="preview-tags">
              {draft.tags?.map((t, i) => <span key={i} className="preview-tag">{t}</span>)}
            </div>

            <div className="preview-facts">
              <div className="preview-fact"><div className="l">Commitment</div><div className="v"><I.clock size={11} />{draft.commitment}</div></div>
              <div className="preview-fact"><div className="l">Term</div><div className="v">{draft.term}</div></div>
              <div className="preview-fact"><div className="l">Starts</div><div className="v">{fmtDate(draft.startDate)}</div></div>
              <div className="preview-fact"><div className="l">Location</div><div className="v" style={{fontSize:10.5}}><I.pin size={11} />{draft.location?.split("·")[0]}</div></div>
            </div>

            {desc.map((b, i) => {
              if (b.type === "h") return <h4 key={i}>{b.text}</h4>;
              if (b.type === "p") return <p key={i}>{b.text}</p>;
              if (b.type === "l") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
              return null;
            })}

            <div style={{ height: 60 }}></div>
          </div>
          <div className="fade"></div>
        </div>
        <div className="preview-cta">
          <div className="deadline-row">
            <span>Application deadline</span>
            <span><span className="num">{fmtDate(draft.deadline)}</span> {dl != null && dl > 0 && `· ${dl}d left`}</span>
          </div>
          <button>Apply now</button>
        </div>
        <div className={"preview-flash" + (animateFlash ? " on" : "")}></div>
      </div>
    </div>
  );
}

function PreviewPane({ draft, locale, setLocale, viewport, setViewport, flash }) {
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
        <Phone draft={draft} locale={locale} animateFlash={flash} />
      </div>
      <div className="preview-foot">
        <div className="audience">Reaches <b>4,217</b> students with ESN interest tag</div>
        <span style={{ marginLeft: "auto" }}>Auto-saved 12 sec ago</span>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = previewCSS; document.head.appendChild(s); })();
window.PreviewPane = PreviewPane;
