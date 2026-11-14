"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { duration, errorMessage, stages, statusLabel } from "@/lib/constants";
import { useFeed } from "@/lib/stream";
import type { Order, OrderStatus } from "@/lib/types";
import { DemoBar } from "./demo-bar";
import { useDemo } from "./navigation";
import { Phone } from "./phone";
import { ChannelChip, LivePill, LoadState, ScreenHeader } from "./ui";

const labels: Record<OrderStatus, string> = { new: "Start packing", packing: "Mark ready", ready: "Hand off", handed_off: "Handed off" };

function Timer({ started, threshold }: { started: string; threshold: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(started)) / 1000));
  const tone = seconds >= threshold ? "red" : seconds >= Math.min(120, threshold * 2 / 3) ? "amber" : "";
  return <span className={`timer ${tone}`}><span>Bag waiting</span><strong>{duration(seconds)}</strong></span>;
}

function OrderCard({ order, threshold, demo, refresh }: { order: Order; threshold: number; demo: boolean; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = stages[stages.indexOf(order.status) + 1];

  async function bump() {
    if (!next || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.bump(order.id, next);
      refresh();
    } catch (error) {
      setError(errorMessage(error));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="order-card">
      <div className="card-top">
        <Link className="ticket" href={`/orders/${order.id}${demo ? "?demo=1" : ""}`}>#{order.ticket_no}</Link>
        <ChannelChip channel={order.channel} />
      </div>
      <div className="order-meta"><span>Station {order.station}</span>{order.evidence_count > 0 && <span className="evidence-count" title="Captured frames">📷 {order.evidence_count}</span>}</div>
      <ul className="items">{order.items.map((item, index) => <li key={index}><span>{item.qty} ×</span> {item.name}</li>)}</ul>
      {order.status === "ready" && order.ready_at && <Timer started={order.ready_at} threshold={threshold} />}
      {next && <button className="primary bump" disabled={busy} onClick={bump}>{busy ? "Updating…" : labels[order.status]} <span aria-hidden="true">→</span></button>}
      {error && <p className="red" role="alert">{error}</p>}
    </article>
  );
}

export function Board() {
  const demo = useDemo();
  const { data: orders, error, mode, refresh } = useFeed(api.orders, ["order.created", "order.updated", "evidence.created"]);
  const [threshold, setThreshold] = useState(() => typeof window === "undefined" ? 180 : Number(sessionStorage.getItem("passcheck-threshold") || 180));

  function changeThreshold(seconds: number) {
    sessionStorage.setItem("passcheck-threshold", String(seconds));
    setThreshold(seconds);
  }

  return (
    <>
      <ScreenHeader title="Pass Board"><LivePill mode={mode} /></ScreenHeader>
      {demo && <DemoBar orders={orders ?? []} threshold={threshold} onThreshold={changeThreshold} />}
      {(!orders || error) && <LoadState error={error} refresh={refresh} label="Loading orders…" />}
      <div className={demo ? "board-with-phone" : ""}>
        {orders && <div className="board">
          {stages.map(stage => {
            const entries = orders.filter(order => order.status === stage);
            return <section className={`lane lane-${stage}`} key={stage} aria-label={statusLabel[stage]}>
              <div className="lane-heading"><h2>{statusLabel[stage]}</h2><span>{entries.length}</span></div>
              {entries.map(order => <OrderCard key={order.id} order={order} threshold={threshold} demo={demo} refresh={refresh} />)}
              {!entries.length && <p className="empty">No orders</p>}
            </section>;
          })}
        </div>}
        {demo && <Phone />}
      </div>
    </>
  );
}
