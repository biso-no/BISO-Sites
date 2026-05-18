// Webshop composer — 5-step editor.
// Step rail / doc layout / AI cards / action bar are visually identical to
// the jobs and events composers. The novel pieces here are the variant
// builder (Step 3) and the multi-photo gallery (Step 4).

const shopComposerCSS = `
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
  display:flex; align-items: center; gap: 6px; background: transparent;
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

/* Category / department pills */
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

/* Description blocks */
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

.add-block-row{display: flex; align-items: center; gap: 8px; margin: 14px 0 0; padding: 6px 0; opacity: 0.7; transition: opacity .15s;}
.add-block-row:hover{opacity: 1;}
.add-block-row::before, .add-block-row::after{content:""; flex: 1; height: 0.5px; background: var(--rule);}
.add-block-row .actions{display: flex; gap: 4px;}
.add-block-row button{appearance: none; border: 0.5px solid var(--rule-2); background: rgba(255,255,255,.6); height: 26px; padding: 0 10px; border-radius: 999px; font-size: 11.5px; cursor: pointer; color: var(--ink-3); display: flex; align-items: center; gap: 5px;}
.add-block-row button:hover{color: var(--ink); background: white;}

/* AI cards */
.ai-card{
  position: relative;
  margin: 4px 0 14px;
  padding: 12px 14px;
  border: 0.5px dashed rgba(176,138,62,.6);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(176,138,62,0.05), rgba(176,138,62,0.02));
  display: flex; gap: 12px; align-items: flex-start;
}
.ai-card .gem{width: 28px; height: 28px; border-radius: 8px;
  display:grid; place-items:center;
  background: linear-gradient(135deg, #b08a3e, #d4ad5b);
  color: white; flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(176,138,62,.3);}
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

/* Toggle cards */
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
.toggle-card .h .ic{width: 28px; height: 28px; border-radius: 8px; background: var(--paper-2); display: grid; place-items: center; color: var(--ink-2);}
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

/* ============================================================
   Variant builder — the headline new component
   ============================================================ */
.variant-board{
  border: 0.5px solid var(--rule-2); border-radius: 14px;
  background: rgba(255,255,255,.55);
  overflow: hidden;
}
.variant-board .board-hd{
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border-bottom: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.5);
}
.variant-board .board-hd .summary{font-size: 12.5px; color: var(--ink-3);}
.variant-board .board-hd .summary b{color: var(--ink); font-weight: 500;}
.variant-board .board-hd .spacer{flex: 1;}
.variant-board .board-hd .template{
  display:flex; align-items:center; gap: 6px;
  font-size: 11.5px; color: var(--ink-3); cursor: pointer;
  padding: 5px 10px; border-radius: 7px;
  border: 0.5px solid var(--rule-2); background: rgba(255,255,255,.7);
}
.variant-board .board-hd .template:hover{background: white;}

.variant-row{
  display:grid;
  grid-template-columns: 24px 1.4fr 0.8fr 0.8fr 0.7fr 0.95fr 24px;
  align-items: center; gap: 10px;
  padding: 10px 18px;
  border-top: 0.5px solid var(--rule-2);
  font-size: 13px;
  transition: background .12s;
}
.variant-row:hover{background: rgba(255,255,255,.7);}
.variant-row.head{
  padding-top: 8px; padding-bottom: 8px;
  font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--ink-4); background: rgba(0,0,0,.012);
  border-top: 0;
}
.variant-row .handle{
  display: grid; place-items: center;
  color: var(--ink-4); cursor: grab;
  width: 24px; height: 24px;
}
.variant-row .name-in, .variant-row .price-in, .variant-row .sku-in{
  appearance: none; border: 0.5px solid transparent;
  background: transparent; outline: 0;
  padding: 6px 8px; border-radius: 6px;
  font-size: 13px; color: var(--ink);
  width: 100%;
  transition: background .12s, border-color .12s;
}
.variant-row .name-in:hover, .variant-row .price-in:hover, .variant-row .sku-in:hover{background: rgba(0,0,0,.025);}
.variant-row .name-in:focus, .variant-row .price-in:focus, .variant-row .sku-in:focus{
  background: white; border-color: var(--rule-2);
}
.variant-row .price-in, .variant-row .sku-in{font-family: var(--mono); font-feature-settings: "tnum" 1;}
.variant-row .stock-stepper{display:flex; align-items: stretch; gap: 0;
  border: 0.5px solid var(--rule-2); border-radius: 6px;
  background: rgba(255,255,255,.55); overflow: hidden; width: fit-content;}
.variant-row .stock-stepper input{appearance: none; -moz-appearance: textfield;
  border: 0; outline: 0; background: transparent;
  width: 50px; text-align: center;
  font-family: var(--mono); font-size: 13px; color: var(--ink);}
.variant-row .stock-stepper input::-webkit-outer-spin-button,
.variant-row .stock-stepper input::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }
.variant-row .stock-stepper button{
  appearance: none; border: 0; background: transparent;
  width: 22px; cursor: pointer; color: var(--ink-3);
  font-size: 14px; line-height: 1;
}
.variant-row .stock-stepper button:hover{background: rgba(0,0,0,.04); color: var(--ink);}
.variant-row .stock-stepper button:first-child{border-right: 0.5px solid var(--rule-2);}
.variant-row .stock-stepper button:last-child{border-left: 0.5px solid var(--rule-2);}
.variant-row .stock-warn{
  display:flex; align-items:center; gap: 4px;
  font-size: 10.5px; color: var(--claret);
  margin-left: 4px;
}
.variant-row .del{
  appearance: none; border: 0; background: transparent;
  color: var(--ink-4); cursor: pointer;
  width: 24px; height: 24px; border-radius: 5px;
  display: grid; place-items: center;
}
.variant-row .del:hover{color: var(--claret); background: rgba(107,30,30,.06);}

.variant-add-row{
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-top: 0.5px solid var(--rule-2);
  background: rgba(0,0,0,.012);
}
.variant-add-row button.add{
  appearance: none; border: 0.5px dashed var(--rule-2);
  background: transparent;
  padding: 6px 12px; border-radius: 7px;
  font-size: 12px; color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; gap: 6px;
}
.variant-add-row button.add:hover{border-color: var(--ink); color: var(--ink); background: rgba(255,255,255,.5);}

.no-variants{
  padding: 32px 18px;
  text-align: center;
  font-size: 13px; color: var(--ink-3);
}
.no-variants .ill{
  font-family: var(--serif); font-size: 28px; color: var(--ink); margin-bottom: 4px;
  font-style: italic;
}
.no-variants .templates{
  display: flex; gap: 8px; justify-content: center; margin-top: 14px; flex-wrap: wrap;
}
.no-variants .templates button{
  appearance: none; border: 0.5px solid var(--rule-2);
  background: rgba(255,255,255,.7); color: var(--ink);
  padding: 8px 14px; border-radius: 8px;
  font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; gap: 6px;
}
.no-variants .templates button:hover{background: white;}

/* Member-discount card */
.discount-card{
  border: 0.5px solid var(--rule-2); border-radius: 12px;
  background: linear-gradient(180deg, rgba(47,93,58,.04), rgba(47,93,58,0.01));
  padding: 16px 18px;
  display: flex; align-items: center; gap: 16px;
}
.discount-card .icon{
  width: 38px; height: 38px; border-radius: 10px;
  background: var(--leaf); color: white;
  display: grid; place-items: center;
  flex-shrink: 0;
}
.discount-card .body{flex: 1;}
.discount-card .body b{font-weight: 500; font-size: 13.5px;}
.discount-card .body p{margin: 2px 0 0; font-size: 12px; color: var(--ink-3); line-height: 1.4;}
.discount-card .pct{
  display: flex; align-items: baseline; gap: 2px;
  font-family: var(--serif); font-size: 32px; line-height: 1;
  color: var(--leaf); letter-spacing: -0.01em;
}
.discount-card .pct span{font-size: 18px; font-style: italic;}

/* ============================================================
   Photo gallery upload
   ============================================================ */
.gallery-grid{
  display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 10px;
}
.gallery-tile{
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 10px; overflow: hidden;
  border: 0.5px solid var(--rule-2);
  cursor: pointer;
}
.gallery-tile.hero{
  aspect-ratio: auto;
  min-height: 220px;
  grid-row: span 2;
}
.gallery-tile .label{
  position: absolute; left: 8px; bottom: 8px;
  padding: 2px 8px; border-radius: 999px;
  font-size: 10px; color: white;
  background: rgba(0,0,0,.4);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
.gallery-tile .hero-pin{
  position: absolute; left: 8px; top: 8px;
  padding: 3px 8px; border-radius: 999px;
  font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase;
  color: white; background: rgba(107,30,30,.85);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  display:flex; align-items:center; gap: 4px;
}
.gallery-tile .actions{
  position: absolute; top: 8px; right: 8px;
  display: flex; gap: 4px; opacity: 0;
  transition: opacity .15s;
}
.gallery-tile:hover .actions{opacity: 1;}
.gallery-tile .actions button{
  appearance: none; border: 0;
  width: 24px; height: 24px;
  background: rgba(0,0,0,.45); color: white;
  border-radius: 6px;
  display: grid; place-items: center;
  cursor: pointer;
}
.gallery-tile .actions button:hover{background: rgba(0,0,0,.7);}

.gallery-tile.add{
  border: 1px dashed var(--rule-2);
  background: var(--paper-2);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: var(--ink-3); font-size: 12px;
  gap: 6px;
  cursor: pointer;
}
.gallery-tile.add:hover{background: white; color: var(--ink); border-color: var(--ink-2);}

/* Reuses .preview-cover style classes via the pattern component */
.thumb-bg{position: absolute; inset: 0;}
.thumb-bg.p1{background: linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%);}
.thumb-bg.p2{background: linear-gradient(135deg, #2a4a7a 0%, #15263c 100%);}
.thumb-bg.p3{background: linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%);}
.thumb-bg.p4{background: linear-gradient(135deg, #b08a3e 0%, #6a5118 100%);}
.thumb-bg.p5{background: linear-gradient(180deg, #29261b 0%, #100e09 100%);}
.thumb-bg svg{position: absolute; inset: 0; width: 100%; height: 100%; opacity: .35;}

/* Linked event row */
.linked-event{
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  background: rgba(42,74,122,.04);
}
.linked-event .ic{
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--sky); color: white;
  display: grid; place-items: center;
}
.linked-event .meta{flex: 1; display: flex; flex-direction: column; gap: 2px;}
.linked-event .meta b{font-size: 13.5px; font-weight: 500;}
.linked-event .meta span{font-size: 11.5px; color: var(--ink-3); font-family: var(--mono);}
.linked-event button{
  appearance: none; border: 0.5px solid var(--rule-2);
  background: white; color: var(--ink);
  padding: 6px 12px; border-radius: 7px;
  font-size: 11.5px; cursor: pointer;
}
`;

