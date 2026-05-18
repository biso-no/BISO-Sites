// Root app — state, routing, tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#6b1e1e",
  "showAI": true,
  "phoneFloat": true,
  "density": "regular",
  "previewLocale": "en"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("jobs"); // "jobs" | "compose"
  const [step, setStep]   = React.useState(0);
  const [draft, setDraft] = React.useState(DRAFT_DEFAULT);
  const [dirty, setDirty] = React.useState(false);
  const [previewLocale, setPreviewLocale] = React.useState("en");
  const [viewport, setViewport] = React.useState("phone");
  const [flash, setFlash] = React.useState(false);
  const [publishStage, setPublishStage] = React.useState(null); // null | "progress" | "done"

  // Apply accent tweak via CSS var
  React.useEffect(() => {
    document.documentElement.style.setProperty("--claret", t.accent || "#6b1e1e");
  }, [t.accent]);

  const set = (key, val) => {
    setDraft(d => ({ ...d, [key]: val }));
    setDirty(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 240);
  };

  const goCompose = () => { setRoute("compose"); setStep(0); };
  const goDash = () => { setRoute("jobs"); };

  const onPublish = () => {
    setPublishStage("progress");
  };

  const crumbs = route === "jobs"
    ? ["BISO Studio", "BI Oslo", "Jobs"]
    : ["BISO Studio", "BI Oslo", "Jobs", draft.titleEn || "Untitled"];

  return (
    <div className="app-shell">
      <Sidebar route={route} setRoute={setRoute} />
      <div className="main">
        <Topbar crumbs={crumbs} right={
          route === "compose" ? (
            <button className="icon-btn" onClick={goDash} title="Back to dashboard">
              <I.back size={15} />
            </button>
          ) : null
        } />

        {route === "jobs" && (
          <Dashboard onCompose={goCompose} onOpenJob={goCompose} />
        )}

        {route === "compose" && (
          <div className="composer-shell">
            <ComposerEditor
              draft={draft}
              set={set}
              step={step}
              setStep={setStep}
              dirty={dirty}
              onPublish={onPublish}
            />
            <PreviewPane
              draft={draft}
              locale={previewLocale}
              setLocale={setPreviewLocale}
              viewport={viewport}
              setViewport={setViewport}
              flash={flash}
            />
          </div>
        )}
      </div>

      {publishStage === "progress" && (
        <PublishProgress done={() => setPublishStage("done")} />
      )}
      {publishStage === "done" && (
        <PublishCelebration draft={draft} onClose={() => { setPublishStage(null); setRoute("jobs"); setDirty(false); }} />
      )}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
          options={["#6b1e1e", "#2a4a7a", "#2f5d3a", "#b08a3e", "#29261b"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Composer" />
        <TweakToggle label="AI assist cards" value={t.showAI}
          onChange={(v) => { setTweak("showAI", v); document.documentElement.style.setProperty("--ai-card-display", v ? "flex" : "none"); }} />
        <TweakToggle label="Floating phone" value={t.phoneFloat}
          onChange={(v) => { setTweak("phoneFloat", v); document.documentElement.style.setProperty("--phone-anim", v ? "drift 8s ease-in-out infinite" : "none"); }} />
        <TweakRadio label="Density" value={t.density}
          options={["compact","regular","comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Demo controls" />
        <TweakButton label="Jump to composer" onClick={goCompose} />
        <TweakButton label="Jump to publish screen"
          onClick={() => { setRoute("compose"); setStep(4); setPublishStage("done"); }} />
        <TweakButton label="Reset to dashboard"
          onClick={() => { setRoute("jobs"); setStep(0); setPublishStage(null); setDirty(false); setDraft(DRAFT_DEFAULT); }} />
      </TweaksPanel>
    </div>
  );
}

// Honor AI card + phone float toggles via CSS vars (set up initial values too)
(function(){
  const s = document.createElement("style");
  s.textContent = `
    .ai-card{ display: var(--ai-card-display, flex); }
    .phone{ animation: var(--phone-anim, drift 8s ease-in-out infinite); }
  `;
  document.head.appendChild(s);
})();

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
