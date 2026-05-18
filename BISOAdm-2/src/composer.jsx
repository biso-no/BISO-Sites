// The composer — main editor. Multi-step, with rich content fields and live preview alongside.

const composerCSS = `
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

/* Step rail at top */
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

.step-rail .right{
  margin-left: auto; display: flex; align-items: center; gap: 10px;
}
.unsaved{
  display:flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--ink-3);
}
.unsaved i{width: 5px; height: 5px; border-radius: 50%; background: var(--gold);}

/* Document area */
.doc{
  max-width: 680px; margin: 0 auto; padding: 32px 44px 120px;
  width: 100%;
}
.doc-hd{
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 24px;
}
.doc-hd .kicker{
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-4);
}
.doc-hd .dot{width: 4px; height: 4px; border-radius: 50%; background: var(--ink-4);}
.doc-hd .step-name{font-size: 12px; color: var(--ink-3);}

.title-block{
  position: relative;
  padding: 8px 0 24px;
}
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
.lang-tabs button .flag{
  width: 14px; height: 10px; border-radius: 1px; overflow: hidden;
  display: inline-block; position: relative;
}
.lang-tabs button.on{background: white; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.05);}
.lang-tabs button .ai-dot{width: 5px; height: 5px; border-radius: 50%; background: var(--gold);}

.title-input{
  appearance: none; border: 0; outline: 0; background: transparent;
  width: 100%;
  font-family: var(--serif); font-size: 56px; line-height: 1.0;
  letter-spacing: -0.018em; color: var(--ink);
  padding: 0;
  font-weight: 400;
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

/* Field cards */
.field-grid{display: grid; gap: 22px;}
.field{
  display: flex; flex-direction: column; gap: 6px;
}
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

textarea.field-input{min-height: 70px;}

.field-input.large{font-size: 16px; padding: 12px 14px;}

.row-2{display: grid; grid-template-columns: 1fr 1fr; gap: 14px;}
.row-3{display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;}

/* Department picker */
.dept-picker{
  display: flex; flex-wrap: wrap; gap: 6px;
}
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
.dept-pill.on{
  background: var(--ink); color: var(--paper); border-color: var(--ink);
}
.dept-pill.on .crest{background: rgba(255,255,255,.12); color: var(--paper);}

/* Editor blocks */
.blocks{
  display: flex; flex-direction: column; gap: 4px;
  margin-top: 6px;
  position: relative;
}
.block{
  position: relative; padding: 8px 0;
  display: flex; gap: 12px;
}
.block .gutter{
  width: 24px; flex-shrink: 0;
  display:flex; align-items: flex-start; justify-content: center;
  padding-top: 8px;
  opacity: 0; transition: opacity .12s;
}
.block:hover .gutter{opacity: 1;}
.block .gutter button{
  appearance: none; border: 0;
  width: 22px; height: 22px;
  display:grid; place-items: center;
  background: transparent;
  color: var(--ink-4); cursor: grab;
  border-radius: 5px;
}
.block .gutter button:hover{background: rgba(0,0,0,.04); color: var(--ink-2);}
.block .content{flex: 1; min-width: 0;}
.block .content [contenteditable]{outline: 0;}
.block.h .content [contenteditable]{
  font-family: var(--serif); font-size: 26px; line-height: 1.15;
  letter-spacing: -0.012em; font-weight: 400;
  color: var(--ink);
}
.block.p .content [contenteditable]{
  font-size: 15.5px; line-height: 1.55; color: var(--ink-2);
}
.block.l .content [contenteditable]{
  font-size: 15.5px; line-height: 1.6; color: var(--ink-2);
}
.block.l .content {
  padding-left: 20px; position: relative;
}
.block.l .content::before{
  content:""; position: absolute; left: 0; top: 16px;
  width: 8px; height: 1px; background: var(--claret);
}

[contenteditable]:empty::before{
  content: attr(data-ph); color: var(--ink-4); font-style: italic;
}

/* Block adder */
.add-block-row{
  display: flex; align-items: center; gap: 8px;
  margin: 14px 0 0; padding: 6px 0;
  opacity: 0.7;
  transition: opacity .15s;
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

/* AI assist callout */
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
  color: white;
  flex-shrink: 0;
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

/* Bottom action bar */
.action-bar{
  position: sticky; bottom: 0; z-index: 8;
  margin-top: auto;
  background: rgba(250,247,242,.92);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border-top: 0.5px solid var(--rule);
  padding: 14px 36px;
  display: flex; align-items: center; gap: 10px;
}
.action-bar .progress{
  display:flex; align-items: center; gap: 10px;
  font-size: 12px; color: var(--ink-3);
}
.action-bar .bar{
  width: 140px; height: 4px; border-radius: 999px;
  background: var(--paper-3); overflow: hidden;
}
.action-bar .bar i{display:block; height: 100%; background: var(--ink); transition: width .4s;}
.action-bar .spacer{flex: 1;}

.btn{
  appearance: none; border: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.7); color: var(--ink);
  padding: 9px 16px; border-radius: 8px;
  font-size: 13px; cursor: pointer;
  display:flex; align-items: center; gap: 6px;
  font-weight: 500;
}
.btn:hover{background: white;}
.btn.primary{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.btn.primary:hover{background: var(--ink-2);}
.btn.danger{color: var(--claret);}

.next-btn{
  background: var(--ink); color: var(--paper); border-color: var(--ink);
  padding: 9px 18px;
}
.next-btn:hover{background: var(--ink-2);}

/* Settings step */
.settings-grid{display: grid; grid-template-columns: 1fr 1fr; gap: 18px;}
.toggle-card{
  border: 0.5px solid var(--rule-2); border-radius: 12px;
  padding: 16px 18px; background: rgba(255,255,255,.55);
  cursor: pointer;
  transition: background .12s, border-color .12s;
  position: relative;
}
.toggle-card:hover{background: white;}
.toggle-card.on{background: var(--ink); color: var(--paper); border-color: var(--ink);}
.toggle-card .h{display:flex; align-items: center; gap: 8px; font-weight: 500; font-size: 14px;}
.toggle-card .h .ic{
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--paper-2);
  display: grid; place-items: center;
  color: var(--ink-2);
}
.toggle-card.on .h .ic{background: rgba(255,255,255,.12); color: var(--paper);}
.toggle-card .desc{font-size: 12.5px; color: var(--ink-3); margin: 8px 0 0; line-height: 1.45;}
.toggle-card.on .desc{color: rgba(250,247,242,.7);}
.toggle-card .check{
  position: absolute; top: 14px; right: 14px;
  width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid var(--rule-2);
  display: grid; place-items: center;
  background: white;
}
.toggle-card.on .check{background: var(--leaf); border-color: var(--leaf); color: white;}

/* Cover picker */
.cover-picker{display:flex; gap: 8px; flex-wrap: wrap;}
.cover-thumb{
  width: 78px; height: 56px; border-radius: 8px;
  cursor: pointer; overflow: hidden; position: relative;
  border: 1.5px solid transparent;
  transition: border-color .12s;
}
.cover-thumb.on{border-color: var(--ink);}
.cover-thumb .label{position: absolute; bottom: 4px; left: 6px; font-size: 9px; color: white; opacity: .7;}

/* Date input wrapper */
.date-field{
  position: relative;
}
.date-field input{
  font-family: var(--mono); font-feature-settings: "tnum" 1;
}
`;

