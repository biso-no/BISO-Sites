// Event composer — multi-step editor mirroring the jobs composer.
// Step rail, doc layout, AI-assist cards, and the action bar are visually identical
// to keep the BISO Studio language consistent.

const evComposerCSS = `
.composer-shell{
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
  flex: 1; min-height: 0;
  overflow: hidden;
}
.editor{
  position: relative;
  overflow: auto; min-height: 0;
  background: var(--paper);
  display:flex; flex-direction: column;
}

.step-rail{
  position: sticky; top: 0; z-index: 10;
  background: rgba(250,247,242,.92);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-bottom: 0.5px solid var(--rule);
  padding: 14px 36px;
  display: flex; align-items: center; gap: 6px;
}
.step{
  display: flex; align-items: center; gap: 9px;
  padding: 6px 14px 6px 6px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--ink-3);
  transition: color .15s, background .15s;
}
.step:hover{color: var(--ink);}
.step.active{background: var(--ink); color: var(--paper);}
.step.done{color: var(--leaf);}
.step .num{
  width: 22px; height: 22px; border-radius: 50%;
  border: 0.5px solid var(--rule-2); background: white;
  display:grid; place-items: center;
  font-family: var(--mono); font-size: 10.5px; color: var(--ink-3);
}
.step.active .num{background: var(--paper); color: var(--ink); border-color: transparent;}
.step.done .num{background: var(--leaf); color: white; border-color: var(--leaf);}
.step-sep{flex: 1; height: 0.5px; background: var(--rule-2); margin: 0 -2px; max-width: 36px;}
.step-rail .right{margin-left: auto; display: flex; align-items: center; gap: 10px;}
.unsaved{display:flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--ink-3);}
.unsaved i{width: 5px; height: 5px; border-radius: 50%; background: var(--gold);}

.doc{max-width: 680px; margin: 0 auto; padding: 32px 44px 120px; width: 100%;}
.doc-hd{display: flex; align-items: center; gap: 12px; margin-bottom: 24px;}
.doc-hd .kicker{font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-4);}
.doc-hd .dot{width: 4px; height: 4px; border-radius: 50%; background: var(--ink-4);}
.doc-hd .step-name{font-size: 12px; color: var(--ink-3);}

.title-block{position: relative; padding: 8px 0 24px;}
.lang-tabs{
  display: inline-flex; gap: 2px;
  margin-bottom: 8px;
  background: var(--paper-2); border-radius: 8px; padding: 3px;
  border: 0.5px solid var(--rule-2);
}
.lang-tabs button{
  appearance: none; border: 0;
  padding: 4px 12px; border-radius: 5px;
  font-size: 11px; cursor: pointer;
  color: var(--ink-3);
  display:flex; align-items: center; gap: 6px;
  background: transparent;
}
.lang-tabs button .flag{width: 14px; height: 10px; border-radius: 1px; overflow: hidden; display: inline-block; position: relative;}
.lang-tabs button.on{background: white; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.05);}
.lang-tabs button .ai-dot{width: 5px; height: 5px; border-radius: 50%; background: var(--gold);}

.title-input{
  appearance: none; border: 0; outline: 0; background: transparent;
  width: 100%;
  font-family: var(--serif); font-size: 56px; line-height: 1.0;
  letter-spacing: -0.018em; color: var(--ink);
  padding: 0; font-weight: 400;
}
.title-input::placeholder{color: var(--ink-4); font-style: italic;}

.slug-line{
  display:flex; align-items:center; gap: 8px;
  margin-top: 12px; padding: 6px 10px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  border-radius: 7px;
  font-family: var(--mono); font-size: 11.5px; color: var(--ink-3);
  width: fit-content; max-width: 100%;
}
.slug-line span:first-of-type{color: var(--ink-4);}
.slug-line b{color: var(--ink); font-weight: 500;}
.slug-line .edit{margin-left: 6px; color: var(--ink-4); cursor: pointer;}

.field-grid{display: grid; gap: 22px;}
.field{display: flex; flex-direction: column; gap: 6px;}
.field-label{
  display:flex; align-items: center; gap: 8px;
  font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--ink-3); font-weight: 500;
}
.field-label .help{color: var(--ink-4); font-size: 10.5px; text-transform: none; letter-spacing: 0; margin-left: auto; font-weight: 400;}
.field-label .req{color: var(--claret); font-size: 10px;}
.field-input{
  appearance: none; border: 0.5px solid var(--rule-2); background: rgba(255,255,255,.6);
  border-radius: 8px; padding: 10px 12px;
  font-size: 14px; color: var(--ink);
  width: 100%; outline: 0;
  transition: border-color .15s, background .15s;
}
.field-input:focus{border-color: var(--ink-2); background: white;}
.field-input::placeholder{color: var(--ink-4);}
textarea.field-input{min-height: 70px; resize: none;}
.field-input.large{font-size: 16px; padding: 12px 14px;}
.row-2{display: grid; grid-template-columns: 1fr 1fr; gap: 14px;}
.row-3{display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;}

/* Category picker — uses the same pill chrome as jobs department picker */
.dept-picker{display: flex; flex-wrap: wrap; gap: 6px;}
.dept-pill{
  display:flex; align-items: center; gap: 8px;
  padding: 7px 12px 7px 7px;
  border: 0.5px solid var(--rule-2); border-radius: 999px;
  background: rgba(255,255,255,.5);
  font-size: 13px; cursor: pointer;
  transition: border-color .12s, background .12s;
}
.dept-pill:hover{background: white;}
.dept-pill .crest{
  width: 24px; height: 24px;
  display:grid; place-items: center;
  font-family: var(--serif); font-size: 14px;
  background: var(--paper-2); border-radius: 6px;
  color: var(--ink);
}
.dept-pill.on{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.dept-pill.on .crest{background: rgba(255,255,255,.12); color: var(--paper);}

/* Description blocks (same as jobs) */
.blocks{display: flex; flex-direction: column; gap: 4px; margin-top: 6px; position: relative;}
.block{position: relative; padding: 8px 0; display: flex; gap: 12px;}
.block .gutter{width: 24px; flex-shrink: 0; display:flex; align-items: flex-start; justify-content: center; padding-top: 8px; opacity: 0; transition: opacity .12s;}
.block:hover .gutter{opacity: 1;}
.block .gutter button{appearance: none; border: 0; width: 22px; height: 22px;
  display:grid; place-items: center; background: transparent;
  color: var(--ink-4); cursor: grab; border-radius: 5px;}
.block .gutter button:hover{background: rgba(0,0,0,.04); color: var(--ink-2);}
.block .content{flex: 1; min-width: 0;}
.block .content [contenteditable]{outline: 0;}
.block.h .content [contenteditable]{font-family: var(--serif); font-size: 26px; line-height: 1.15; letter-spacing: -0.012em; font-weight: 400; color: var(--ink);}
.block.p .content [contenteditable]{font-size: 15.5px; line-height: 1.55; color: var(--ink-2);}
.block.l .content [contenteditable]{font-size: 15.5px; line-height: 1.6; color: var(--ink-2);}
.block.l .content{padding-left: 20px; position: relative;}
.block.l .content::before{content:""; position: absolute; left: 0; top: 16px; width: 8px; height: 1px; background: var(--claret);}
[contenteditable]:empty::before{content: attr(data-ph); color: var(--ink-4); font-style: italic;}

.add-block-row{
  display: flex; align-items: center; gap: 8px;
  margin: 14px 0 0; padding: 6px 0;
  opacity: 0.7; transition: opacity .15s;
}
.add-block-row:hover{opacity: 1;}
.add-block-row::before{content:""; flex: 1; height: 0.5px; background: var(--rule);}
.add-block-row::after{content:""; flex: 1; height: 0.5px; background: var(--rule);}
.add-block-row .actions{display: flex; gap: 4px;}
.add-block-row button{
  appearance: none; border: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.6);
  height: 26px; padding: 0 10px;
  border-radius: 999px; font-size: 11.5px; cursor: pointer;
  color: var(--ink-3);
  display: flex; align-items: center; gap: 5px;
}
.add-block-row button:hover{color: var(--ink); background: white;}

/* AI card */
.ai-card{
  position: relative;
  margin: 4px 0 14px;
  padding: 12px 14px;
  border: 0.5px dashed rgba(176,138,62,.6);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(176,138,62,0.05), rgba(176,138,62,0.02));
  display: flex; gap: 12px; align-items: flex-start;
}
.ai-card .gem{
  width: 28px; height: 28px; border-radius: 8px;
  display:grid; place-items:center;
  background: linear-gradient(135deg, #b08a3e, #d4ad5b);
  color: white; flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(176,138,62,.3);
}
.ai-card .body{flex: 1;}
.ai-card .body b{font-weight: 500; font-size: 13px;}
.ai-card .body p{margin: 2px 0 8px; font-size: 12.5px; color: var(--ink-2); line-height: 1.4;}
.ai-card .actions{display: flex; gap: 6px;}
.ai-card .actions button{
  appearance: none; border: 0.5px solid rgba(176,138,62,.4);
  background: rgba(255,255,255,.7); color: var(--ink);
  padding: 4px 10px; border-radius: 6px;
  font-size: 11.5px; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
}
.ai-card .actions button:hover{background: white;}
.ai-card .actions button.primary{background: var(--ink); color: var(--paper); border-color: var(--ink);}

/* Action bar */
.action-bar{
  position: sticky; bottom: 0; z-index: 8;
  margin-top: auto;
  background: rgba(250,247,242,.92);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-top: 0.5px solid var(--rule);
  padding: 14px 36px;
  display: flex; align-items: center; gap: 10px;
}
.action-bar .progress{display:flex; align-items: center; gap: 10px; font-size: 12px; color: var(--ink-3);}
.action-bar .bar{width: 140px; height: 4px; border-radius: 999px; background: var(--paper-3); overflow: hidden;}
.action-bar .bar i{display:block; height: 100%; background: var(--ink); transition: width .4s;}
.action-bar .spacer{flex: 1;}
.btn{
  appearance: none; border: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.7); color: var(--ink);
  padding: 9px 16px; border-radius: 8px;
  font-size: 13px; cursor: pointer;
  display:flex; align-items: center; gap: 6px; font-weight: 500;
}
.btn:hover{background: white;}
.btn.primary{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.btn.primary:hover{background: var(--ink-2);}
.btn.danger{color: var(--claret);}
.next-btn{background: var(--ink); color: var(--paper); border-color: var(--ink); padding: 9px 18px;}
.next-btn:hover{background: var(--ink-2);}

/* Toggle cards — same chrome as jobs */
.settings-grid{display: grid; grid-template-columns: 1fr 1fr; gap: 18px;}
.toggle-card{
  border: 0.5px solid var(--rule-2); border-radius: 12px;
  padding: 16px 18px; background: rgba(255,255,255,.55);
  cursor: pointer; transition: background .12s, border-color .12s;
  position: relative;
}
.toggle-card:hover{background: white;}
.toggle-card.on{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.toggle-card .h{display:flex; align-items: center; gap: 8px; font-weight: 500; font-size: 14px;}
.toggle-card .h .ic{
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--paper-2); display: grid; place-items: center;
  color: var(--ink-2);
}
.toggle-card.on .h .ic{background: rgba(255,255,255,.12); color: var(--paper);}
.toggle-card .desc{font-size: 12.5px; color: var(--ink-3); margin: 8px 0 0; line-height: 1.45;}
.toggle-card.on .desc{color: rgba(250,247,242,.7);}
.toggle-card .check{
  position: absolute; top: 14px; right: 14px;
  width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid var(--rule-2);
  display: grid; place-items: center; background: white;
}
.toggle-card.on .check{background: var(--leaf); border-color: var(--leaf); color: white;}

/* Cover picker */
.cover-picker{display:flex; gap: 8px; flex-wrap: wrap;}
.cover-thumb{
  width: 88px; height: 60px; border-radius: 8px;
  cursor: pointer; overflow: hidden; position: relative;
  border: 1.5px solid transparent;
  transition: border-color .12s;
}
.cover-thumb.on{border-color: var(--ink);}
.cover-thumb .label{position: absolute; bottom: 4px; left: 6px; font-size: 9px; color: white; opacity: .7;}

/* Date / time inputs */
.date-field input, .time-field input{font-family: var(--mono); font-feature-settings: "tnum" 1;}

/* Schedule visual rail — a small horizontal timeline that updates with the dates */
.schedule-rail{
  display:grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 0; margin: 0 0 18px;
  border: 0.5px solid var(--rule-2); border-radius: 12px;
  background: rgba(255,255,255,.55);
  overflow: hidden;
}
.schedule-rail .col{
  padding: 14px 18px;
  border-right: 0.5px solid var(--rule);
  display:flex; flex-direction: column; gap: 4px;
  position: relative;
}
.schedule-rail .col:last-child{border-right: 0;}
.schedule-rail .col .lbl{font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-4);}
.schedule-rail .col .day{font-family: var(--serif); font-size: 22px; line-height: 1; letter-spacing: -0.01em;}
.schedule-rail .col .time{font-family: var(--mono); font-size: 11.5px; color: var(--ink-3);}
.schedule-rail .col .none{font-style: italic; color: var(--ink-4); font-size: 13px;}
.schedule-rail .conn{
  position: absolute; right: -6px; top: 50%; transform: translateY(-50%);
  width: 12px; height: 12px; border-radius: 50%; background: var(--paper);
  border: 0.5px solid var(--rule-2);
  display: grid; place-items: center;
  font-size: 8px; color: var(--ink-4); z-index: 2;
}

/* Location mode segmented */
.loc-modes{display:flex; gap: 6px;}
.loc-mode{
  flex: 1; padding: 10px 12px;
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  background: rgba(255,255,255,.5);
  cursor: pointer;
  display: flex; align-items: center; gap: 10px;
  transition: background .12s, border-color .12s;
}
.loc-mode:hover{background: white;}
.loc-mode.on{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.loc-mode .ic{width: 28px; height: 28px; border-radius: 8px; background: var(--paper-2);
  display: grid; place-items: center; color: var(--ink-2);}
.loc-mode.on .ic{background: rgba(255,255,255,.12); color: var(--paper);}
.loc-mode b{font-size: 13px; font-weight: 500;}
.loc-mode span{font-size: 11px; color: var(--ink-3); display: block;}
.loc-mode.on span{color: rgba(250,247,242,.7);}

/* Capacity stepper */
.cap-stepper{
  display:flex; align-items: stretch; gap: 0;
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  background: rgba(255,255,255,.55); overflow: hidden;
  width: fit-content;
}
.cap-stepper input{
  appearance: none; -moz-appearance: textfield;
  border: 0; outline: 0; background: transparent;
  width: 80px; text-align: center;
  font-family: var(--mono); font-feature-settings: "tnum" 1;
  font-size: 18px; color: var(--ink);
}
.cap-stepper input::-webkit-outer-spin-button,
.cap-stepper input::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }
.cap-stepper button{
  appearance: none; border: 0; background: transparent;
  width: 32px; cursor: pointer; color: var(--ink-3);
  font-size: 18px; line-height: 1;
}
.cap-stepper button:hover{background: rgba(0,0,0,.04); color: var(--ink);}
.cap-stepper button:first-child{border-right: 0.5px solid var(--rule-2);}
.cap-stepper button:last-child{border-left: 0.5px solid var(--rule-2);}

/* Pricing visualizer */
.price-card{
  border: 0.5px solid var(--rule-2); border-radius: 12px;
  background: rgba(255,255,255,.55);
  padding: 14px 16px;
  display:flex; flex-direction: column; gap: 12px;
}
.price-card .top{display: flex; align-items: baseline; gap: 14px;}
.price-card .top .amount{font-family: var(--serif); font-size: 38px; line-height: 1; letter-spacing: -0.015em;}
.price-card .top .amount.free{color: var(--leaf); font-style: italic;}
.price-card .top .of{font-size: 12.5px; color: var(--ink-3);}
.price-card .row{display: flex; align-items: center; gap: 10px;}
.price-card .row label{font-size: 11.5px; color: var(--ink-3); width: 110px;}
.price-card .row input{
  width: 120px; font-family: var(--mono);
  border: 0.5px solid var(--rule-2); background: white; border-radius: 6px;
  padding: 6px 10px; font-size: 13px; outline: 0;
}
.price-card .row .suffix{font-size: 11px; color: var(--ink-4);}
.price-card .preview-bit{
  background: var(--paper-2); border-radius: 8px; padding: 8px 12px;
  font-size: 11.5px; color: var(--ink-3);
}
.price-card .preview-bit b{font-family: var(--serif); font-size: 14px; color: var(--ink); font-weight: 400;}
`;

