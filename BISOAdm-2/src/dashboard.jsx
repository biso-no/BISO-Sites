// Jobs dashboard — list of all jobs with filters and the "compose" entry point.

const dashCSS = `
.dash{padding: 28px 36px 56px; overflow: auto; flex: 1; min-height: 0;}

.dash-head{
  display:flex; align-items:flex-end; justify-content:space-between; gap: 24px;
  padding-bottom: 22px; border-bottom: 0.5px solid var(--rule);
}
.dash-head h1{
  font-family: var(--serif); font-size: 56px; line-height: 0.95;
  margin: 0; letter-spacing: -0.015em; font-weight: 400;
}
.dash-head h1 em{font-style: italic; color: var(--claret);}
.dash-head p{margin: 8px 0 0; color: var(--ink-3); font-size: 14.5px; max-width: 46ch;}

.compose-btn{
  display:flex; align-items:center; gap: 10px;
  appearance: none; border: 0;
  padding: 12px 18px;
  background: var(--ink); color: var(--paper);
  border-radius: 999px;
  font-size: 14px; font-weight: 500; letter-spacing: -0.005em;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(26,24,20,.25), 0 1px 0 rgba(255,255,255,.1) inset;
  transition: transform .12s, box-shadow .12s;
}
.compose-btn:hover{transform: translateY(-1px); box-shadow: 0 8px 26px rgba(26,24,20,.32), 0 1px 0 rgba(255,255,255,.12) inset;}
.compose-btn .plus{
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--paper); color: var(--ink);
  display:grid; place-items: center;
}

/* KPI strip */
.kpi-strip{
  display:grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  margin: 24px 0 28px;
  border: 0.5px solid var(--rule); border-radius: 14px;
  background: rgba(255,255,255,.45);
  overflow: hidden;
}
.kpi{
  padding: 18px 22px;
  border-right: 0.5px solid var(--rule);
  display:flex; flex-direction:column; gap: 4px;
  position: relative;
}
.kpi:last-child{border-right: 0;}
.kpi .lbl{font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-3);}
.kpi .val{font-family: var(--serif); font-size: 42px; line-height: 1; letter-spacing: -0.02em;}
.kpi .delta{font-size: 11.5px; color: var(--leaf); font-family: var(--mono);}
.kpi.alert .val{color: var(--claret);}
.kpi .spark{
  position: absolute; right: 18px; bottom: 18px; width: 64px; height: 22px; opacity: .55;
}

/* Filter row */
.filter-row{
  display:flex; align-items:center; gap: 8px;
  margin: 0 0 16px;
}
.seg{
  display:flex; align-items: center; padding: 3px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2); border-radius: 10px;
}
.seg button{
  appearance: none; border: 0; background: transparent;
  padding: 6px 14px; border-radius: 7px;
  font-size: 12.5px; color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: background .12s, color .12s;
}
.seg button:hover{color: var(--ink);}
.seg button.on{background: white; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.06);}
.seg button .c{
  font-family: var(--mono); font-size: 10.5px;
  color: var(--ink-4);
}
.seg button.on .c{color: var(--ink-3);}

.filter-row .spacer{flex:1;}

.chip{
  display:flex; align-items:center; gap: 6px;
  height: 30px; padding: 0 10px;
  border: 0.5px solid var(--rule-2); border-radius: 8px;
  background: rgba(255,255,255,.5); color: var(--ink-2);
  font-size: 12.5px; cursor: pointer;
}
.chip:hover{background: rgba(255,255,255,.85);}

/* Jobs list */
.jobs-list{
  display:flex; flex-direction:column; gap: 0;
}
.jobs-list-head{
  display:grid; grid-template-columns: 1.5fr 0.9fr 0.6fr 0.7fr 0.7fr 0.4fr;
  padding: 0 16px 8px;
  font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4);
}
.job-row{
  display:grid; grid-template-columns: 1.5fr 0.9fr 0.6fr 0.7fr 0.7fr 0.4fr;
  align-items:center; gap: 12px;
  padding: 14px 16px;
  border-top: 0.5px solid var(--rule);
  transition: background .12s;
  cursor: pointer;
  position: relative;
}
.job-row:last-child{border-bottom: 0.5px solid var(--rule);}
.job-row:hover{background: rgba(255,255,255,.55);}
.job-row .title-cell{display:flex; align-items:center; gap: 12px; min-width:0;}
.job-row .crest{
  flex-shrink:0;
  width: 36px; height: 44px;
  display:grid; place-items:center;
  font-family: var(--serif); font-size: 22px; line-height:1;
  background: var(--paper-2); border: 0.5px solid var(--rule-2);
  border-radius: 4px;
  position: relative;
}
.job-row .crest::after{
  content:""; position:absolute; inset: 3px; border: 0.5px solid var(--rule-2); border-radius: 2px;
  pointer-events:none;
}
.job-row .title-cell .t{display:flex; flex-direction:column; min-width:0; gap: 2px;}
.job-row .title-cell .t b{font-weight: 500; font-size: 14.5px; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.job-row .title-cell .t span{font-size: 12px; color: var(--ink-3); display:flex; align-items:center; gap: 6px;}
.job-row .title-cell .t .lang{font-family: var(--mono); font-size: 9.5px; color: var(--ink-4); padding: 1px 4px; border: 0.5px solid var(--rule-2); border-radius: 3px;}
.dept-cell{display:flex; align-items: center; gap: 8px; font-size: 13px;}
.dept-cell .pin{width: 8px; height: 8px; border-radius: 50%; background: var(--claret);}

.status{
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; padding: 3px 9px; border-radius: 999px;
  background: var(--paper-2); color: var(--ink-2);
  border: 0.5px solid var(--rule-2);
  text-transform: capitalize;
}
.status .pulse{width:6px; height:6px; border-radius:50%; background: var(--ink-4);}
.status.published .pulse{background: var(--leaf); animation: pulse 2s infinite;}
.status.published{color: var(--leaf); background: rgba(47,93,58,.06); border-color: rgba(47,93,58,.18);}
.status.draft .pulse{background: var(--gold);}
.status.draft{color: #6a5118; background: rgba(176,138,62,.08); border-color: rgba(176,138,62,.22);}
.status.closed .pulse{background: var(--ink-4);}
.status.closed{color: var(--ink-3);}

.row-mini{font-size: 12.5px; color: var(--ink-2); display: flex; align-items: center; gap: 4px;}
.row-mini.sub{color: var(--ink-3);}
.row-mini .num{font-family: var(--mono); font-feature-settings: "tnum" 1; font-weight: 500;}
.row-mini .bar{flex: 1; height: 3px; background: var(--paper-3); border-radius: 999px; overflow: hidden;}
.row-mini .bar i{display:block; height: 100%; background: var(--ink);}

.row-actions{display:flex; align-items: center; gap: 4px; justify-content: flex-end; opacity: 0; transition: opacity .15s;}
.job-row:hover .row-actions{opacity: 1;}
.row-actions button{
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border: 0.5px solid var(--rule-2); border-radius: 7px;
  background: rgba(255,255,255,.7); color: var(--ink-2);
  cursor: pointer;
}
.row-actions button:hover{color: var(--ink); background: white;}

/* Featured / first row treatment */
.featured-card{
  margin: 0 0 18px;
  display: grid; grid-template-columns: 1.1fr 1fr;
  border: 0.5px solid var(--rule);
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #f8f3e8, #f0e8d4);
  position: relative;
}
.featured-card .left{padding: 26px 28px; display:flex; flex-direction:column; gap: 8px;}
.featured-card .eyebrow{display:flex; align-items:center; gap: 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--claret); font-weight: 500;}
.featured-card .eyebrow .star{display:grid; place-items:center; width: 16px; height: 16px; color: var(--claret);}
.featured-card h2{font-family: var(--serif); font-size: 38px; line-height: 1.0; letter-spacing: -0.015em; margin: 4px 0 6px; font-weight: 400;}
.featured-card .desc{font-size: 13.5px; color: var(--ink-2); max-width: 38ch;}
.featured-card .meta{display: flex; gap: 22px; margin-top: 18px;}
.featured-card .meta div{display:flex; flex-direction:column; gap:1px;}
.featured-card .meta b{font-family: var(--serif); font-size: 26px; line-height: 1; letter-spacing: -0.01em;}
.featured-card .meta span{font-size: 11px; color: var(--ink-3); letter-spacing: .03em; text-transform: uppercase;}
.featured-card .right{
  position: relative;
  background: var(--ink);
  color: var(--paper);
  padding: 26px 28px;
  display:flex; flex-direction:column; justify-content: space-between;
}
.featured-card .right h3{font-family: var(--serif); font-size: 24px; line-height: 1.1; font-weight: 400; margin: 0; max-width: 22ch;}
.featured-card .right .small{font-size: 12px; color: rgba(250,247,242,.6); margin-top: 8px;}
.featured-card .right .timeline{
  display:flex; flex-direction:column; gap: 6px; margin: 22px 0;
}
.featured-card .right .tl{display:flex; align-items:center; gap: 10px; font-size: 12.5px;}
.featured-card .right .tl .d{width:14px; height:14px; border-radius:50%; border: 1px solid rgba(250,247,242,.4);}
.featured-card .right .tl.done .d{background: var(--paper); border-color: var(--paper);}
.featured-card .right .tl.now .d{border-color: var(--paper); box-shadow: 0 0 0 4px rgba(250,247,242,.12);}
.featured-card .right .tl .when{margin-left:auto; font-family: var(--mono); font-size: 11px; color: rgba(250,247,242,.55);}
.featured-card .right button{
  appearance:none; border: 0.5px solid rgba(250,247,242,.25);
  background: rgba(250,247,242,.08);
  color: var(--paper); padding: 10px 16px; border-radius: 8px;
  font-size: 13px; cursor: pointer;
  display:flex; align-items:center; gap: 10px;
  align-self: flex-start;
}
.featured-card .right button:hover{background: rgba(250,247,242,.16);}
`;

