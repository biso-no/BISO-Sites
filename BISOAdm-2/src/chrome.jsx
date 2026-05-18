// Sidebar + topbar chrome.

const chromeCSS = `
.app-shell{display:grid; grid-template-columns: 232px 1fr; height:100%; background: var(--paper);}
.sidebar{
  background: linear-gradient(180deg, #f6f0e3 0%, #f1ead9 100%);
  border-right: 0.5px solid var(--rule);
  display:flex; flex-direction:column;
  padding: 14px 12px;
  position: relative;
}
.sidebar::after{content:""; position:absolute; right:-0.5px; top:0; bottom:0; width:0.5px;
  background: linear-gradient(180deg, transparent, var(--rule-2) 20%, var(--rule-2) 80%, transparent);}

.brand{
  display:flex; align-items:center; gap:10px; padding: 4px 8px 18px;
}
.brand-mark{
  width:32px; height:32px; border-radius: 8px;
  background: var(--ink); color: var(--paper);
  display:grid; place-items:center;
  font-family: var(--serif); font-style: italic; font-size: 20px;
  letter-spacing: -0.04em;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 1px 2px rgba(0,0,0,.1);
}
.brand-text{display:flex; flex-direction:column; line-height:1; min-width:0;}
.brand-text b, .brand-text span{white-space: nowrap;}
.brand-text b{font-weight:600; font-size: 13.5px; letter-spacing: -0.005em;}
.brand-text span{font-size:10.5px; color: var(--ink-3); margin-top:2px; letter-spacing: .04em; text-transform: uppercase;}

.workspace{
  display:flex; align-items:center; gap:8px;
  padding: 8px 10px; margin: 0 -2px 14px;
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  background: rgba(255,255,255,.5);
  cursor: pointer; transition: background .15s;
}
.workspace:hover{background: rgba(255,255,255,.85);}
.workspace .dot{width: 22px; height: 22px; border-radius: 6px; background: var(--claret); color: white; display:grid; place-items:center; font-size:10.5px; font-weight:600;}
.workspace .name{flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.2}
.workspace .name b{font-weight:500; font-size: 12.5px;}
.workspace .name span{font-size: 10.5px; color: var(--ink-3);}

.nav-section{font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-4); padding: 12px 10px 6px; font-weight:500;}
.nav-item{
  display:flex; align-items:center; gap:10px;
  padding: 7px 10px; border-radius: 8px;
  color: var(--ink-2);
  cursor: pointer; transition: background .12s, color .12s;
  position: relative;
  font-size: 13px;
}
.nav-item:hover{background: rgba(0,0,0,.04); color: var(--ink);}
.nav-item.active{background: var(--ink); color: var(--paper);}
.nav-item.active .badge{background: rgba(255,255,255,.15); color: var(--paper);}
.nav-item .badge{
  margin-left:auto;
  font-size: 10.5px; padding: 1px 6px; border-radius: 999px;
  background: var(--paper-3); color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.sidebar-footer{margin-top:auto; padding: 12px 6px 4px; display:flex; flex-direction:column; gap:10px}
.help-card{
  border: 0.5px solid var(--rule-2); border-radius: 10px;
  padding: 10px 12px; background: rgba(255,255,255,.55);
  display:flex; flex-direction:column; gap:4px;
}
.help-card .hd{display:flex; align-items:center; gap:6px; font-size: 11px; color: var(--ink-3); font-weight:500;}
.help-card .title{font-family: var(--serif); font-size: 17px; line-height: 1.1; color: var(--ink); padding-right: 10px;}
.help-card button{
  margin-top: 6px;
  appearance: none; border:0; background: var(--ink); color: var(--paper);
  padding: 5px 10px; border-radius: 6px; font-size: 11.5px; cursor: pointer;
  align-self: flex-start;
}
.user-pill{
  display:flex; align-items:center; gap:8px;
  padding: 6px 4px;
}
.user-pill .av{
  width:26px; height:26px; border-radius:50%;
  background: linear-gradient(135deg, var(--claret), #c05a3f);
  color:white; display:grid; place-items:center; font-size: 11px; font-weight:600;
}
.user-pill .meta{display:flex; flex-direction:column; line-height: 1.15; flex:1; min-width:0}
.user-pill .meta b{font-weight:500; font-size:12.5px}
.user-pill .meta span{font-size:10.5px; color: var(--ink-3)}

/* Main area */
.main{display:flex; flex-direction:column; min-width:0; min-height:0;}
.topbar{
  height: 52px; padding: 0 24px;
  display:flex; align-items:center; gap: 12px;
  border-bottom: 0.5px solid var(--rule);
  background: rgba(250,247,242,.85);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  position: relative; z-index: 5;
}
.crumbs{display:flex; align-items:center; gap: 8px; font-size: 13px; color: var(--ink-3);}
.crumbs .sep{color: var(--ink-4); font-size: 11px;}
.crumbs .here{color: var(--ink); font-weight: 500;}

.searchbar{
  margin-left: auto;
  display:flex; align-items:center; gap: 8px;
  width: 280px; height: 32px;
  padding: 0 10px 0 10px;
  border: 0.5px solid var(--rule-2); border-radius: 8px;
  background: rgba(255,255,255,.6);
  color: var(--ink-3);
  font-size: 12.5px;
}
.searchbar input{border:0; background:transparent; outline:0; flex:1; min-width:0;}
.kbd{
  font-family: var(--mono); font-size: 10.5px;
  padding: 1px 5px; border-radius: 4px;
  background: rgba(0,0,0,.05); color: var(--ink-3);
  border: 0.5px solid var(--rule-2);
}

.icon-btn{
  width: 32px; height: 32px;
  display:grid; place-items: center;
  border: 0.5px solid var(--rule-2); border-radius: 8px;
  background: rgba(255,255,255,.5);
  color: var(--ink-2);
  cursor: pointer; transition: background .12s, color .12s;
  position: relative;
}
.icon-btn:hover{background: rgba(255,255,255,.9); color: var(--ink);}
.icon-btn .dot{
  position: absolute; top:6px; right:6px;
  width:6px; height:6px; border-radius:50%; background: var(--claret);
}
`;

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">B</div>
      <div className="brand-text">
        <b>BISO Studio</b>
        <span>Admin · v 4.2</span>
      </div>
    </div>
  );
}

