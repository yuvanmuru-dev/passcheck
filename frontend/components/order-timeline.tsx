"use client";

import Link from "next/link";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { money, reasonLabel, statusLabel, time } from "@/lib/constants";
import { useFeed } from "@/lib/stream";
import { EvidenceTimeline } from "./evidence";
import { useDemo } from "./navigation";
import { ChannelChip, LivePill, LoadState, ScreenHeader } from "./ui";

export function OrderTimeline({ id }: { id: string }) {
  const demo = useDemo();
  const load = useCallback(() => api.order(id), [id]);
  const { data, error, mode, refresh } = useFeed(load, ["order.updated", "evidence.created", "evidence.described", "charge.created", "decision.created"]);
  return <>
    <Link className="button back-link" href={demo ? "/?demo=1" : "/"}>← Pass Board</Link>
    <ScreenHeader title={data ? `Order #${data.order.ticket_no}` : "Order timeline"}><LivePill mode={mode} /></ScreenHeader>
    {(!data || error) && <LoadState error={error} refresh={refresh} label="Loading ticket and frames…" />}
    {data && <div className="ticket-layout">
      <div className="stack">
        <section className="panel stack">
          <div className="row spread"><h2>Ticket</h2><ChannelChip channel={data.order.channel} /></div>
          <p className="muted">Station {data.order.station} · {statusLabel[data.order.status]} · {time(data.order.created_at)}</p>
          <ul className="items">{data.order.items.map((item, index) => <li key={index} className="row spread">
            <div>{item.qty} × {item.name}{item.modifiers.length > 0 && <div className="muted">{item.modifiers.join(", ")}</div>}</div>
            <strong>{money(item.price * item.qty)}</strong>
          </li>)}</ul>
          <div className="row spread ticket-total"><span>Total</span><strong>{money(data.order.total)}</strong></div>
        </section>
        <section className="panel stack">
          <h2>Charges</h2>
          {!data.charges.length && <p className="muted">No charges for this order.</p>}
          {data.charges.map(charge => {
            const decision = data.decisions.find(row => row.charge_id === charge.id);
            return <div key={charge.id}>
              <div className="row spread"><Link className="text-link" href={`/disputes?charge=${charge.id}${demo ? "&demo=1" : ""}`}>{reasonLabel[charge.reason]}</Link><strong>{money(charge.amount)}</strong></div>
              <p className="muted">{charge.items.map(item => item.name).join(", ")} · {charge.status}</p>
              {decision && <p>{decision.approved_action ? `Manager decision: ${decision.approved_action}` : `Recommendation: ${decision.recommendation.replaceAll("_", " ")}`}</p>}
            </div>;
          })}
        </section>
      </div>
      <section className="stack"><h2>Evidence timeline</h2><EvidenceTimeline evidence={data.evidence} /></section>
    </div>}
  </>;
}