function Spark({ data, color = "currentColor" }) {
  const max = Math.max(...data);
  const w = 64, h = 22;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function FeaturedDraftCard({ onResume }) {
  return (
    <div className="featured-card">
      <div className="left">
        <div className="eyebrow"><span className="star"><I.spark2 size={12} /></span> Pick up where you left off</div>
        <h2>Buddy Coordinator — <em className="serif" style={{ fontStyle: "italic", color: "var(--claret)" }}>almost ready</em></h2>
        <div className="desc">You've drafted four sections. Two fields remain before this can go live to 4,200 ESN-tagged students.</div>
        <div className="meta">
          <div><b>72%</b><span>Complete</span></div>
          <div><b>2</b><span>Required fields</span></div>
          <div><b>4d</b><span>Until deadline</span></div>
        </div>
      </div>
      <div className="right">
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(250,247,242,.55)", marginBottom: 8 }}>Publishing checklist</div>
          <h3>From draft to inbox in about four minutes.</h3>
        </div>
        <div className="timeline">
          <div className="tl done"><span className="d"></span> Title & department <span className="when">✓</span></div>
          <div className="tl done"><span className="d"></span> Description (NO + EN) <span className="when">✓</span></div>
          <div className="tl now"><span className="d"></span> Application deadline <span className="when">now</span></div>
          <div className="tl"><span className="d"></span> Contact details <span className="when">—</span></div>
          <div className="tl"><span className="d"></span> Review & publish <span className="when">—</span></div>
        </div>
        <button onClick={onResume}>Resume composer <I.arrow size={14} /></button>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, alert, spark }) {
  return (
    <div className={"kpi" + (alert ? " alert" : "")}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {delta && <div className="delta">{delta}</div>}
      {spark && <Spark data={spark} color={alert ? "var(--claret)" : "var(--ink-3)"} />}
    </div>
  );
}

function StatusPill({ s }) {
  return <span className={"status " + s}><span className="pulse"></span> {s}</span>;
}

function JobRow({ job, onOpen }) {
  const d = dept(job.department);
  const c = campus(job.campus);
  const dl = daysLeft(job.deadline);
  const ratio = job.applications > 0 ? Math.min(job.applications / 60, 1) : 0;
  return (
    <div className="job-row" onClick={onOpen}>
      <div className="title-cell">
        <div className="crest" style={{ color: c.color }}>{d.crest}</div>
        <div className="t">
          <b>{job.titleEn}</b>
          <span>
            <span className="lang">NO</span>
            {job.titleNo}
          </span>
        </div>
      </div>
      <div className="dept-cell">
        <span className="pin" style={{ background: c.color }}></span>
        {d.name} · <span style={{ color: "var(--ink-3)" }}>{c.short}</span>
      </div>
      <div><StatusPill s={job.status} /></div>
      <div className="row-mini">
        {job.deadline ? (
          <>
            <span className="num">{fmtDate(job.deadline)}</span>
            {dl != null && dl > 0 && <span style={{ color: dl <= 5 ? "var(--claret)" : "var(--ink-3)" }}>· {dl}d</span>}
          </>
        ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
      </div>
      <div className="row-mini">
        <span className="num">{job.applications}</span>
        <div className="bar"><i style={{ width: `${ratio * 100}%` }}></i></div>
      </div>
      <div className="row-actions">
        <button title="Preview"><I.eye size={14} /></button>
        <button title="Duplicate"><I.copy size={14} /></button>
        <button title="More"><I.drag size={14} /></button>
      </div>
    </div>
  );
}

function Dashboard({ onCompose, onOpenJob }) {
  const [filter, setFilter] = React.useState("all");
  const counts = {
    all: SAMPLE_JOBS.length,
    published: SAMPLE_JOBS.filter(j => j.status === "published").length,
    draft: SAMPLE_JOBS.filter(j => j.status === "draft").length,
    closed: SAMPLE_JOBS.filter(j => j.status === "closed").length,
  };
  const visible = filter === "all" ? SAMPLE_JOBS : SAMPLE_JOBS.filter(j => j.status === filter);

  return (
    <div className="dash scroll">
      <div className="dash-head">
        <div>
          <h1>Jobs <em>this term.</em></h1>
          <p>Twelve open positions across eight units. Two drafts need your attention before Friday's all-campus newsletter goes out.</p>
        </div>
        <button className="compose-btn" onClick={onCompose}>
          <span className="plus"><I.plus size={14} /></span>
          Compose new job
        </button>
      </div>

      <div className="kpi-strip">
        <Kpi label="Open positions" value="12" delta="+3 this week" spark={[3,4,4,5,6,7,8,12]} />
        <Kpi label="Total applicants" value="228" delta="+47 since Monday" spark={[40,55,80,120,140,170,200,228]} />
        <Kpi label="Avg. time-to-fill" value="9d" delta="−2d vs. last term" spark={[14,13,12,11,10,10,9,9]} />
        <Kpi label="Closing in 5 days" value="3" alert delta="2 below applicant target" />
      </div>

      <FeaturedDraftCard onResume={onCompose} />

      <div className="filter-row">
        <div className="seg">
          {["all","published","draft","closed"].map(k => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {k.charAt(0).toUpperCase()+k.slice(1)} <span className="c">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <button className="chip"><I.filter size={13} /> Department</button>
        <button className="chip"><I.map size={13} /> Campus: Oslo</button>
        <button className="chip"><I.clock size={13} /> Last edited</button>
      </div>

      <div className="jobs-list">
        <div className="jobs-list-head">
          <div>Position</div>
          <div>Department</div>
          <div>Status</div>
          <div>Deadline</div>
          <div>Applications</div>
          <div></div>
        </div>
        {visible.map(j => <JobRow key={j.id} job={j} onOpen={onOpenJob} />)}
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = dashCSS; document.head.appendChild(s); })();
window.Dashboard = Dashboard;