function EvStepRail({ step, setStep, dirty }) {
  const steps = [
    { id: 0, name: "Essentials" },
    { id: 1, name: "Description" },
    { id: 2, name: "Schedule & venue" },
    { id: 3, name: "Tickets & audience" },
    { id: 4, name: "Review" },
  ];
  return (
    <div className="step-rail">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          {i > 0 && <div className="step-sep"></div>}
          <div
            className={"step" + (s.id === step ? " active" : s.id < step ? " done" : "")}
            onClick={() => setStep(s.id)}
          >
            <span className="num">{s.id < step ? <I.check size={11}/> : (s.id+1).toString().padStart(2,"0")}</span>
            <span>{s.name}</span>
          </div>
        </React.Fragment>
      ))}
      <div className="right">
        {dirty && <span className="unsaved"><i></i> Unsaved</span>}
        <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }}><I.eye size={13}/> Preview</button>
      </div>
    </div>
  );
}

function EvLangTabs({ locale, setLocale, syncedNo }) {
  return (
    <div className="lang-tabs">
      <button className={locale === "en" ? "on" : ""} onClick={() => setLocale("en")}>
        <span className="flag" style={{ background: "linear-gradient(180deg, #012169 33%, #fff 33% 66%, #c8102e 66%)" }}></span>
        English <span style={{ color: "var(--ink-4)", fontSize: 10 }}>· source</span>
      </button>
      <button className={locale === "no" ? "on" : ""} onClick={() => setLocale("no")}>
        <span className="flag" style={{ background: "linear-gradient(180deg, #ef2b2d 35%, #fff 35% 45%, #002868 45% 55%, #fff 55% 65%, #ef2b2d 65%)" }}></span>
        Norsk
        {syncedNo && <span className="ai-dot" title="AI-translated"></span>}
      </button>
    </div>
  );
}

