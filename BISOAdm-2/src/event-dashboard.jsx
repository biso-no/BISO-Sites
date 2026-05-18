// Events dashboard — mirrors the jobs dashboard look but tuned for events
// (date blocks instead of crests, registration progress, capacity).

const evDashCSS = `
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
.dash-head p{margin: 8px 0 0; color: var(--ink-3); font-size: 14.5px; max-width: 48ch;}

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

/* KPI strip — same chrome as jobs */
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
.kpi .spark{position:absolute; right: 18px; bottom: 18px; width: 64px; height: 22px; opacity:.55;}

/* Filter row */
.filter-row{display:flex; align-items:center; gap: 8px; margin: 0 0 16px;}
.seg{display:flex; align-items:center; padding: 3px;
  background: var(--paper-2); border: 0.5px solid var(--rule-2); border-radius: 10px;}
.seg button{
  appearance: none; border: 0; background: transparent;
  padding: 6px 14px; border-radius: 7px;
  font-size: 12.5px; color: var(--ink-3); cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: background .12s, color .12s;
}
.seg button:hover{color: var(--ink);}
.seg button.on{background: white; color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.06);}
.seg button .c{font-family: var(--mono); font-size: 10.5px; color: var(--ink-4);}
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

/* Featured (continue editing) */
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
.featured-card .right .timeline{display:flex; flex-direction:column; gap: 6px; margin: 22px 0;}
.featured-card .right .tl{display:flex; align-items:center; gap: 10px; font-size: 12.5px;}
.featured-card .right .tl .d{width:14px; height:14px; border-radius:50%; border: 1px solid rgba(250,247,242,.4);}
.featured-card .right .tl.done .d{background: var(--paper); border-color: var(--paper);}
.featured-card .right .tl.now .d{border-color: var(--paper); box-shadow: 0 0 0 4px rgba(250,247,242,.12);}
.featured-card .right .tl .when{margin-left:auto; font-family: var(--mono); font-size: 11px; color: rgba(250,247,242,.55);}
.featured-card .right button{
  appearance:none; border: 0.5px solid rgba(250,247,242,.25);
  background: rgba(250,247,242,.08); color: var(--paper);
  padding: 10px 16px; border-radius: 8px;
  font-size: 13px; cursor: pointer;
  display:flex; align-items:center; gap: 10px; align-self: flex-start;
}
.featured-card .right button:hover{background: rgba(250,247,242,.16);}

/* Events list */
.events-list{display:flex; flex-direction:column; gap: 0;}
.events-list-head{
  display:grid; grid-template-columns: 56px 1.6fr 0.85fr 0.7fr 0.95fr 0.5fr 0.45fr;
  gap: 12px;
  padding: 0 16px 8px;
  font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4);
}
.event-row{
  display:grid; grid-template-columns: 56px 1.6fr 0.85fr 0.7fr 0.95fr 0.5fr 0.45fr;
  align-items:center; gap: 12px;
  padding: 14px 16px;
  border-top: 0.5px solid var(--rule);
  transition: background .12s;
  cursor: pointer;
  position: relative;
}
.event-row:last-child{border-bottom: 0.5px solid var(--rule);}
.event-row:hover{background: rgba(255,255,255,.55);}

/* Date block — replaces the "crest" used in jobs */
.date-block{
  width: 56px; min-height: 60px;
  border-radius: 10px;
  background: var(--paper);
  border: 0.5px solid var(--rule-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--serif);
  position: relative;
  overflow: hidden;
}
.date-block .m{
  background: var(--claret); color: var(--paper);
  font-family: var(--ui); font-size: 9.5px; letter-spacing: .08em;
  width: 100%; text-align: center; padding: 2px 0;
  text-transform: uppercase;
}
.date-block .d{
  font-size: 26px; line-height: 1; padding: 4px 0 6px;
  letter-spacing: -0.02em;
}
.date-block.tbd .m{background: var(--ink-4);}
.date-block.tbd .d{font-size: 14px; padding: 8px 0; color: var(--ink-3); font-style: italic;}

.event-row .title-cell{display:flex; flex-direction:column; min-width:0; gap: 3px;}
.event-row .title-cell .t{
  font-weight: 500; font-size: 14.5px; letter-spacing: -0.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.event-row .title-cell .sub{
  font-size: 12px; color: var(--ink-3); display:flex; align-items:center; gap: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.event-row .title-cell .lang{font-family: var(--mono); font-size: 9.5px; color: var(--ink-4); padding: 1px 4px; border: 0.5px solid var(--rule-2); border-radius: 3px;}
.event-row .title-cell .cat{
  display:inline-flex; align-items:center; gap: 4px;
  font-size: 10.5px; color: var(--ink-3);
  padding: 1px 6px;
  background: var(--paper-2); border-radius: 999px;
}

.when-cell{display:flex; flex-direction:column; gap: 2px; font-size: 12.5px;}
.when-cell .day{font-family: var(--mono); color: var(--ink-2);}
.when-cell .time{font-size: 11px; color: var(--ink-3);}
.when-cell .dur{font-size: 10.5px; color: var(--ink-4); font-family: var(--mono);}

.venue-cell{font-size: 12.5px; color: var(--ink-2); display:flex; align-items: center; gap: 6px; min-width:0;}
.venue-cell .pin{width: 8px; height: 8px; border-radius: 50%; background: var(--claret); flex-shrink: 0;}
.venue-cell span{overflow:hidden; text-overflow:ellipsis; white-space: nowrap;}
.venue-cell.online .pin{background: var(--sky);}

.cap-cell{display:flex; flex-direction:column; gap: 4px; font-size: 12px;}
.cap-cell .row{display:flex; align-items:baseline; gap: 6px;}
.cap-cell .num{font-family: var(--mono); font-feature-settings: "tnum" 1; font-weight: 500;}
.cap-cell .of{font-size: 10.5px; color: var(--ink-4);}
.cap-cell .bar{height: 3px; background: var(--paper-3); border-radius: 999px; overflow:hidden;}
.cap-cell .bar i{display:block; height: 100%; background: var(--ink);}
.cap-cell .bar.full i{background: var(--claret);}

.price-cell{font-size: 12.5px; color: var(--ink-2); font-family: var(--mono);}
.price-cell.free{color: var(--leaf);}
.price-cell .mem{font-size: 10.5px; color: var(--ink-3);}

/* status pill — shared */
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
.status.cancelled .pulse{background: var(--claret);}
.status.cancelled{color: var(--claret); background: rgba(107,30,30,.06); border-color: rgba(107,30,30,.2); text-decoration: line-through;}

.row-actions{display:flex; align-items: center; gap: 4px; justify-content: flex-end; opacity: 0; transition: opacity .15s;}
.event-row:hover .row-actions{opacity: 1;}
.row-actions button{
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border: 0.5px solid var(--rule-2); border-radius: 7px;
  background: rgba(255,255,255,.7); color: var(--ink-2);
  cursor: pointer;
}
.row-actions button:hover{color: var(--ink); background: white;}

/* Collection badge for series */
.coll-badge{
  display:inline-flex; align-items:center; gap: 4px;
  font-size: 10px; padding: 1px 6px; border-radius: 999px;
  background: linear-gradient(180deg, rgba(176,138,62,.15), rgba(176,138,62,.05));
  border: 0.5px solid rgba(176,138,62,.35);
  color: #6a5118; letter-spacing: .04em; text-transform: uppercase; font-weight: 500;
}
`;