function StepRail({ step, setStep, dirty }) {
  const steps = [
    { id: 0, name: "Essentials" },
    { id: 1, name: "Description" },
    { id: 2, name: "Logistics" },
    { id: 3, name: "Visibility" },
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

function LangTabs({ locale, setLocale, syncedNo }) {
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

function EssentialsStep({ draft, set }) {
  const [editingSlug, setEditingSlug] = React.useState(false);
  const [localeTab, setLocaleTab] = React.useState("en");

  return (
    <div>
      <div className="title-block">
        <LangTabs locale={localeTab} setLocale={setLocaleTab} syncedNo={true} />
        <input
          className="title-input"
          autoFocus
          placeholder="A job title that excites…"
          value={localeTab === "en" ? draft.titleEn : draft.titleNo}
          onChange={(e) => set(localeTab === "en" ? "titleEn" : "titleNo", e.target.value)}
        />
        <div className="slug-line">
          <span>biso.no/oslo/jobs/</span>
          <b>{draft.slug || "untitled-position"}</b>
          <span className="edit" onClick={() => setEditingSlug(true)}><I.edit size={11}/></span>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="field-label"><I.building size={12}/> Department <span className="req">required</span><span className="help">Who's hiring?</span></div>
          <div className="dept-picker">
            {DEPARTMENTS.slice(0, 8).map(d => (
              <div key={d.id} className={"dept-pill" + (draft.department === d.id ? " on" : "")} onClick={() => set("department", d.id)}>
                <span className="crest">{d.crest}</span>
                {d.name}
              </div>
            ))}
            <div className="dept-pill" style={{ color: "var(--ink-3)" }}>
              <span className="crest" style={{ background: "transparent", border: "0.5px dashed var(--rule-2)" }}><I.plus size={11}/></span>
              New unit
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-label">
            <I.flag size={12}/> One-line teaser <span className="req">required</span>
            <span className="help">Shown in lists. {120 - (draft.shortEn?.length || 0)} characters left.</span>
          </div>
          <textarea
            className="field-input large"
            placeholder="Why should someone scroll past their friends' Instagram stories to apply?"
            value={draft.shortEn || ""}
            onChange={(e) => set("shortEn", e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label"><I.spark2 size={12}/> Tags <span className="help">Up to 4 — helps students find this</span></div>
          <div className="dept-picker">
            {["Volunteer","Paid","Leadership","International","Marketing","Finance","Tech","Sustainability","One-time","Long-term","Remote-friendly"].map(t => (
              <div key={t} className={"dept-pill" + (draft.tags?.includes(t) ? " on" : "")} style={{ padding: "5px 12px" }} onClick={() => {
                const ex = draft.tags || [];
                set("tags", ex.includes(t) ? ex.filter(x => x !== t) : [...ex, t].slice(0,4));
              }}>{t}</div>
            ))}
          </div>
        </div>

        <div className="ai-card">
          <div className="gem"><I.spark2 size={14}/></div>
          <div className="body">
            <b>Translate to Norwegian as you go</b>
            <p>I'll auto-translate the title and teaser into Norwegian — you can review and override before publish.</p>
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

function Block({ block, idx, onChange, onSlash, onEnter }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text && !ref.current.matches(":focus")) {
      ref.current.innerText = block.text || "";
    }
  }, [block.text]);

  const placeholders = {
    h: "Section heading…",
    p: "Tell the story. What's the team like? What does a Tuesday afternoon look like?",
    l: "A responsibility, a perk, a requirement…",
  };

  return (
    <div className={"block " + block.type}>
      <div className="gutter">
        <button><I.drag size={12}/></button>
      </div>
      <div className="content">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
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

function DescriptionStep({ draft, set }) {
  // Flatten blocks for editing (lists keep items as separate "l-item" blocks for simplicity)
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
    // Re-group consecutive l-items back into a list block
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
  function addBlock(type) {
    syncBack([...blocks, { type, text: "" }]);
  }

  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 8 }}>
        <LangTabs locale="en" setLocale={() => {}} />
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.1, marginTop: 6, color: "var(--ink-2)" }}>
          The whole story.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 6, maxWidth: "50ch" }}>
          Write it like you'd tell a friend. Hit <span className="kbd">/</span> to insert a heading or a bullet list. Press <span className="kbd">⏎</span> to start a new paragraph.
        </p>
      </div>

      <div className="blocks">
        {blocks.map((b, i) => (
          <Block key={i} block={b} idx={i} onChange={setBlock} />
        ))}
      </div>

      <div className="add-block-row">
        <div className="actions">
          <button onClick={() => addBlock("h")}><I.h1 size={11}/> Heading</button>
          <button onClick={() => addBlock("p")}><I.bold size={11}/> Paragraph</button>
          <button onClick={() => addBlock("l")}><I.list size={11}/> Bullet</button>
          <button><I.sparkle size={11}/> Suggest next section</button>
        </div>
      </div>

      <div className="ai-card" style={{ marginTop: 28 }}>
        <div className="gem"><I.spark2 size={14}/></div>
        <div className="body">
          <b>Looks great — but the "We're looking for" section feels short.</b>
          <p>Most successful BISO listings have 4–6 qualifications. Want me to draft two more based on what similar roles asked for last term?</p>
          <div className="actions">
            <button className="primary"><I.spark2 size={11}/> Draft suggestions</button>
            <button>Keep as is</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogisticsStep({ draft, set }) {
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          Time, place, paper-work.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          The practical details. Anything left blank appears as "to be confirmed" on the public posting.
        </p>
      </div>

      <div className="field-grid">
        <div className="row-2">
          <div className="field">
            <div className="field-label"><I.clock size={12}/> Weekly commitment</div>
            <input className="field-input" value={draft.commitment} onChange={e => set("commitment", e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label"><I.clock size={12}/> Term length</div>
            <input className="field-input" value={draft.term} onChange={e => set("term", e.target.value)} />
          </div>
        </div>

        <div className="row-2">
          <div className="field date-field">
            <div className="field-label"><I.events size={12}/> Start date</div>
            <input className="field-input" type="date" value={draft.startDate} onChange={e => set("startDate", e.target.value)} />
          </div>
          <div className="field date-field">
            <div className="field-label"><I.events size={12}/> Application deadline <span className="req">required</span></div>
            <input className="field-input" type="date" value={draft.deadline} onChange={e => set("deadline", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.map size={12}/> Location</div>
          <input className="field-input" value={draft.location} onChange={e => set("location", e.target.value)} />
        </div>

        <div className="field">
          <div className="field-label"><I.people size={12}/> Point of contact</div>
          <div className="row-3">
            <input className="field-input" placeholder="Name" value={draft.contactName} onChange={e => set("contactName", e.target.value)} />
            <input className="field-input" placeholder="Role" value={draft.contactRole} onChange={e => set("contactRole", e.target.value)} />
            <input className="field-input" placeholder="Email" value={draft.contactEmail} onChange={e => set("contactEmail", e.target.value)} />
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.eye size={12}/> Cover artwork</div>
          <div className="cover-picker">
            {[1,2,3,4,5].map(p => (
              <div key={p} className={"cover-thumb" + (draft.coverPattern === p ? " on" : "")}
                   onClick={() => set("coverPattern", p)}>
                <div className={"preview-cover p" + p} style={{ height: "100%" }}>
                  <CoverPattern which={p} />
                </div>
                <span className="label">{["Dotted","Linear","Concentric","Marble","Solid"][p-1]}</span>
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

function VisibilityStep({ draft, set }) {
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          Who gets to see this?
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          Pick the audience. BISO members see member-only postings instantly; public listings appear on biso.no.
        </p>
      </div>

      <div className="settings-grid">
        <div className={"toggle-card" + (draft.isMemberOnly ? " on" : "")} onClick={() => set("isMemberOnly", !draft.isMemberOnly)}>
          <div className="h"><span className="ic"><I.lock size={14}/></span> Members only</div>
          <div className="desc">Visible only to verified BI students with an active BISO membership. Best for paid or leadership roles.</div>
          <div className="check">{draft.isMemberOnly && <I.check size={11}/>}</div>
        </div>
        <div className={"toggle-card" + (!draft.isMemberOnly ? " on" : "")} onClick={() => set("isMemberOnly", false)}>
          <div className="h"><span className="ic"><I.globe size={14}/></span> Public</div>
          <div className="desc">Anyone with a BI email can apply. Recommended for volunteer roles and outreach positions.</div>
          <div className="check">{!draft.isMemberOnly && <I.check size={11}/>}</div>
        </div>

        <div className="toggle-card">
          <div className="h"><span className="ic"><I.bell size={14}/></span> Push to inboxes</div>
          <div className="desc">Send an in-app notification to <b>4,217</b> students who follow the ESN tag. Once only.</div>
          <div className="check"><I.check size={11}/></div>
        </div>
        <div className="toggle-card">
          <div className="h"><span className="ic"><I.news size={14}/></span> Friday newsletter</div>
          <div className="desc">Feature in this Friday's all-campus newsletter. Cuts off Thursday at 18:00.</div>
          <div className="check"></div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 28 }}>
        <div className="field-label"><I.events size={12}/> Schedule publication</div>
        <div className="row-2">
          <div className="toggle-card on" style={{ padding: "12px 14px" }}>
            <div className="h" style={{ fontSize: 13 }}><span className="ic" style={{ width: 22, height: 22 }}><I.arrow size={12}/></span> Publish now</div>
          </div>
          <div className="toggle-card" style={{ padding: "12px 14px" }}>
            <div className="h" style={{ fontSize: 13 }}><span className="ic" style={{ width: 22, height: 22 }}><I.clock size={12}/></span> Schedule for…</div>
          </div>
        </div>
      </div>

      <div className="ai-card" style={{ marginTop: 22 }}>
        <div className="gem" style={{ background: "linear-gradient(135deg, #2f5d3a, #4a8359)" }}><I.check size={14}/></div>
        <div className="body">
          <b>This posting meets BISO publishing standards.</b>
          <p>No restricted language detected · GDPR consent text auto-attached · Inclusive language score 9.2/10.</p>
        </div>
      </div>
    </div>
  );
}

function ComposerEditor({ draft, set, step, setStep, dirty, onPublish }) {
  const stepTitles = ["Essentials","Description","Logistics","Visibility","Review"];

  // progress
  let progress = 0.4;
  if (step === 1) progress = 0.6;
  if (step === 2) progress = 0.8;
  if (step === 3) progress = 0.95;
  if (step === 4) progress = 1;

  return (
    <div className="editor scroll">
      <StepRail step={step} setStep={setStep} dirty={dirty} />
      <div className="doc">
        <div className="doc-hd">
          <span className="kicker">{dept(draft.department).name} · {campus(draft.campus).name}</span>
          <span className="dot"></span>
          <span className="step-name">Step {step+1} of 5 · {stepTitles[step]}</span>
        </div>

        {step === 0 && <EssentialsStep draft={draft} set={set} />}
        {step === 1 && <DescriptionStep draft={draft} set={set} />}
        {step === 2 && <LogisticsStep draft={draft} set={set} />}
        {step === 3 && <VisibilityStep draft={draft} set={set} />}
        {step === 4 && <ReviewStep draft={draft} setStep={setStep} />}
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
            <I.spark2 size={13}/> Publish job
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewStep({ draft, setStep }) {
  const d = dept(draft.department), c = campus(draft.campus);
  return (
    <div>
      <div className="title-block" style={{ paddingBottom: 18 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          One last look.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 8, maxWidth: "50ch" }}>
          Click any section to jump back and edit. When you're happy, hit Publish.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "0.5px solid var(--rule)", borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,.5)" }}>
        {[
          { label: "Title (EN)", value: draft.titleEn, step: 0 },
          { label: "Title (NO)", value: draft.titleNo, step: 0 },
          { label: "Department", value: `${d.name} · ${c.name}`, step: 0 },
          { label: "Teaser", value: draft.shortEn, step: 0 },
          { label: "Description", value: `${draft.descEn.length} blocks`, step: 1 },
          { label: "Commitment", value: `${draft.commitment} · ${draft.term}`, step: 2 },
          { label: "Start / Deadline", value: `${fmtDate(draft.startDate)} → ${fmtDate(draft.deadline)}`, step: 2 },
          { label: "Contact", value: `${draft.contactName} (${draft.contactEmail})`, step: 2 },
          { label: "Audience", value: draft.isMemberOnly ? "Members only · 4,217 students" : "Public · 6,840 students", step: 3 },
        ].map((row, i) => (
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
          <p>Norwegian translation hasn't been reviewed yet — students switching to NO will see the AI version. And the start date is a public holiday (Aug 15 — Maria Himmelfartsdag).</p>
          <div className="actions">
            <button>Review NO translation</button>
            <button>Change start date</button>
            <button className="primary">Publish anyway</button>
          </div>
        </div>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = composerCSS; document.head.appendChild(s); })();
window.ComposerEditor = ComposerEditor;
