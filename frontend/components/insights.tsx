"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { duration, errorMessage, money } from "@/lib/constants";
import { signalRefresh, useFeed } from "@/lib/stream";
import type { Insight } from "@/lib/types";
import { isPinError, PinPrompt, savePin, usePin } from "./manager";
import { useDemo } from "./navigation";
import { Phone } from "./phone";
import { LivePill, LoadState, ScreenHeader } from "./ui";

async function loadReview() {
  try {
    const [stats, insights] = await Promise.all([api.stats(), api.insights()]);
    return { stats, insights, invalid: false };
  } catch (error) {
    if (isPinError(error)) return { stats: null, insights: [], invalid: true };
    throw error;
  }
}

function InsightCard({ insight, demo }: { insight: Insight; demo: boolean }) {
  const { evidence } = insight;
  const confidence = Math.round(insight.confidence * 100);
  return <article className="panel stack">
    <p className="muted">AI recommendation · {new Date(insight.window_start).toLocaleDateString()} – {new Date(insight.window_end).toLocaleDateString()}</p>
    <h2>{insight.cause}</h2>
    <div className="row"><progress max={100} value={confidence} aria-label="Recommendation confidence" /><span>{confidence}% confidence</span></div>
    <p>{insight.reasoning}</p>
    <div className="row">
      {evidence.order_ids.map(id => <Link className="button" href={`/orders/${id}${demo ? "?demo=1" : ""}`} key={id}>Order #{id.replace(/^ord_/, "")}</Link>)}
      {evidence.charge_ids.map(id => <Link className="button" href={`/disputes?charge=${id}${demo ? "&demo=1" : ""}`} key={id}>Charge {id.replace(/^chg_/, "")}</Link>)}
      {evidence.alert_ids.map(id => <a className="button" href={`#${id}`} key={id}>Alert {id.replace(/^alt_/, "")}</a>)}
    </div>
    {insight.recommendations.length > 0 && <div className="stack">
      <h3>Suggested fixes</h3>
      <ol className="fixes">
        {insight.recommendations.slice().sort((a, b) => a.priority - b.priority).map(row => <li value={row.priority} key={row.priority}><strong>{row.action}</strong><p className="muted">{row.est_impact}</p></li>)}
      </ol>
    </div>}
  </article>;
}

function Review() {
  const demo = useDemo();
  const { data, error, mode, refresh } = useFeed(loadReview, ["charge.created", "decision.created", "insight.created", "alert.created", "order.updated"]);
  const [latest, setLatest] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const stats = data?.stats;
  const insights = latest ? [latest, ...(data?.insights ?? []).filter(row => row.id !== latest.id)] : data?.insights ?? [];
  const metrics = stats ? [
    ["Charged", money(stats.charges_total_usd)],
    ["Disputed", money(stats.disputed_usd)],
    ["Avg. handoff", duration(Math.max(0, Math.round(stats.avg_handoff_s)))],
    ["Stale today", stats.stale_count_today],
    ["Top cause", stats.top_cause ?? "—"],
  ] : [];

  async function run() {
    setBusy(true);
    setFailure("");
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400000);
    try {
      setLatest(await api.runInsights(start.toISOString(), end.toISOString()));
      signalRefresh();
    } catch (error) {
      if (isPinError(error)) savePin("");
      setFailure(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (data?.invalid) return <PinPrompt invalid />;
  return <>
    <div className="row spread manager-toolbar"><LivePill mode={mode} /><button onClick={() => savePin("")}>Lock</button></div>
    {(!data || error) && <LoadState error={error} refresh={refresh} label="Loading stats…" />}
    {stats && <dl className="stats">{metrics.map(([label, value]) => <div className="panel" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <div className="row spread"><h2>Last seven days</h2><button className="primary" onClick={run} disabled={!data || busy}>{busy ? "Analyzing…" : "Why?"}</button></div>
    {failure && <p role="alert" className="red">{failure}</p>}
    {data && !insights.length && <p className="panel muted">No insights yet. Run a seven-day review.</p>}
    {insights.map(insight => <InsightCard key={insight.id} insight={insight} demo={demo} />)}
  </>;
}

export function Insights() {
  const pin = usePin();
  return <>
    <ScreenHeader title="Insights" />
    <div className="manager-layout">
      <div className="stack">{pin ? <Review key={pin} /> : <PinPrompt />}</div>
      <Phone />
    </div>
  </>;
}