function WorkspaceSwitcher() {
  return (
    <div className="workspace">
      <div className="dot">O</div>
      <div className="name">
        <b>BI Oslo</b>
        <span>Marketing · 4 units</span>
      </div>
      <I.chev size={14} />
    </div>
  );
}

function NavItem({ icon: Ic, label, badge, active, onClick }) {
  return (
    <div className={"nav-item" + (active ? " active" : "")} onClick={onClick}>
      <Ic size={15} />
      <span>{label}</span>
      {badge != null && <span className="badge">{badge}</span>}
    </div>
  );
}

function Sidebar({ route, setRoute }) {
  return (
    <aside className="sidebar">
      <Brand />
      <WorkspaceSwitcher />
      <div className="nav-section">Publish</div>
      <NavItem icon={I.jobs}     label="Jobs"      badge={3} active={route.startsWith("jobs")} onClick={() => setRoute("jobs")} />
      <NavItem icon={I.events}   label="Events"    badge={12} />
      <NavItem icon={I.news}     label="News" />
      <NavItem icon={I.benefits} label="Benefits"  badge={5} />
      <NavItem icon={I.shop}     label="Webshop" />
      <NavItem icon={I.pages}    label="Pages" />
      <div className="nav-section">Operate</div>
      <NavItem icon={I.people}   label="Applicants" badge={47} />
      <NavItem icon={I.building} label="Departments" />
      <NavItem icon={I.doc}      label="Documents" />

      <div className="sidebar-footer">
        <div className="help-card">
          <div className="hd"><I.sparkle size={12} /> First time?</div>
          <div className="title">Hit ⌘K and start typing a job title.</div>
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
}

function Topbar({ crumbs, right }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">›</span>}
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="searchbar">
        <I.search size={13} />
        <input placeholder="Search jobs, applicants, events…" />
        <span className="kbd">⌘K</span>
      </div>
      <button className="icon-btn"><I.bell size={15} /><span className="dot"></span></button>
      {right}
    </div>
  );
}

// inject chrome css once
(function(){
  const s = document.createElement("style"); s.textContent = chromeCSS; document.head.appendChild(s);
})();

window.Sidebar = Sidebar;
window.Topbar  = Topbar;
