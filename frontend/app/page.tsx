"use client";

import { useCallback, useEffect, useState } from "react";
import DemoBar from "@/components/DemoBar";
import Frames from "@/components/Frames";
import PhoneMockup from "@/components/PhoneMockup";
import Shell, { useDemo } from "@/components/Shell";
import { api, errText, getStaleThreshold } from "@/lib/api";
import { CHANNEL_LABEL, STATUS_LABEL, chipClass, itemSummary, mmss } from "@/lib/format";
import { useStream } from "@/lib/stream";
import type { Alert, Evidence, Order, OrderDetail, OrderStatus } from "@/lib/types";
import { useAlerts } from "@/lib/useAlerts";

const COLUMNS: OrderStatus[] = ["new", "packing", "ready", "handed_off"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: "packing", packing: "ready", ready: "handed_off" };
const HANDED_OFF_SHOWN = 6;

function ReadyTimer({ readyAt, now, threshold }: { readyAt: string; now: number; threshold: number }) {
  const waited = (now - new Date(readyAt).getTime()) / 1000;
  const amberAt = Math.min(120, threshold * 0.66);
  const tone = waited >= threshold ? "text-bad border-bad/60 bg-bad/15" : waited >= amberAt ? "text-warn border-warn/50 bg-warn/10" : "text-ok border-line bg-bg";
  return (
    <div className={`mono rounded-md border px-2 py-1 text-center text-lg font-semibold ${tone}`} role="timer">
      {waited >= threshold ? "Bag waiting " : "Ready "}
      {mmss(waited)}
    </div>
  );
}

export default function PassBoard() {
  const demo = useDemo();
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [bumping, setBumping] = useState("");
  const [now, setNow] = useState(0);
  const [threshold, setThreshold] = useState(180);
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const { alerts, add: addAlert, reload: reloadAlerts } = useAlerts();

  const load = useCallback(async () => {
    try {
      const r = await api<{ orders: Order[] }>("/api/orders?limit=200");
      setOrders(Object.fromEntries(r.orders.map((o) => [o.id, o])));
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      setDetail(await api<OrderDetail>(`/api/orders/${id}`));
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    load();
    setNow(Date.now());
    setThreshold(getStaleThreshold());
    const t = setInterval(() => {
      setNow(Date.now());
      setThreshold(getStaleThreshold());
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setDetail(null);
    if (openId) loadDetail(openId);
  }, [openId, loadDetail]);

  const live = useStream(
    (ev, data) => {
      if (ev === "order.created" || ev === "order.updated") {
        const o = data as Order;
        setOrders((prev) => ({ ...prev, [o.id]: o }));
      } else if (ev === "evidence.created" || ev === "evidence.described") {
        const e = data as Evidence;
        if (ev === "evidence.created") {
          setOrders((prev) => (prev[e.order_id] ? { ...prev, [e.order_id]: { ...prev[e.order_id], evidence_count: prev[e.order_id].evidence_count + 1 } } : prev));
        }
        if (e.order_id === openId) loadDetail(openId);
      } else if (ev === "alert.created") {
        addAlert(data as Alert);
      }
    },
    () => {
      load();
      reloadAlerts();
      if (openId) loadDetail(openId);
    },
  );

  async function bump(o: Order) {
    const next = NEXT[o.status];
    if (!next) return;
    setBumping(o.id);
    try {
      const updated = await api<Order>(`/api/orders/${o.id}/status`, { body: { status: next } });
      setOrders((prev) => ({ ...prev, [updated.id]: updated }));
      setError("");
    } catch (e) {
      setError(`Couldn't move #${o.ticket_no}: ${errText(e)}`);
      load();
    } finally {
      setBumping("");
    }
  }

  const all = Object.values(orders);
  const byStatus = (s: OrderStatus) => {
    const rows = all.filter((o) => o.status === s);
    if (s === "handed_off") return rows.sort((a, b) => (b.handed_off_at || "").localeCompare(a.handed_off_at || ""));
    if (s === "ready") return rows.sort((a, b) => (a.ready_at || "").localeCompare(b.ready_at || ""));
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  };
  const open = openId ? orders[openId] : undefined;

  return (
    <Shell live={live} demo={demo}>
      {demo && <DemoBar orders={all} onSeeded={() => { load(); reloadAlerts(); }} onThreshold={setThreshold} />}
      <div className="flex flex-1 flex-col gap-5 p-5 lg:flex-row">
        <main className="min-w-0 flex-1">
          {error && <div className="note-err mb-4" role="alert">{error}</div>}
          {!loaded ? (
            <p className="text-mute">Loading the pass…</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {COLUMNS.map((s) => {
                const rows = byStatus(s);
                const shown = s === "handed_off" ? rows.slice(0, HANDED_OFF_SHOWN) : rows;
                return (
                  <section key={s} aria-label={STATUS_LABEL[s]}>
                    <h2 className="mb-3 flex items-baseline justify-between border-b border-line pb-2 text-lg">
                      {STATUS_LABEL[s]} <span className="mono text-sm text-mute">{rows.length}</span>
                    </h2>
                    <div className="space-y-3">
                      {rows.length === 0 && <p className="text-sm text-mute">{all.length === 0 && s === "new" ? "No orders yet." : "Nothing here."}</p>}
                      {shown.map((o) => (
                        <article key={o.id} className={`card p-3 ${openId === o.id ? "border-gold" : ""}`}>
                          <button className="block w-full cursor-pointer text-left" onClick={() => setOpenId(openId === o.id ? "" : o.id)} aria-expanded={openId === o.id} title="Show this order's frames">
                            <div className="flex items-center gap-2">
                              <span className="mono text-2xl font-bold">#{o.ticket_no}</span>
                              <span className={chipClass(o.channel)}>{CHANNEL_LABEL[o.channel] || o.channel}</span>
                              {o.evidence_count > 0 && (
                                <span className="ml-auto flex items-center gap-1 text-sm text-ok" title={`${o.evidence_count} frame(s) on record`}>
                                  <span aria-hidden>📷</span>
                                  <span className="dot" />
                                  <span className="sr-only">{o.evidence_count} frames on record</span>
                                </span>
                              )}
                            </div>
                            <div className="label mt-1">Station {o.station}</div>
                            <div className="mt-1 text-sm text-ink/90">{itemSummary(o.items)}</div>
                          </button>
                          {s === "ready" && o.ready_at && (
                            <div className="mt-2">
                              <ReadyTimer readyAt={o.ready_at} now={now} threshold={threshold} />
                            </div>
                          )}
                          {NEXT[s] && (
                            <button className={`btn mt-3 w-full ${s === "ready" ? "btn-ok" : "btn-gold"}`} style={{ minHeight: 56, fontSize: 18 }} onClick={() => bump(o)} disabled={bumping === o.id}>
                              {bumping === o.id ? "…" : STATUS_LABEL[NEXT[s]!]}
                            </button>
                          )}
                        </article>
                      ))}
                      {rows.length > shown.length && <p className="label">+ {rows.length - shown.length} earlier</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {open && (
            <section className="card mt-6 p-4" aria-label={`Order ${open.ticket_no} record`}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg">
                  #{open.ticket_no} on the record
                </h2>
                <span className="chip">{STATUS_LABEL[open.status]}</span>
                <button className="btn btn-sm ml-auto" onClick={() => setOpenId("")}>Close</button>
              </div>
              {detail && detail.order.id === open.id ? <Frames evidence={detail.evidence} /> : <p className="text-sm text-mute">Loading frames…</p>}
            </section>
          )}
        </main>
        {demo && <PhoneMockup alerts={alerts} />}
      </div>
    </Shell>
  );
}
