"use client";

import { useCallback, useEffect, useState } from "react";
import PhoneMockup from "@/components/PhoneMockup";
import PinPrompt from "@/components/PinPrompt";
import Shell, { useDemo } from "@/components/Shell";
import { ApiError, api, errText, getPin, setPin } from "@/lib/api";
import { dayAndTime, mmss, usd } from "@/lib/format";
import { useStream } from "@/lib/stream";
import type { Alert, Insight, Stats } from "@/lib/types";
import { useAlerts } from "@/lib/useAlerts";

const WINDOW_START = "2026-11-10T00:00:00Z";

type Gate = "checking" | "locked" | "wrong" | "open";

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mono mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export default function Insights() {
  const demo = useDemo();
  const [gate, setGate] = useState<Gate>("checking");
  const [stats, setStats] = useState<Stats | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState("");
  const { alerts, add: addAlert, reload: reloadAlerts } = useAlerts();

  const fail = useCallback((e: unknown, set: (s: string) => void) => {
    if (e instanceof ApiError && e.status === 401) {
      setPin("");
      setGate("wrong");
    } else set(errText(e));
  }, []);

  const load = useCallback(async () => {
    if (!getPin()) {
      setGate((g) => (g === "wrong" ? g : "locked"));
      return;
    }
    try {
      const [s, i] = await Promise.all([api<Stats>("/api/stats"), api<{ insights: Insight[] }>("/api/insights")]);
      setStats(s);
      const latest = [...i.insights].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
      setInsight(latest ?? null);
      setError("");
      setGate("open");
    } catch (e) {
      fail(e, setError);
      if (!(e instanceof ApiError && e.status === 401)) setGate("open");
    }
  }, [fail]);

  useEffect(() => {
    load();
  }, [load]);

  const live = useStream(
    (ev, data) => {
      if (ev === "alert.created") addAlert(data as Alert);
      else if (gate !== "open") return;
      else if (ev === "insight.created") {
        setInsight(data as Insight);
        load();
      } else if (ev === "charge.created" || ev === "decision.created") load();
    },
    () => {
      reloadAlerts();
      if (gate === "open" && !running) load();
    },
  );

  async function why() {
    setRunning(true);
    setRunErr("");
    try {
      const window_end = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      const i = await api<Insight>("/api/insights/run", { body: { window_start: WINDOW_START, window_end } });
      setInsight(i);
      api<Stats>("/api/stats").then(setStats).catch(() => {});
    } catch (e) {
      fail(e, setRunErr);
    } finally {
      setRunning(false);
    }
  }

  const recs = insight ? [...insight.recommendations].sort((a, b) => a.priority - b.priority).slice(0, 3) : [];
  const pct = insight ? Math.round(Math.max(0, Math.min(1, insight.confidence)) * 100) : 0;

  return (
    <Shell live={live} demo={demo}>
      {gate === "checking" ? (
        <p className="p-5 text-mute">Loading…</p>
      ) : gate !== "open" ? (
        <PinPrompt
          wrong={gate === "wrong"}
          onSubmit={(pin) => {
            setPin(pin);
            setGate("checking");
            load();
          }}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-5 lg:flex-row">
          <main className="min-w-0 flex-1 space-y-5">
            {error && <div className="note-err" role="alert">{error}</div>}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="This week">
              <Stat label="Charged" value={stats ? usd(stats.charges_total_usd) : "–"} tone="text-bad" />
              <Stat label="Disputed" value={stats ? usd(stats.disputed_usd) : "–"} tone="text-ok" />
              <Stat label="Accepted" value={stats ? usd(stats.accepted_usd) : "–"} />
              <Stat label="Avg handoff" value={stats ? mmss(stats.avg_handoff_s) : "–"} />
              <Stat label="Bags left waiting today" value={stats ? String(stats.stale_count_today) : "–"} tone={stats && stats.stale_count_today > 0 ? "text-warn" : ""} />
            </section>
            {stats && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="label">Still open</span>
                <span className="mono">{usd(stats.pending_usd)}</span>
                {stats.top_cause && (
                  <>
                    <span className="label ml-4">Top cause</span>
                    <span>{stats.top_cause}</span>
                  </>
                )}
              </div>
            )}

            <section className="card flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl">Why do these charges keep happening?</h1>
                <p className="mt-1 text-sm text-mute">Looks at every order, charge and late bag since Nov 10 for one root cause.</p>
              </div>
              <button className="btn btn-gold" style={{ minHeight: 56, fontSize: 20, padding: "0 32px" }} onClick={why} disabled={running}>
                {running ? "Thinking…" : "Why?"}
              </button>
            </section>

            {runErr && <div className="note-err" role="alert">{runErr}</div>}

            {insight ? (
              <article className="card border-gold/60 p-5" aria-live="polite">
                <div className="label">Likely root cause · recommendation, not a verdict</div>
                <h2 className="mt-1 text-3xl normal-case tracking-normal">{insight.cause}</h2>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between">
                    <span className="label">Confidence</span>
                    <span className="mono text-sm">{pct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-bg" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Confidence">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="label">Reasoning</div>
                  <p className="mt-1 text-[15px] leading-relaxed">{insight.reasoning}</p>
                </div>

                {(insight.evidence?.order_ids?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="label">Orders</span>
                    {insight.evidence.order_ids.slice(0, 12).map((id) => (
                      <span key={id} className="chip">#{id.replace(/^ord_/, "")}</span>
                    ))}
                  </div>
                )}

                <div className="mt-5">
                  <div className="label">What to change</div>
                  <ol className="mt-2 space-y-2">
                    {recs.map((r, idx) => (
                      <li key={idx} className="flex gap-3 rounded-lg border border-line bg-bg p-3">
                        <span className="head flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-lg font-semibold text-bg">{r.priority}</span>
                        <div className="min-w-0">
                          <div className="font-medium">{r.action}</div>
                          <div className="text-sm text-mute">{r.est_impact}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="label mt-4">
                  {dayAndTime(insight.window_start)} to {dayAndTime(insight.window_end)}
                </div>
              </article>
            ) : (
              !running && <p className="text-mute">No insight yet. Press Why? to look for a pattern.</p>
            )}
          </main>
          <PhoneMockup alerts={alerts} />
        </div>
      )}
    </Shell>
  );
}