function EvEssentialsStep({ draft, set }) {
  const [localeTab, setLocaleTab] = React.useState("en");
  return (
    <div>
      <div className="title-block">
        <EvLangTabs locale={localeTab} setLocale={setLocaleTab} syncedNo={true} />
        <input
          className="title-input"
          autoFocus
          placeholder="A night with a name…"
          value={localeTab === "en" ? draft.titleEn : draft.titleNo}
          onChange={(e) => set(localeTab === "en" ? "titleEn" : "titleNo", e.target.value)}
        />
        <div className="slug-line">
          <span>biso.no/oslo/events/</span>
          <b>{draft.slug || "untitled-event"}</b>
          <span className="edit"><I.edit size={11}/></span>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="field-label"><I.events size={12}/> Category <span className="req">required</span><span className="help">How students filter</span></div>
          <div className="dept-picker">
            {EVENT_CATEGORIES.map(c => (
              <div key={c.id} className={"dept-pill" + (draft.category === c.id ? " on" : "")} onClick={() => set("category", c.id)}>
                <span className="crest">{c.crest}</span>
                {c.name}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.building size={12}/> Hosted by <span className="help">Appears under the title</span></div>
          <div className="dept-picker">
            {DEPARTMENTS.slice(0, 8).map(d => (
              <div key={d.id} className={"dept-pill" + (draft.department === d.id ? " on" : "")} onClick={() => set("department", d.id)}>
                <span className="crest">{d.crest}</span>
                {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-label">
            <I.flag size={12}/> One-line teaser <span className="req">required</span>
            <span className="help">Shown in lists. {120 - (draft.shortEn?.length || 0)} characters left.</span>
          </div>
          <textarea
            className="field-input large"
            placeholder="Why should a tired Tuesday-night student get on the metro for this?"
            value={draft.shortEn || ""}
            onChange={(e) => set("shortEn", e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label"><I.spark2 size={12}/> Tags <span className="help">Up to 5 — helps the algorithm</span></div>
          <div className="dept-picker">
            {["Welcome week","International","Free","Networking","Career","Food included","After-party","Beginner-friendly","Members only","Sport","Outdoor"].map(t => (
              <div key={t} className={"dept-pill" + (draft.tags?.includes(t) ? " on" : "")} style={{ padding: "5px 12px" }} onClick={() => {
                const ex = draft.tags || [];
                set("tags", ex.includes(t) ? ex.filter(x => x !== t) : [...ex, t].slice(0,5));
              }}>{t}</div>
            ))}
          </div>
        </div>

        <div className="ai-card">
          <div className="gem"><I.spark2 size={14}/></div>
          <div className="body">
            <b>This looks like a Welcome-week social.</b>
            <p>Want me to pre-fill the tags and hint at a Kantina booking? Most ESN socials run Tuesday or Thursday evenings and reach capacity within 36 hours.</p>
            <div className="actions">
              <button className="primary"><I.spark2 size={11}/> Pre-fill from past socials</button>
              <button>Not now</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvBlock({ block, idx, onChange, onSlash, onEnter }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text && !ref.current.matches(":focus")) {
      ref.current.innerText = block.text || "";
    }
  }, [block.text]);
  const placeholders = {
    h: "Section heading…",
    p: "Tell the story. Who's coming? What does the room look like at 8pm?",
    l: "A timing, a perk, a what-to-expect…",
  };
  return (
    <div className={"block " + block.type}>
      <div className="gutter"><button><I.drag size={12}/></button></div>
      <div className="content">
        <div
          ref={ref} contentEditable suppressContentEditableWarning
          data-ph={placeholders[block.type]}
          onInput={(e) => onChange(idx, e.currentTarget.innerText)}
          onKeyDown={(e) => {
            if (e.key === "/") onSlash?.(idx, e);
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter?.(idx); }
          }}
        >{block.text}</div>
      </div>
    </div>
  );
}

function EvDescriptionStep({ draft, set }) {
  const blocks = React.useMemo(() => {
    const out = [];
    (draft.descEn || []).forEach(b => {
      if (b.type === "l") b.items.forEach(it => out.push({ type: "l", text: it }));
      else out.push({ type: b.type, text: b.text });
    });
    return out;
  }, [draft.descEn]);

  function setBlock(i, text) {
    const copy = blocks.slice();
    copy[i] = { ...copy[i], text };
    syncBack(copy);
  }
  function syncBack(arr) {
    const out = [];
    arr.forEach(b => {
      if (b.type === "l") {
        const prev = out[out.length - 1];
        if (prev && prev.type === "l") prev.items.push(b.text);
        else out.push({ type: "l", items: [b.text] });
      } else out.push({ type: b.type, text: b.text });
    });
    set("descEn", out);
  }
  function addBlock(type) { syncBack([...blocks, { type, text: "" }]); }

  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 8 }}>
        <EvLangTabs locale="en" setLocale={() => {}} />
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.1, marginTop: 6, color: "var(--ink-2)" }}>
          The whole night.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 6, maxWidth: "50ch" }}>
          Set the mood, then break down the run-of-show. Hit <span className="kbd">/</span> for a heading or a bullet list. <span className="kbd">⏎</span> starts a new paragraph.
        </p>
      </div>

      <div className="blocks">
        {blocks.map((b, i) => (
          <EvBlock key={i} block={b} idx={i} onChange={setBlock} />
        ))}
      </div>

      <div className="add-block-row">
        <div className="actions">
          <button onClick={() => addBlock("h")}><I.h1 size={11}/> Heading</button>
          <button onClick={() => addBlock("p")}><I.bold size={11}/> Paragraph</button>
          <button onClick={() => addBlock("l")}><I.list size={11}/> Bullet</button>
          <button><I.sparkle size={11}/> Suggest run-of-show</button>
        </div>
      </div>

      <div className="ai-card" style={{ marginTop: 28 }}>
        <div className="gem"><I.spark2 size={14}/></div>
        <div className="body">
          <b>Want a run-of-show block?</b>
          <p>Most ESN socials read better with a minute-by-minute timeline near the top. I'll draft one from the bullet list below — you can edit before publish.</p>
          <div className="actions">
            <button className="primary"><I.spark2 size={11}/> Draft run-of-show</button>
            <button>Keep as is</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvScheduleStep({ draft, set }) {
  const startISO = draft.startDate;
  const endISO = draft.endDate;
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          When, where, how many.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          Once the date is in, calendar buttons and reminders wire themselves up automatically. Capacity sets the cut-off for the waitlist.
        </p>
      </div>

      {/* Schedule rail */}
      <div className="schedule-rail">
        <div className="col">
          <div className="lbl">Doors open</div>
          {startISO ? (
            <>
              <div className="day">{fmtDay(startISO)}</div>
              <div className="time">{fmtTime(startISO)}</div>
            </>
          ) : <div className="none">Not set</div>}
          <div className="conn">→</div>
        </div>
        <div className="col">
          <div className="lbl">Wraps up</div>
          {endISO ? (
            <>
              <div className="day">{fmtDay(endISO)}</div>
              <div className="time">{fmtTime(endISO)}</div>
            </>
          ) : <div className="none">Not set</div>}
          <div className="conn">·</div>
        </div>
        <div className="col">
          <div className="lbl">Duration</div>
          <div className="day" style={{ fontSize: 22 }}>{durationHrs(startISO, endISO) || "—"}</div>
          <div className="time">{startISO && endISO ? "incl. setup" : "set start + end"}</div>
        </div>
      </div>

      <div className="field-grid">
        <div className="row-2">
          <div className="field">
            <div className="field-label"><I.events size={12}/> Start <span className="req">required</span></div>
            <input className="field-input" type="datetime-local" value={draft.startDate}
              onChange={e => set("startDate", e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label"><I.clock size={12}/> End</div>
            <input className="field-input" type="datetime-local" value={draft.endDate}
              onChange={e => set("endDate", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.clock size={12}/> Registration closes</div>
          <input className="field-input" type="datetime-local" value={draft.registrationDeadline || ""}
            onChange={e => set("registrationDeadline", e.target.value)} />
        </div>

        <div className="field">
          <div className="field-label"><I.pin size={12}/> Where is it</div>
          <div className="loc-modes">
            {[
              { id: "physical", label: "On campus", desc: "A room, a venue", ic: <I.pin size={14}/> },
              { id: "online",   label: "Online",    desc: "Teams, Zoom, etc", ic: <I.globe size={14}/> },
              { id: "hybrid",   label: "Hybrid",    desc: "Both, in parallel", ic: <I.link size={14}/> },
            ].map(m => (
              <div key={m.id} className={"loc-mode" + (draft.locationMode === m.id ? " on" : "")} onClick={() => set("locationMode", m.id)}>
                <div className="ic">{m.ic}</div>
                <div>
                  <b>{m.label}</b>
                  <span>{m.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {draft.locationMode !== "online" && (
          <div className="field">
            <div className="field-label"><I.building size={12}/> Venue address</div>
            <input className="field-input" value={draft.location || ""}
              onChange={e => set("location", e.target.value)}
              placeholder="BI Oslo · Kantina (Nydalen)" />
          </div>
        )}
        {draft.locationMode !== "physical" && (
          <div className="field">
            <div className="field-label"><I.link size={12}/> Online link <span className="help">Sent on registration</span></div>
            <input className="field-input" value={draft.onlineUrl || ""}
              onChange={e => set("onlineUrl", e.target.value)}
              placeholder="https://teams.microsoft.com/l/…" />
          </div>
        )}

        <div className="row-2">
          <div className="field">
            <div className="field-label"><I.people size={12}/> Capacity</div>
            <div className="cap-stepper">
              <button onClick={() => set("capacity", Math.max(0, (draft.capacity || 0) - 10))}>−</button>
              <input type="number" value={draft.capacity || 0}
                onChange={e => set("capacity", parseInt(e.target.value || "0", 10))} />
              <button onClick={() => set("capacity", (draft.capacity || 0) + 10)}>+</button>
            </div>
          </div>
          <div className="field">
            <div className="field-label"><I.clock size={12}/> Waitlist</div>
            <div className={"toggle-card" + (draft.waitlist ? " on" : "")} style={{ padding: "10px 12px", cursor: "pointer" }} onClick={() => set("waitlist", !draft.waitlist)}>
              <div className="h" style={{ fontSize: 13 }}>
                <span className="ic" style={{ width: 22, height: 22 }}><I.clock size={12}/></span>
                {draft.waitlist ? "On — open when full" : "Off"}
              </div>
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.eye size={12}/> Cover artwork</div>
          <div className="cover-picker">
            {[1,2,3,4,5].map(p => (
              <div key={p} className={"cover-thumb" + (draft.coverPattern === p ? " on" : "")}
                   onClick={() => set("coverPattern", p)}>
                <div className={"ev-hero p" + p} style={{ height: "100%" }}>
                  <EvCoverPattern which={p} />
                </div>
                <span className="label">{["Dotted","Linear","Concentric","Wave","Grid"][p-1]}</span>
              </div>
            ))}
            <div className="cover-thumb" style={{ background: "var(--paper-2)", border: "1.5px dashed var(--rule-2)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
              <I.upload size={16}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvTicketsStep({ draft, set }) {
  const isFree = draft.pricingMode === "free";
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          Doors, tickets, who's invited.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          Free events skip Stripe entirely. Paid events route through the existing BISO Webshop and apply member pricing automatically.
        </p>
      </div>

      <div className="settings-grid" style={{ marginBottom: 22 }}>
        <div className={"toggle-card" + (isFree ? " on" : "")} onClick={() => set("pricingMode", "free")}>
          <div className="h"><span className="ic"><I.spark2 size={14}/></span> Free</div>
          <div className="desc">No payment. Sign-ups are first-come, first-served. Best for socials, talks and casual mixers.</div>
          <div className="check">{isFree && <I.check size={11}/>}</div>
        </div>
        <div className={"toggle-card" + (!isFree ? " on" : "")} onClick={() => set("pricingMode", "paid")}>
          <div className="h"><span className="ic"><I.shop size={14}/></span> Paid ticket</div>
          <div className="desc">Routes through the BISO Webshop. Members get the member price; everyone else pays the regular price.</div>
          <div className="check">{!isFree && <I.check size={11}/>}</div>
        </div>
      </div>

      {!isFree && (
        <div className="price-card" style={{ marginBottom: 22 }}>
          <div className="top">
            <div className="amount">{fmtNOK(draft.price)}</div>
            <div className="of">regular ticket</div>
            {draft.memberPrice > 0 && draft.memberPrice < draft.price && (
              <>
                <div className="amount" style={{ fontSize: 26, color: "var(--leaf)" }}>{fmtNOK(draft.memberPrice)}</div>
                <div className="of">members</div>
              </>
            )}
          </div>
          <div className="row">
            <label>Regular price</label>
            <input type="number" value={draft.price} onChange={e => set("price", parseInt(e.target.value || "0", 10))} />
            <span className="suffix">NOK incl. VAT</span>
          </div>
          <div className="row">
            <label>Member price</label>
            <input type="number" value={draft.memberPrice} onChange={e => set("memberPrice", parseInt(e.target.value || "0", 10))} />
            <span className="suffix">NOK · 0 = same as regular</span>
          </div>
          <div className="preview-bit">
            BISO members save <b>{fmtNOK(Math.max(0, draft.price - (draft.memberPrice || draft.price)))}</b> per ticket. Estimated take: <b>{fmtNOK(draft.price * (draft.capacity || 0) * 0.7)}</b> at 70% fill.
          </div>
        </div>
      )}

      <div className="field-grid">
        <div className="settings-grid">
          <div className={"toggle-card" + (draft.memberOnly ? " on" : "")} onClick={() => set("memberOnly", !draft.memberOnly)}>
            <div className="h"><span className="ic"><I.lock size={14}/></span> Members only</div>
            <div className="desc">Only verified BISO members can register. Best for paid socials and members-only mixers.</div>
            <div className="check">{draft.memberOnly && <I.check size={11}/>}</div>
          </div>
          <div className={"toggle-card" + (!draft.memberOnly ? " on" : "")} onClick={() => set("memberOnly", false)}>
            <div className="h"><span className="ic"><I.globe size={14}/></span> Open to all BI students</div>
            <div className="desc">Anyone with a BI email can register. Recommended for first-week orientation events.</div>
            <div className="check">{!draft.memberOnly && <I.check size={11}/>}</div>
          </div>

          <div className={"toggle-card" + (draft.isCollection ? " on" : "")} onClick={() => set("isCollection", !draft.isCollection)}>
            <div className="h"><span className="ic"><I.copy size={14}/></span> Part of a series</div>
            <div className="desc">Group this with other events in a collection — students get one bundle ticket and a unified landing page.</div>
            <div className="check">{draft.isCollection && <I.check size={11}/>}</div>
          </div>
          <div className="toggle-card">
            <div className="h"><span className="ic"><I.bell size={14}/></span> Push notification</div>
            <div className="desc">Notify <b>4,217</b> students who follow the ESN tag. Sends once when published.</div>
            <div className="check"><I.check size={11}/></div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 10 }}>
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
          <div className="field-label"><I.people size={12}/> Point of contact</div>
          <div className="row-3">
            <input className="field-input" placeholder="Name" value={draft.contactName} onChange={e => set("contactName", e.target.value)} />
            <input className="field-input" placeholder="Role" value={draft.contactRole} onChange={e => set("contactRole", e.target.value)} />
            <input className="field-input" placeholder="Email" value={draft.contactEmail} onChange={e => set("contactEmail", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ai-card" style={{ marginTop: 22 }}>
        <div className="gem" style={{ background: "linear-gradient(135deg, #2f5d3a, #4a8359)" }}><I.check size={14}/></div>
        <div className="body">
          <b>This event meets BISO publishing standards.</b>
          <p>GDPR consent text auto-attached · Inclusive language score 9.4/10 · No restricted partners detected.</p>
        </div>
      </div>
    </div>
  );
}

function EvReviewStep({ draft, setStep }) {
  const d = dept(draft.department), c = campus(draft.campus);
  const cat = evCat(draft.category) || {};
  const rows = [
    { label: "Title (EN)", value: draft.titleEn, step: 0 },
    { label: "Title (NO)", value: draft.titleNo, step: 0 },
    { label: "Category · Host", value: `${cat.name || "—"} · ${d?.name || "—"}`, step: 0 },
    { label: "Teaser", value: draft.shortEn, step: 0 },
    { label: "Description", value: `${draft.descEn.length} blocks`, step: 1 },
    { label: "When", value: `${fmtDay(draft.startDate)} · ${fmtTime(draft.startDate)} → ${fmtTime(draft.endDate)} (${durationHrs(draft.startDate, draft.endDate) || "—"})`, step: 2 },
    { label: "Where", value: draft.locationMode === "online" ? "Online" : draft.location, step: 2 },
    { label: "Capacity", value: `${draft.capacity} ${draft.waitlist ? "· waitlist on" : ""}`, step: 2 },
    { label: "Price", value: draft.pricingMode === "free" ? "Free" : `${fmtNOK(draft.price)} · ${fmtNOK(draft.memberPrice)} for members`, step: 3 },
    { label: "Audience", value: draft.memberOnly ? "Members only · 4,217 students" : "All BI students · 6,840 students", step: 3 },
    { label: "Series", value: draft.isCollection ? `Yes · ${draft.collectionPricing} pricing` : "No", step: 3 },
    { label: "Contact", value: `${draft.contactName} (${draft.contactEmail})`, step: 3 },
  ];
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          One last look.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          Click any row to jump back and edit. When you're happy, hit Publish — the event goes on biso.no and the BISO app at the same moment.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "0.5px solid var(--rule)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,.5)" }}>
        {rows.map((row, i) => (
          <div key={i} onClick={() => setStep(row.step)} style={{
            display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 14,
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
          <p>The Norwegian translation hasn't been reviewed yet — students switching to NO will see the AI version. Also: registration closes the night before doors — students who decide late might miss the cutoff.</p>
          <div className="actions">
            <button>Review NO translation</button>
            <button>Push registration cutoff</button>
            <button className="primary">Publish anyway</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventComposerEditor({ draft, set, step, setStep, dirty, onPublish }) {
  const stepTitles = ["Essentials","Description","Schedule & venue","Tickets & audience","Review"];
  let progress = 0.4;
  if (step === 1) progress = 0.6;
  if (step === 2) progress = 0.78;
  if (step === 3) progress = 0.92;
  if (step === 4) progress = 1;

  const d = dept(draft.department), c = campus(draft.campus);
  return (
    <div className="editor scroll">
      <EvStepRail step={step} setStep={setStep} dirty={dirty} />
      <div className="doc">
        <div className="doc-hd">
          <span className="kicker">{d?.name || "—"} · {c?.name}</span>
          <span className="dot"></span>
          <span className="step-name">Step {step+1} of 5 · {stepTitles[step]}</span>
        </div>

        {step === 0 && <EvEssentialsStep draft={draft} set={set} />}
        {step === 1 && <EvDescriptionStep draft={draft} set={set} />}
        {step === 2 && <EvScheduleStep draft={draft} set={set} />}
        {step === 3 && <EvTicketsStep draft={draft} set={set} />}
        {step === 4 && <EvReviewStep draft={draft} setStep={setStep} />}
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
            <I.spark2 size={13}/> Publish event
          </button>
        )}
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = evComposerCSS; document.head.appendChild(s); })();
window.EventComposerEditor = EventComposerEditor;
