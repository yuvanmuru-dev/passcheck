"use client";

import { useCallback, useEffect, useState } from "react";
import Frames from "@/components/Frames";
import PhoneMockup from "@/components/PhoneMockup";
import PinPrompt from "@/components/PinPrompt";
import Shell, { useDemo } from "@/components/Shell";
import { ApiError, api, errText, getPin, setPin } from "@/lib/api";
import { CHANNEL_LABEL, REASON_LABEL, chipClass, clock, dayAndTime, daysLeft, itemSummary, usd } from "@/lib/format";
import { useStream } from "@/lib/stream";
import type { Alert, ChargeRow, DisputeDecision, Evidence, OrderDetail, Recommendation } from "@/lib/types";
import { useAlerts } from "@/lib/useAlerts";

const VERDICT: Record<Recommendation, { label: string; tone: string }> = {
  DISPUTE: { label: "Dispute", tone: "border-ok/60 bg-ok/10 text-ok" },
  ACCEPT: { label: "Accept", tone: "border-line bg-white/5 text-ink" },
  NEEDS_REVIEW: { label: "Needs review", tone: "border-warn/60 bg-warn/10 text-warn" },
};

const STATUS_CHIP: Record<ChargeRow["status"], string> = {
  new: "chip chip-gold",
  analyzed: "chip chip-warn",
  disputed: "chip chip-ue",
  accepted: "chip",
};

type Gate = "checking" | "locked" | "wrong" | "open";

