// Publish flow — celebration screen with confetti and post-publish links.

const publishCSS = `
.publish-overlay{
  position: fixed; inset: 0; z-index: 100;
  background: rgba(26, 24, 20, 0.55);
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
  display: grid; place-items: center;
  animation: fadeUp .4s ease;
}
.publish-card{
  width: min(720px, 92vw);
  background: var(--paper);
  border-radius: 22px;
  padding: 48px 56px 36px;
  position: relative;
  box-shadow: 0 40px 80px rgba(0,0,0,.4), 0 0 0 0.5px rgba(255,255,255,.1) inset;
  overflow: hidden;
}
.publish-card::before{
  content:""; position: absolute; inset: 0;
  background:
    radial-gradient(circle at 30% 0%, rgba(107,30,30,0.10), transparent 50%),
    radial-gradient(circle at 80% 100%, rgba(176,138,62,0.12), transparent 55%);
  pointer-events:none;
}
.publish-seal{
  width: 84px; height: 84px;
  border-radius: 50%;
  background: var(--ink); color: var(--paper);
  display: grid; place-items: center;
  font-family: var(--serif); font-style: italic; font-size: 36px;
  margin: 0 auto;
  position: relative;
  animation: ringIn .6s cubic-bezier(.2,.9,.3,1.3);
  box-shadow: 0 8px 24px rgba(26,24,20,.3);
}
.publish-seal::before, .publish-seal::after{
  content:""; position: absolute; inset: -8px;
  border-radius: 50%;
  border: 0.5px solid rgba(26,24,20,.18);
  pointer-events:none;
}
.publish-seal::after{inset: -16px; border-color: rgba(26,24,20,.08);}

.publish-card h1{
  text-align: center;
  font-family: var(--serif); font-weight: 400;
  font-size: 56px; line-height: 1.0; letter-spacing: -0.02em;
  margin: 24px 0 8px;
}
.publish-card h1 em{font-style: italic; color: var(--claret);}
.publish-card .lede{
  text-align: center; max-width: 38ch; margin: 0 auto;
  color: var(--ink-3); font-size: 15px; line-height: 1.5;
}

.publish-stats{
  display: grid; grid-template-columns: repeat(3, 1fr);
  margin: 28px 0 0;
  border-top: 0.5px solid var(--rule);
  border-bottom: 0.5px solid var(--rule);
}
.publish-stats > div{
  padding: 16px 0;
  text-align: center;
  border-right: 0.5px solid var(--rule);
  position: relative;
}
.publish-stats > div:last-child{border-right: 0;}
.publish-stats b{
  display: block;
  font-family: var(--serif); font-size: 32px; line-height: 1; letter-spacing: -0.015em;
}
.publish-stats span{font-size: 11.5px; color: var(--ink-3); letter-spacing: .04em; text-transform: uppercase;}

.publish-links{
  display: flex; gap: 8px; align-items: center;
  background: var(--paper-2);
  padding: 8px 8px 8px 14px;
  border-radius: 10px;
  margin: 24px 0 0;
}
.publish-links .url{
  flex: 1; font-family: var(--mono); font-size: 12.5px; color: var(--ink-2);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.publish-links .url span{color: var(--ink-4);}
.publish-links button{
  appearance: none; border: 0;
  background: white; color: var(--ink);
  padding: 7px 12px; border-radius: 7px; font-size: 12px;
  cursor: pointer;
  display: flex; align-items: center; gap: 5px;
}

.publish-actions{
  display: flex; gap: 10px; justify-content: center;
  margin-top: 24px;
  position: relative; z-index: 2;
}

.next-up{
  margin: 28px -56px -36px;
  padding: 18px 56px;
  border-top: 0.5px solid var(--rule);
  background: rgba(0,0,0,.02);
}
.next-up .hdr{
  font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-3); font-weight: 500; margin-bottom: 10px;
}
.next-up .items{display: flex; gap: 8px;}
.next-up .items > div{
  flex: 1;
  padding: 12px 14px;
  background: rgba(255,255,255,.7);
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 4px;
}
.next-up .items > div:hover{background: white;}
.next-up .items b{font-size: 13px; font-weight: 500;}
.next-up .items span{font-size: 11.5px; color: var(--ink-3);}

/* Confetti */
.confetti{
  position: absolute; inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.confetti i{
  position: absolute;
  top: 50%; left: 50%;
  width: 6px; height: 10px;
  border-radius: 1px;
  --tx: 0; --ty: 0; --tr: 0deg;
  animation: confetti 1.4s ease-out forwards;
}

/* Publish progress (in-between state) */
.publish-progress{
  position: fixed; inset: 0; z-index: 99;
  background: rgba(26, 24, 20, 0.7);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  display: grid; place-items: center;
}
.publish-progress-card{
  background: var(--paper); border-radius: 18px;
  padding: 32px 40px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  min-width: 360px;
}
.publish-progress-card .spin{
  width: 38px; height: 38px;
  border: 1.5px solid var(--rule-2);
  border-top-color: var(--ink);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin{ to{ transform: rotate(360deg);} }
.publish-progress-card .stages{
  width: 100%;
  display: flex; flex-direction: column; gap: 7px;
}
.publish-progress-card .stage{
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; color: var(--ink-3);
}
.publish-progress-card .stage.done{color: var(--leaf);}
.publish-progress-card .stage .d{
  width: 14px; height: 14px; border-radius: 50%;
  border: 0.5px solid var(--rule-2);
  display: grid; place-items: center;
}
.publish-progress-card .stage.done .d{background: var(--leaf); border-color: var(--leaf); color: white;}
.publish-progress-card .stage.active .d{border-color: var(--ink); animation: pulse 1s infinite;}
`;

