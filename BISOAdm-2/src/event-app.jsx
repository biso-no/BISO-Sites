// Event app — state, routing, tweaks. Mirrors src/app.jsx for jobs.

const EV_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#6b1e1e",
  "showAI": true,
  "phoneFloat": true,
  "density": "regular",
  "previewLocale": "en"
}/*EDITMODE-END*/;

function EventApp() {
  const [t, setTweak] = useTweaks(EV_TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("events"); // "events" | "compose"
  const [step, setStep]   = React.useState(0);
  const [draft, setDraft] = React.useState(EVENT_DRAFT_DEFAULT);
  const [dirty, setDirty] = React.useState(false);
  const [previewLocale, setPreviewLocale] = React.useState("en");
  const [viewport, setViewport] = React.useState("phone");
  const [flash, setFlash] = React.useState(false);
  const [publishStage, setPublishStage] = React.useState(null); // null | "progress" | "done"

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
  const goDash = () => { setRoute("events"); };

  const onPublish = () => setPublishStage("progress");

  const crumbs = route === "events"
    ? ["BISO Studio", "BI Oslo", "Events"]
    : ["BISO Studio", "BI Oslo", "Events", draft.titleEn || "Untitled"];

  return (
    <div className="app-shell">
      <Sidebar route={route} setRoute={setRoute} />
      <div className="main">
        <Topbar crumbs={crumbs} right={
          route === "compose" ? (
            <button className="icon-btn" onClick={goDash} title="Back to events">
              <I.back size={15} />
            </button>
          ) : null
        } />

        {route === "events" && (
          <EventsDashboard onCompose={goCompose} onOpenEvent={goCompose} />
        )}

        {route === "compose" && (
          <div className="composer-shell">
            <EventComposerEditor
              draft={draft} set={set}
              step={step} setStep={setStep}
              dirty={dirty} onPublish={onPublish}
            />
            <EventPreviewPane
              draft={draft}
              locale={previewLocale} setLocale={setPreviewLocale}
              viewport={viewport} setViewport={setViewport}
              flash={flash}
            />
          </div>
        )}
      </div>

      {publishStage === "progress" && (
        <EventPublishProgress done={() => setPublishStage("done")} />
      )}
      {publishStage === "done" && (
        <EventPublishCelebration draft={draft} onClose={() => { setPublishStage(null); setRoute("events"); setDirty(false); }} />
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
          onClick={() => { setRoute("events"); setStep(0); setPublishStage(null); setDirty(false); setDraft(EVENT_DRAFT_DEFAULT); }} />
      </TweaksPanel>
    </div>
  );
}

// Honor toggles via CSS vars
(function(){
  const s = document.createElement("style");
  s.textContent = `
    .ai-card{ display: var(--ai-card-display, flex); }
    .phone{ animation: var(--phone-anim, drift 8s ease-in-out infinite); }
  `;
  document.head.appendChild(s);
})();

// Chrome's Sidebar highlights "events" when route is anything starting with "events".
// We patch that quickly by overriding the sidebar nav highlight via CSS — actually the
// shared Sidebar component looks at route.startsWith("jobs") for "Jobs". Since this app
// is the *Events* admin, we want "Events" highlighted instead. We'll do that by passing
// a custom route prefix into a small wrapper.
const OriginalSidebar = window.Sidebar;
window.Sidebar = function EventSidebar({ route, setRoute }) {
  // Re-render the same chrome but with Events as the active item.
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">B</div>
        <div className="brand-text">
          <b>BISO Studio</b>
          <span>Admin · v 4.2</span>
        </div>
      </div>
      <div className="workspace">
        <div className="dot">O</div>
        <div className="name">
          <b>BI Oslo</b>
          <span>Marketing · 4 units</span>
        </div>
        <I.chev size={14} />
      </div>
      <div className="nav-section">Publish</div>
      <div className="nav-item"><I.jobs size={15}/><span>Jobs</span><span className="badge">3</span></div>
      <div className="nav-item active" onClick={() => setRoute("events")}>
        <I.events size={15}/><span>Events</span><span className="badge">7</span>
      </div>
      <div className="nav-item"><I.news size={15}/><span>News</span></div>
      <div className="nav-item"><I.benefits size={15}/><span>Benefits</span><span className="badge">5</span></div>
      <div className="nav-item"><I.shop size={15}/><span>Webshop</span></div>
      <div className="nav-item"><I.pages size={15}/><span>Pages</span></div>
      <div className="nav-section">Operate</div>
      <div className="nav-item"><I.people size={15}/><span>Applicants</span><span className="badge">47</span></div>
      <div className="nav-item"><I.building size={15}/><span>Departments</span></div>
      <div className="nav-item"><I.doc size={15}/><span>Documents</span></div>

      <div className="sidebar-footer">
        <div className="help-card">
          <div className="hd"><I.sparkle size={12} /> First time?</div>
          <div className="title">Hit ⌘K and start typing an event name.</div>
          <button>Open guide</button>
        </div>
        <div className="user-pill">
          <div className="av">KB</div>
          <div className="meta">
            <b>Kari Berg</b>
            <span>ESN Vice President</span>
          </div>
          <I.chev size={14} />
        </div>
      </div>
    </aside>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<EventApp />);