function StepRailShop({ step, setStep, dirty }) {
  const steps = [
    { id: 0, name: "Essentials" },
    { id: 1, name: "Description" },
    { id: 2, name: "Variants & price" },
    { id: 3, name: "Photos & visibility" },
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

function ShopLangTabs({ locale, setLocale, syncedNo }) {
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

// ============================================================================
// Step 1 — Essentials
// ============================================================================
function ShopEssentialsStep({ draft, set }) {
  const [localeTab, setLocaleTab] = React.useState("en");
  return (
    <div>
      <div className="title-block">
        <ShopLangTabs locale={localeTab} setLocale={setLocaleTab} syncedNo={true} />
        <input
          className="title-input"
          autoFocus
          placeholder="A product worth carrying out the door…"
          value={localeTab === "en" ? draft.titleEn : draft.titleNo}
          onChange={(e) => set(localeTab === "en" ? "titleEn" : "titleNo", e.target.value)}
        />
        <div className="slug-line">
          <span>biso.no/oslo/shop/</span>
          <b>{draft.slug || "untitled-product"}</b>
          <span className="edit"><I.edit size={11}/></span>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="field-label"><I.tag size={12}/> Category <span className="req">required</span><span className="help">How students filter the shop</span></div>
          <div className="dept-picker">
            {PRODUCT_CATEGORIES.map(c => (
              <div key={c.id} className={"dept-pill" + (draft.category === c.id ? " on" : "")} onClick={() => set("category", c.id)}>
                <span className="crest">{c.crest}</span>
                {c.name}
              </div>
            ))}
            <div className="dept-pill" style={{ color: "var(--ink-3)" }}>
              <span className="crest" style={{ background: "transparent", border: "0.5px dashed var(--rule-2)" }}><I.plus size={11}/></span>
              New category
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-label"><I.building size={12}/> Hosted by <span className="help">Department selling this</span></div>
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
            <span className="help">Shown in shop tiles. {140 - (draft.shortEn?.length || 0)} characters left.</span>
          </div>
          <textarea
            className="field-input large"
            placeholder="What makes this worth queueing at the kiosk for?"
            value={draft.shortEn || ""}
            onChange={(e) => set("shortEn", e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label"><I.spark2 size={12}/> Tags <span className="help">Up to 5 — helps recommendations</span></div>
          <div className="dept-picker">
            {["Welcome week","Bundle","Best value","Limited edition","Sustainable","International","Members only","New","Restocked","Pre-order","Pickup only"].map(t => (
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
            <b>This looks like a Fadderuke ticket bundle.</b>
            <p>I can draft a description from three bullets, suggest member pricing at 33% off, and link it to the Fadderuke '26 event in your calendar. Two minutes, tops.</p>
            <div className="actions">
              <button className="primary"><I.spark2 size={11}/> Pre-fill from past bundles</button>
              <button>Start blank</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2 — Description (re-uses the same blocks pattern)
// ============================================================================
function ShopBlock({ block, idx, onChange }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text && !ref.current.matches(":focus")) {
      ref.current.innerText = block.text || "";
    }
  }, [block.text]);
  const placeholders = {
    h: "Section heading…",
    p: "Tell the story. Who is this for? Why does it exist?",
    l: "A feature, a perk, a fine-print…",
  };
  return (
    <div className={"block " + block.type}>
      <div className="gutter"><button><I.drag size={12}/></button></div>
      <div className="content">
        <div ref={ref} contentEditable suppressContentEditableWarning
          data-ph={placeholders[block.type]}
          onInput={(e) => onChange(idx, e.currentTarget.innerText)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) e.preventDefault(); }}
        >{block.text}</div>
      </div>
    </div>
  );
}

function ShopDescriptionStep({ draft, set }) {
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
        <ShopLangTabs locale="en" setLocale={() => {}} />
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.1, marginTop: 6, color: "var(--ink-2)" }}>
          The whole story.
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 6, maxWidth: "50ch" }}>
          Don't just list features — say why this exists. Hit <span className="kbd">/</span> for a heading or a bullet list.
        </p>
      </div>

      <div className="blocks">
        {blocks.map((b, i) => <ShopBlock key={i} block={b} idx={i} onChange={setBlock} />)}
      </div>

      <div className="add-block-row">
        <div className="actions">
          <button onClick={() => addBlock("h")}><I.h1 size={11}/> Heading</button>
          <button onClick={() => addBlock("p")}><I.bold size={11}/> Paragraph</button>
          <button onClick={() => addBlock("l")}><I.list size={11}/> Bullet</button>
          <button><I.sparkle size={11}/> Suggest section</button>
        </div>
      </div>

      <div className="ai-card" style={{ marginTop: 28 }}>
        <div className="gem"><I.spark2 size={14}/></div>
        <div className="body">
          <b>Draft a description from three bullets?</b>
          <p>Tell me who it's for, what's in the box, and the one thing that makes it special. I'll write the whole story in your house voice — you can edit before publish.</p>
          <div className="actions">
            <button className="primary"><I.spark2 size={11}/> Open bullet brief</button>
            <button>Keep as is</button>
          </div>
        </div>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = shopComposerCSS; document.head.appendChild(s); })();
window.StepRailShop = StepRailShop;
window.ShopLangTabs = ShopLangTabs;
window.ShopEssentialsStep = ShopEssentialsStep;
window.ShopDescriptionStep = ShopDescriptionStep;