function EvSpark({ data, color = "currentColor" }) {
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

function EvKpi({ label, value, delta, alert, spark }) {
  return (
    <div className={"kpi" + (alert ? " alert" : "")}>
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {delta && <div className="delta">{delta}</div>}
      {spark && <EvSpark data={spark} color={alert ? "var(--claret)" : "var(--ink-3)"} />}
    </div>
  );
}

function FeaturedEventDraftCard({ onResume }) {
  return (
    <div className="featured-card">
      <div className="left">
        <div className="eyebrow"><span className="star"><I.spark2 size={12} /></span> Pick up where you left off</div>
        <h2>Buddy Speed Dating — <em style={{ fontStyle: "italic", color: "var(--claret)" }}>3 fields away</em></h2>
        <div className="desc">Description and walkthrough are in; you still need to nail a date, the room, and how many seats the kantina actually holds.</div>
        <div className="meta">
          <div><b>58%</b><span>Complete</span></div>
          <div><b>3</b><span>Required fields</span></div>
          <div><b>15w</b><span>Until kickoff</span></div>
        </div>
      </div>
      <div className="right">
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(250,247,242,.55)", marginBottom: 8 }}>Publishing checklist</div>
          <h3>Eight steps to ESN's first night of the term.</h3>
        </div>
        <div className="timeline">
          <div className="tl done"><span className="d"></span> Title & category <span className="when">✓</span></div>
          <div className="tl done"><span className="d"></span> Description (EN + NO) <span className="when">✓</span></div>
          <div className="tl now"><span className="d"></span> Date, time, doors <span className="when">now</span></div>
          <div className="tl"><span className="d"></span> Venue & capacity <span className="when">—</span></div>
          <div className="tl"><span className="d"></span> Tickets & audience <span className="when">—</span></div>
        </div>
        <button onClick={onResume}>Resume composer <I.arrow size={14} /></button>
      </div>
    </div>
  );
}

function EvStatusPill({ s }) {
  return <span className={"status " + s}><span className="pulse"></span> {s}</span>;
}

function DateBlock({ iso }) {
  if (!iso) return (
    <div className="date-block tbd">
      <div className="m">tbd</div>
      <div className="d">—</div>
    </div>
  );
  return (
    <div className="date-block">
      <div className="m">{fmtMonth(iso)}</div>
      <div className="d">{fmtDayNum(iso)}</div>
    </div>
  );
}

function EventRow({ ev, onOpen }) {
  const cat = evCat(ev.category) || { name: "—" };
  const ratio = ev.capacity > 0 ? Math.min(ev.registered / ev.capacity, 1) : 0;
  const full = ratio >= 1;
  return (
    <div className="event-row" onClick={onOpen}>
      <DateBlock iso={ev.startDate} />
      <div className="title-cell">
        <div className="t">
          {ev.titleEn}
          {ev.isCollection && <span className="coll-badge" style={{ marginLeft: 8 }}>Series</span>}
        </div>
        <div className="sub">
          <span className="lang">NO</span>
          {ev.titleNo} <span style={{ color: "var(--ink-4)" }}>·</span>
          <span className="cat">{cat.name}</span>
        </div>
      </div>
      <div className="when-cell">
        {ev.startDate ? (
          <>
            <span className="day">{fmtDay(ev.startDate)}</span>
            <span className="time">{fmtTime(ev.startDate)} – {fmtTime(ev.endDate)}</span>
            <span className="dur">{durationHrs(ev.startDate, ev.endDate)}</span>
          </>
        ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
      </div>
      <div className="venue-cell">
        {ev.location ? (
          <>
            <span className="pin"></span>
            <span>{ev.location}</span>
          </>
        ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
      </div>
      <div className="cap-cell">
        <div className="row">
          <span className="num">{ev.registered}</span>
          <span className="of">of {ev.capacity || "—"}</span>
        </div>
        <div className={"bar" + (full ? " full" : "")}><i style={{ width: `${ratio * 100}%` }}></i></div>
      </div>
      <div className={"price-cell" + (ev.price === 0 ? " free" : "")}>
        {fmtNOK(ev.price)}
        {ev.price > 0 && ev.memberPrice > 0 && ev.memberPrice < ev.price && (
          <div className="mem">{fmtNOK(ev.memberPrice)} memb.</div>
        )}
      </div>
      <div><EvStatusPill s={ev.status} /></div>
    </div>
  );
}

function EventsDashboard({ onCompose, onOpenEvent }) {
  const [filter, setFilter] = React.useState("upcoming");

  const now = new Date("2026-05-13").getTime();
  const buckets = {
    all: SAMPLE_EVENTS,
    upcoming: SAMPLE_EVENTS.filter(e => e.status === "published" && (!e.startDate || new Date(e.startDate).getTime() >= now)),
    draft: SAMPLE_EVENTS.filter(e => e.status === "draft"),
    past: SAMPLE_EVENTS.filter(e => e.startDate && new Date(e.startDate).getTime() < now && e.status !== "draft"),
    cancelled: SAMPLE_EVENTS.filter(e => e.status === "cancelled"),
  };
  const visible = buckets[filter];

  return (
    <div className="dash scroll">
      <div className="dash-head">
        <div>
          <h1>Events <em>this term.</em></h1>
          <p>Seven events open for sign-ups. The Fadderuke series needs a final venue confirmed before tickets can go on sale Friday.</p>
        </div>
        <button className="compose-btn" onClick={onCompose}>
          <span className="plus"><I.plus size={14} /></span>
          Compose new event
        </button>
      </div>

      <div className="kpi-strip">
        <EvKpi label="Upcoming events" value="7" delta="+2 since last week" spark={[3,3,4,5,5,6,6,7]} />
        <EvKpi label="Total registrants" value="2,635" delta="+318 since Monday" spark={[820,1100,1400,1700,2000,2300,2500,2635]} />
        <EvKpi label="Avg. fill rate" value="83%" delta="+9% vs. last term" spark={[60,62,68,71,75,78,80,83]} />
        <EvKpi label="Sold out next 7 days" value="2" alert delta="Open a waitlist?" />
      </div>

      <FeaturedEventDraftCard onResume={onCompose} />

      <div className="filter-row">
        <div className="seg">
          {[
            ["all", "All"],
            ["upcoming", "Upcoming"],
            ["draft", "Drafts"],
            ["past", "Past"],
            ["cancelled", "Cancelled"],
          ].map(([k, label]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
              {label} <span className="c">{buckets[k].length}</span>
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <button className="chip"><I.filter size={13} /> Category</button>
        <button className="chip"><I.map size={13} /> Campus: Oslo</button>
        <button className="chip"><I.events size={13} /> This month</button>
      </div>

      <div className="events-list">
        <div className="events-list-head">
          <div></div>
          <div>Event</div>
          <div>When</div>
          <div>Venue</div>
          <div>Registered</div>
          <div>Price</div>
          <div>Status</div>
        </div>
        {visible.map(e => <EventRow key={e.id} ev={e} onOpen={onOpenEvent} />)}
        {visible.length === 0 && (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--ink-4)", fontStyle: "italic", borderTop: "0.5px solid var(--rule)" }}>
            Nothing here yet.
          </div>
        )}
      </div>
    </div>
  );
}

(function(){ const s = document.createElement("style"); s.textContent = evDashCSS; document.head.appendChild(s); })();
window.EventsDashboard = EventsDashboard;