function Confetti() {
  const pieces = React.useMemo(() => {
    const arr = [];
    const colors = ["#6b1e1e", "#b08a3e", "#2f5d3a", "#1a1814", "#c05a3f", "#2a4a7a"];
    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.4;
      const dist = 220 + Math.random() * 280;
      arr.push({
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 60,
        tr: (Math.random() - 0.5) * 720,
        c: colors[i % colors.length],
        d: Math.random() * 0.3,
      });
    }
    return arr;
  }, []);
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{
          "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, "--tr": `${p.tr}deg`,
          background: p.c, animationDelay: `${p.d}s`
        }} />
      ))}
    </div>
  );
}

function PublishProgress({ done }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => setPhase(3), 1700);
    const t4 = setTimeout(() => done(), 2300);
    return () => { [t1,t2,t3,t4].forEach(clearTimeout); };
  }, []);
  const stages = [
    "Validating fields",
    "Saving Norwegian translation",
    "Indexing for 4,217 subscribers",
    "Pushing to biso.no",
  ];
  return (
    <div className="publish-progress">
      <div className="publish-progress-card">
        <div className="spin"></div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.1 }}>Going live…</div>
        <div className="stages">
          {stages.map((s, i) => (
            <div key={i} className={"stage " + (i < phase ? "done" : i === phase ? "active" : "")}>
              <span className="d">{i < phase && <I.check size={9}/>}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PublishCelebration({ draft, onClose }) {
  return (
    <div className="publish-overlay">
      <div className="publish-card">
        <Confetti />
        <div className="publish-seal">B</div>
        <h1>Published, <em>quietly</em>.</h1>
        <p className="lede">
          “{draft.titleEn}” is now live at biso.no and will appear in the BISO app within 30 seconds.
        </p>

        <div className="publish-stats">
          <div><b>4,217</b><span>Notified</span></div>
          <div><b>28d</b><span>Until deadline</span></div>
          <div><b>EN + NO</b><span>Languages live</span></div>
        </div>

        <div className="publish-links">
          <span className="url"><span>https://biso.no/oslo/jobs/</span>{draft.slug}</span>
          <button><I.link size={11}/> Copy link</button>
          <button><I.eye size={11}/> Open</button>
        </div>

        <div className="publish-actions">
          <button className="btn" onClick={onClose}>Back to dashboard</button>
          <button className="btn primary"><I.plus size={13}/> Compose another</button>
        </div>

        <div className="next-up">
          <div className="hdr">Up next, if you like</div>
          <div className="items">
            <div>
              <b>Share to ESN Slack</b>
              <span>Auto-formats as a card</span>
            </div>
            <div>
              <b>Add to Friday newsletter</b>
              <span>Editor cutoff: Thu 18:00</span>
            </div>
            <div>
              <b>Notify the ESN board</b>
              <span>3 reviewers will get the link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = publishCSS; document.head.appendChild(s); })();
window.PublishCelebration = PublishCelebration;
window.PublishProgress    = PublishProgress;
