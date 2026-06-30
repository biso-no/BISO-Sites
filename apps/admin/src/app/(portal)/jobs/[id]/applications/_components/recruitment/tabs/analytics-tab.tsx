"use client";

import type { RecruitmentAnalytics } from "../view-model";

function QualityKpi({
  label,
  value,
  helper,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <div className="an-kpi">
      <span className="an-kpi-lbl">{label}</span>
      <span className="an-kpi-val">{value}</span>
      <span className="an-kpi-help">{helper}</span>
    </div>
  );
}

export function AnalyticsTab({
  analytics,
}: {
  analytics: RecruitmentAnalytics;
}) {
  const donutStops: string[] = [];
  let cursor = 0;
  for (const source of analytics.sources) {
    const start = cursor;
    cursor += source.pct;
    donutStops.push(`${source.tint} ${start}% ${cursor}%`);
  }
  const donutGradient =
    donutStops.length > 0
      ? `conic-gradient(${donutStops.join(", ")})`
      : "conic-gradient(var(--paper-2) 0% 100%)";

  const maxTtf = Math.max(1, ...analytics.ttfTrend);
  const maxFunnel = Math.max(1, ...analytics.funnel.map((stage) => stage.n));

  return (
    <div className="analytics-tab rcr-pad" data-tour="analytics-overview">
      <div className="an-quality">
        <QualityKpi
          helper="across screened candidates"
          label="Median match"
          value={
            analytics.medianMatch == null ? "—" : `${analytics.medianMatch}`
          }
        />
        <QualityKpi
          helper="strong fits"
          label="Above 90%"
          value={`${analytics.aboveNinety}`}
        />
        <QualityKpi
          helper="of all applicants"
          label="Member share"
          value={
            analytics.memberShare == null ? "—" : `${analytics.memberShare}%`
          }
        />
        <QualityKpi
          helper="archived this round"
          label="Decline rate"
          value={
            analytics.declineRate == null ? "—" : `${analytics.declineRate}%`
          }
        />
      </div>

      <div className="an-grid">
        <div className="an-card">
          <h3>Pipeline funnel</h3>
          <div className="an-funnel">
            {analytics.funnel.map((stage) => (
              <div className="an-funnel-row" key={stage.stage}>
                <span className="an-funnel-lbl">{stage.label}</span>
                <span className="an-funnel-bar">
                  <span
                    className="an-funnel-fill"
                    style={{
                      background: stage.tint,
                      width: `${(stage.n / maxFunnel) * 100}%`,
                    }}
                  >
                    {stage.n}
                  </span>
                </span>
                <span className="an-funnel-pct">{stage.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="an-card">
          <h3>Sources</h3>
          <div className="an-sources">
            <div className="an-donut" style={{ background: donutGradient }}>
              <div className="an-donut-hole">
                <span className="an-donut-num">{analytics.total}</span>
                <span className="an-donut-cap">applicants</span>
              </div>
            </div>
            <div className="an-legend">
              {analytics.sources.map((source) => (
                <div className="an-legend-row" key={source.source}>
                  <span
                    className="an-swatch"
                    style={{ background: source.tint }}
                  />
                  <span className="an-legend-lbl">{source.label}</span>
                  <span className="an-legend-n">
                    {source.n} · {source.pct}%
                  </span>
                  {source.hires > 0 ? (
                    <span className="an-legend-hire">
                      {source.hires} hire{source.hires > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              ))}
              {analytics.sources.length === 0 ? (
                <p className="an-empty">No source data yet.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="an-card">
          <h3>Time to fill</h3>
          {analytics.ttfTrend.length === 0 ? (
            <p className="an-empty">No filled roles yet to measure.</p>
          ) : (
            <>
              <div className="an-ttf">
                {analytics.ttfTrend.map((value, index) => (
                  <span
                    className={`an-ttf-bar${
                      index === analytics.ttfTrend.length - 1 ? "last" : ""
                    }`}
                    key={index}
                    style={{ height: `${(value / maxTtf) * 100}%` }}
                    title={`${value} days`}
                  />
                ))}
              </div>
              <p className="an-ttf-cap">
                {analytics.ttfTrend.at(-1)} days · rolling average
              </p>
            </>
          )}
        </div>

        <div className="an-card">
          <h3>Days in stage</h3>
          {analytics.stageDays.length === 0 ? (
            <p className="an-empty">Not enough movement to measure yet.</p>
          ) : (
            <div className="an-stagedays">
              {analytics.stageDays.map((entry) => (
                <div className="an-stageday" key={entry.label}>
                  <span>{entry.label}</span>
                  <span className="an-stageday-val mono">{entry.days}d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
