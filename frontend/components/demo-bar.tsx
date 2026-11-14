"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/constants";
import { signalRefresh } from "@/lib/stream";
import type { Order, Platform } from "@/lib/types";

export function DemoBar({ orders, threshold, onThreshold }: { orders: Order[]; threshold: number; onThreshold: (seconds: number) => void }) {
  const [ticket, setTicket] = useState("");
  const [itemIndex, setItemIndex] = useState(0);
  const [platform, setPlatform] = useState<Platform>("doordash");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [failed, setFailed] = useState(false);
  const selected = orders.find(order => order.id === ticket) ?? orders.find(order => order.ticket_no === 139) ?? orders[0];
  const item = selected?.items[itemIndex] ?? selected?.items[0];

  async function act(work: () => Promise<string>) {
    setBusy(true);
    setFailed(false);
    setResult("");
    try {
      setResult(await work());
      signalRefresh();
    } catch (error) {
      setFailed(true);
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="demo-bar" aria-label="Demo controls">
    <div className="demo-actions">
      <button disabled={busy} onClick={() => act(async () => `Loaded ${(await api.seed()).orders} orders.`)}>Seed week</button>
      <button disabled={busy} onClick={() => act(async () => {
        const result = await api.demoConfig(threshold === 30 ? 180 : 30);
        onThreshold(result.stale_threshold_s);
        return `Stale threshold set to ${result.stale_threshold_s} s.`;
      })}>Stale threshold: {threshold} s</button>
      <button disabled={busy} onClick={() => act(async () => `Added order #${(await api.newOrder()).ticket_no}.`)}>New order</button>
    </div>
    <form className="demo-actions" onSubmit={event => {
      event.preventDefault();
      if (selected && item) void act(async () => {
        await api.simulate({ ticket_no: selected.ticket_no, items: [{ name: item.name, qty: 1 }], amount: item.price, reason: "missing_item", platform });
        return `Charge added to #${selected.ticket_no}.`;
      });
    }}>
      <select aria-label="Ticket for charge" value={selected?.id ?? ""} onChange={event => { setTicket(event.target.value); setItemIndex(0); }}>
        {orders.map(order => <option key={order.id} value={order.id}>#{order.ticket_no}</option>)}
      </select>
      <select aria-label="Charged item" value={selected?.items[itemIndex] ? itemIndex : 0} onChange={event => setItemIndex(Number(event.target.value))}>
        {selected?.items.map((item, index) => <option value={index} key={index}>{item.name}</option>)}
      </select>
      <select aria-label="Charge platform" value={platform} onChange={event => setPlatform(event.target.value as Platform)}>
        <option value="doordash">DoorDash</option><option value="ubereats">Uber Eats</option>
      </select>
      <button disabled={busy || !item}>Simulate charge</button>
    </form>
    {result && <p className={failed ? "red" : "green"} role={failed ? "alert" : "status"}>{result}</p>}
  </section>;
}
