"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, money, reasonLabel, statusLabel } from "@/lib/constants";
import { signalRefresh, useFeed } from "@/lib/stream";
import type { DisputeDecision, InboxCharge } from "@/lib/types";
import { EvidenceTimeline } from "./evidence";
import { isPinError, PinPrompt, savePin, usePin } from "./manager";
import { useDemo } from "./navigation";
import { Phone } from "./phone";
import { ChannelChip, LivePill, LoadState, ScreenHeader } from "./ui";

function deadline(value: string) {
  const days = Math.ceil((Date.parse(value) - Date.now()) / 86400000);
  if (Date.parse(value) < Date.now()) return "Deadline passed";
  if (days <= 1) return "Less than 1 day left";
  return `${days} days left`;
}

function ChargeDetail({ charge, demo }: { charge: InboxCharge; demo: boolean }) {
  const load = useCallback(() => api.order(charge.order_id), [charge.order_id]);
  const frames = useFeed(load, ["evidence.created", "evidence.described"]);
  const [decisionOverride, setDecisionOverride] = useState<DisputeDecision | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const decision = charge.decision?.approved_action ? charge.decision : decisionOverride ?? charge.decision;
  const finalText = draft ?? decision?.draft_text ?? "";

  async function run(action?: "disputed" | "accepted") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setDecisionOverride(action ? await api.approve(charge.id, action, finalText) : await api.analyze(charge.id));
      signalRefresh();
    } catch (error) {
      if (isPinError(error)) savePin("");
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="stack">
    <div className="panel stack">
      <div className="row spread"><h2>{reasonLabel[charge.reason]} · {money(charge.amount)}</h2><ChannelChip channel={charge.platform} /></div>
      <div className="row spread"><Link className="text-link" href={`/orders/${charge.order_id}${demo ? "?demo=1" : ""}`}>Order #{charge.order.ticket_no}</Link><span className="muted">{deadline(charge.dispute_deadline)}</span></div>
      <p>{charge.items.map(item => `${item.qty} × ${item.name}`).join(", ")}</p>
      {charge.customer_note && <blockquote className="customer-note">{charge.customer_note}</blockquote>}
      {!decision && <button className="primary" disabled={busy} onClick={() => run()}>{busy ? "Analyzing…" : "Analyze"}</button>}
      {!!error && <p className="red" role="alert">{error}</p>}
      {!!notice && <p className="green" role="status">{notice}</p>}
    </div>
    {decision && <section className="panel stack">
      <div className={`verdict verdict-${decision.recommendation.toLowerCase()}`}>
        <span>AI recommendation</span>
        <h2>{decision.recommendation.replaceAll("_", " ")}</h2>
        <span>{Math.round(decision.confidence * 100)}% confidence</span>
      </div>
      <p>{decision.rationale}</p>
      {decision.evidence_ids.length > 0 && <div className="row">{decision.evidence_ids.map(id => {
        const frame = frames.data?.evidence.find(frame => frame.id === id);
        return frame ? <a key={id} className="button" href={`#${id}`}>{statusLabel[frame.kind]} frame</a> : <span key={id} className="chip">{id}</span>;
      })}</div>}
      {(!decision.approved_action || finalText) && <>
        <label htmlFor="dispute-draft">Dispute draft</label>
        <textarea id="dispute-draft" rows={5} value={finalText} readOnly={Boolean(decision.approved_action)} onChange={event => setDraft(event.target.value)} />
      </>}
      <div className="row">
        {decision.approved_action ? <strong>Manager decision: {decision.approved_action}</strong> : <>
          <button className="primary" disabled={busy || !finalText.trim()} onClick={() => run("disputed")}>Approve dispute</button>
          <button disabled={busy} onClick={() => run("accepted")}>Accept charge</button>
        </>}
        <button disabled={!finalText.trim()} onClick={async () => {
          setError("");
          try {
            await navigator.clipboard.writeText(finalText);
            setNotice("Draft copied.");
          } catch {
            setError("Couldn’t copy automatically. Select the draft to copy it.");
          }
        }}>Copy text</button>
      </div>
    </section>}
    <section className="stack">
      <h2>Order frames</h2>
      {(!frames.data || frames.error) && <LoadState error={frames.error} refresh={frames.refresh} label="Loading frames…" />}
      {frames.data && <EvidenceTimeline evidence={frames.data.evidence} />}
    </section>
  </section>;
}

async function loadInbox() {
  try {
    return { charges: await api.charges(), invalid: false };
  } catch (error) {
    if (isPinError(error)) return { charges: [], invalid: true };
    throw error;
  }
}

function Inbox() {
  const requested = useSearchParams().get("charge");
  const demo = useDemo();
  const [selection, setSelection] = useState<string | null>(null);
  const { data, error, mode, refresh } = useFeed(loadInbox, ["charge.created", "decision.created"]);
  const charges = data?.charges ?? [];
  const selected = charges.find(charge => charge.id === (selection ?? requested)) ?? charges[0];

  if (data?.invalid) return <PinPrompt invalid />;
  return <>
    <div className="row spread manager-toolbar"><LivePill mode={mode} /><button onClick={() => savePin("")}>Lock</button></div>
    {(!data || error) && <LoadState error={error} refresh={refresh} label="Loading charges…" />}
    {data && <div className="disputes-grid">
      <section className="stack" aria-label="Dispute inbox">
        {!charges.length && <div className="panel muted">No charges yet. You’re clean this week.</div>}
        {charges.map(charge => <button className="inbox-ticket" aria-pressed={charge.id === selected?.id} key={charge.id} onClick={() => setSelection(charge.id)}>
          <span className="row spread"><strong>#{charge.order.ticket_no}</strong><ChannelChip channel={charge.platform} /></span>
          <span className="row spread"><span>{reasonLabel[charge.reason]}</span><strong>{money(charge.amount)}</strong></span>
          <span>{charge.items.map(item => item.name).join(", ")}</span>
          <span className="muted">{deadline(charge.dispute_deadline)} · {charge.status}</span>
        </button>)}
      </section>
      {selected && <ChargeDetail key={selected.id} charge={selected} demo={demo} />}
    </div>}
  </>;
}

export function Disputes() {
  const pin = usePin();
  return <>
    <ScreenHeader title="Disputes" />
    <div className="manager-layout">
      <div className="stack">{pin ? <Inbox key={pin} /> : <PinPrompt />}</div>
      <Phone />
    </div>
  </>;
}