export default function Disputes() {
  const demo = useDemo();
  const [gate, setGate] = useState<Gate>("checking");
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [selId, setSelId] = useState("");
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
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
      const r = await api<{ charges: ChargeRow[] }>("/api/charges");
      setCharges(r.charges);
      setError("");
      setGate("open");
    } catch (e) {
      fail(e, setError);
    } finally {
      setLoaded(true);
    }
  }, [fail]);

  useEffect(() => {
    setNow(Date.now());
    load();
  }, [load]);

  const sel = charges.find((c) => c.id === selId);
  const decision: DisputeDecision | null = sel?.decision ?? null;
  const orderId = sel?.order_id;

  const loadEvidence = useCallback(async (id: string) => {
    try {
      const r = await api<OrderDetail>(`/api/orders/${id}`);
      setEvidence(r.evidence);
    } catch {
      setEvidence([]);
    }
  }, []);

  useEffect(() => {
    setEvidence(null);
    setActionErr("");
    setCopied(false);
    if (orderId) loadEvidence(orderId);
  }, [selId, orderId, loadEvidence]);

  // Load the model's draft into the editable box whenever a new decision arrives.
  useEffect(() => {
    setDraft(decision?.draft_text ?? "");
  }, [decision?.id, decision?.draft_text]);

  const live = useStream(
    (ev, data) => {
      if (ev === "alert.created") addAlert(data as Alert);
      else if (gate !== "open") return;
      else if (ev === "charge.created" || ev === "decision.created") load();
      else if ((ev === "evidence.created" || ev === "evidence.described") && (data as Evidence).order_id === orderId && orderId) loadEvidence(orderId);
    },
    () => {
      reloadAlerts();
      if (gate === "open" && !busy) load();
    },
  );

  async function analyze() {
    if (!sel) return;
    setBusy("analyze");
    setActionErr("");
    try {
      const d = await api<DisputeDecision>(`/api/charges/${sel.id}/analyze`, { method: "POST" });
      setCharges((prev) => prev.map((c) => (c.id === sel.id ? { ...c, status: "analyzed", decision: d } : c)));
    } catch (e) {
      fail(e, setActionErr);
    } finally {
      setBusy("");
    }
  }

  async function approve(action: "disputed" | "accepted") {
    if (!sel) return;
    setBusy(action);
    setActionErr("");
    try {
      const d = await api<DisputeDecision>(`/api/charges/${sel.id}/approve`, { body: { action, final_text: draft } });
      setCharges((prev) => prev.map((c) => (c.id === sel.id ? { ...c, status: action, decision: d } : c)));
    } catch (e) {
      fail(e, setActionErr);
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setActionErr("Couldn't copy. Select the text and copy it by hand.");
    }
  }

  const closed = sel?.status === "disputed" || sel?.status === "accepted";

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
          <section className="w-full shrink-0 lg:w-[340px]" aria-label="Error charges">
            <h1 className="mb-3 flex items-baseline justify-between border-b border-line pb-2 text-lg">
              Error charges <span className="mono text-sm text-mute">{charges.length}</span>
            </h1>
            {error && <div className="note-err mb-3" role="alert">{error}</div>}
            {!loaded ? (
              <p className="text-mute">Loading charges…</p>
            ) : charges.length === 0 && !error ? (
              <p className="text-mute">No charges yet. You&apos;re clean this week.</p>
            ) : (
              <ul className="space-y-2">
                {charges.map((c) => {
                  const left = daysLeft(c.dispute_deadline, now);
                  return (
                    <li key={c.id}>
                      <button
                        className={`card block w-full cursor-pointer p-3 text-left hover:border-gold ${c.id === selId ? "border-gold bg-[#26332a]" : ""}`}
                        onClick={() => setSelId(c.id)}
                        aria-current={c.id === selId}
                      >
                        <div className="flex items-center gap-2">
                          <span className="mono text-xl font-bold">#{c.order?.ticket_no ?? "?"}</span>
                          <span className={chipClass(c.platform)}>{CHANNEL_LABEL[c.platform] || c.platform}</span>
                          <span className="mono ml-auto text-lg font-semibold">{usd(c.amount)}</span>
                        </div>
                        <div className="mt-1 text-sm">
                          {REASON_LABEL[c.reason] || c.reason}
                          {c.items.length > 0 && `: ${itemSummary(c.items)}`}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={STATUS_CHIP[c.status] || "chip"}>{c.status}</span>
                          {c.status !== "disputed" && c.status !== "accepted" && now > 0 && (
                            <span className={`label ${left <= 3 ? "!text-bad" : ""}`}>
                              {left > 0 ? `${left} day${left === 1 ? "" : "s"} left to dispute` : "Dispute window closed"}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <main className="min-w-0 flex-1">
            {!sel ? (
              <div className="card p-8 text-center text-mute">Pick a charge to see what the camera recorded.</div>
            ) : (
              <div className="space-y-5">
                <section className="card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl">
                      Order #{sel.order?.ticket_no ?? "?"}
                    </h2>
                    <span className={chipClass(sel.platform)}>{CHANNEL_LABEL[sel.platform]}</span>
                    <span className={STATUS_CHIP[sel.status]}>{sel.status}</span>
                    <span className="mono ml-auto text-2xl font-bold">{usd(sel.amount)}</span>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="label">Complaint</dt>
                      <dd>
                        {REASON_LABEL[sel.reason] || sel.reason}
                        {sel.items.length > 0 && `: ${itemSummary(sel.items)}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="label">Customer note</dt>
                      <dd>{sel.customer_note ? `“${sel.customer_note}”` : "None"}</dd>
                    </div>
                    <div>
                      <dt className="label">Charged</dt>
                      <dd>{dayAndTime(sel.charged_at)}</dd>
                    </div>
                    <div>
                      <dt className="label">Dispute by</dt>
                      <dd>{dayAndTime(sel.dispute_deadline)}</dd>
                    </div>
                    {sel.order && (
                      <div className="sm:col-span-2">
                        <dt className="label">Ticket · Station {sel.order.station}</dt>
                        <dd>{itemSummary(sel.order.items)}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section>
                  <h3 className="mb-2 text-base">What the camera recorded</h3>
                  {evidence === null ? <p className="text-sm text-mute">Loading frames…</p> : <Frames evidence={evidence} cited={decision?.evidence_ids ?? []} />}
                </section>

                {actionErr && <div className="note-err" role="alert">{actionErr}</div>}

                {!decision ? (
                  <section className="card flex flex-wrap items-center gap-4 p-4">
                    <p className="min-w-0 flex-1 text-sm text-mute">Check this charge against the frames. You make the final call.</p>
                    <button className="btn btn-gold" onClick={analyze} disabled={!!busy}>
                      {busy === "analyze" ? "Analyzing…" : "Analyze"}
                    </button>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <div className={`rounded-[10px] border-2 p-4 ${VERDICT[decision.recommendation]?.tone ?? VERDICT.NEEDS_REVIEW.tone}`} role="status">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <span className="label !text-current opacity-80">Recommendation</span>
                        <span className="head text-3xl font-semibold">{VERDICT[decision.recommendation]?.label ?? decision.recommendation}</span>
                        <span className="mono ml-auto text-sm">{Math.round(decision.confidence * 100)}% confident</span>
                      </div>
                      <p className="mt-2 text-sm text-ink">{decision.rationale}</p>
                      {decision.evidence_ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="label">Based on</span>
                          {decision.evidence_ids.map((id) => (
                            <span key={id} className="chip chip-gold">{id}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card space-y-3 p-4">
                      <label className="flex flex-col gap-2">
                        <span className="label">Dispute text (edit before sending)</span>
                        <textarea className="input min-h-[150px] w-full" value={draft} onChange={(e) => { setDraft(e.target.value); setCopied(false); }} maxLength={2000} disabled={closed} />
                      </label>
                      {closed ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={STATUS_CHIP[sel.status]}>{sel.status}</span>
                          <span className="text-sm text-mute">
                            Manager decision recorded{decision.approved_at ? ` at ${clock(decision.approved_at)}` : ""}.
                          </span>
                          <button className="btn btn-sm ml-auto" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <button className="btn btn-ok" onClick={() => approve("disputed")} disabled={!!busy || !draft.trim()}>
                            {busy === "disputed" ? "Saving…" : "Approve dispute"}
                          </button>
                          <button className="btn" onClick={() => approve("accepted")} disabled={!!busy}>
                            {busy === "accepted" ? "Saving…" : "Accept charge"}
                          </button>
                          <button className="btn btn-sm" onClick={copy}>{copied ? "Copied" : "Copy text"}</button>
                          <button className="btn btn-sm ml-auto" onClick={analyze} disabled={!!busy}>
                            {busy === "analyze" ? "Analyzing…" : "Analyze again"}
                          </button>
                          {!draft.trim() && <p className="w-full text-sm text-mute">To dispute this charge, write the dispute text first.</p>}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </main>

          <PhoneMockup alerts={alerts} />
        </div>
      )}
    </Shell>
  );
}
