"use client";

import { useEffect, useState } from "react";
import { api, errText, setStaleThreshold } from "@/lib/api";
import type { ErrorCharge, Order, Platform } from "@/lib/types";

/** Demo controls, shown only with ?demo=1. Uses the backend's DEMO_MODE endpoints (no secrets here). */
export default function DemoBar({
  orders,
  onSeeded,
  onThreshold,
}: {
  orders: Order[];
  onSeeded: () => void;
  onThreshold: (s: number) => void;
}) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ticket, setTicket] = useState("219");
  const [item, setItem] = useState("Fries");
  const [platform, setPlatform] = useState<Platform>("doordash");
  const [amount, setAmount] = useState("3.99");

  const order = orders.find((o) => String(o.ticket_no) === ticket.trim());
  const itemNames = order ? order.items.map((i) => i.name) : [];
  const itemsKey = itemNames.join("|");

  // Keep the item valid for the chosen ticket, and follow the order's delivery platform.
  useEffect(() => {
    if (!order) return;
    if (order.channel === "doordash" || order.channel === "ubereats") setPlatform(order.channel);
    const names = itemsKey ? itemsKey.split("|") : [];
    if (names.length) setItem((cur) => (names.includes(cur) ? cur : names.includes("Fries") ? "Fries" : names[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, itemsKey]);

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMsg("");
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg("Failed: " + errText(e));
    } finally {
      setBusy("");
    }
  }

  const seed = () =>
    run("seed", async () => {
      const r = await api<{ orders: number; evidence: number; charges: number }>("/api/demo/seed", { method: "POST" });
      onSeeded();
      return `Seeded ${r.orders} orders, ${r.evidence} frames, ${r.charges} charges.`;
    });

  const stale = () =>
    run("stale", async () => {
      const r = await api<{ stale_threshold_s: number }>("/api/demo/config", { body: { stale_threshold_s: 30 } });
      setStaleThreshold(r.stale_threshold_s);
      onThreshold(r.stale_threshold_s);
      return `Bags now count as waiting too long after ${r.stale_threshold_s} s.`;
    });

  const simulate = () =>
    run("charge", async () => {
      const ticketNo = Number(ticket);
      const amt = Number(amount);
      if (!Number.isInteger(ticketNo) || ticketNo <= 0) throw new Error("Enter a ticket number.");
      if (!item.trim()) throw new Error("Pick an item.");
      if (!(amt > 0)) throw new Error("Enter an amount above $0.");
      const c = await api<ErrorCharge>("/api/demo/simulate-charge", {
        body: {
          ticket_no: ticketNo,
          platform,
          reason: "missing_item",
          items: [{ name: item.trim(), qty: 1 }],
          amount: amt,
          customer_note: `No ${item.trim().toLowerCase()} in the bag`,
        },
      });
      return `Charge of $${c.amount.toFixed(2)} sent for #${ticketNo}. See Disputes.`;
    });

  return (
    <section className="flex flex-wrap items-end gap-3 border-b border-gold/40 bg-gold/10 px-5 py-3" aria-label="Demo controls">
      <span className="chip chip-gold self-center">Demo</span>
      <button className="btn btn-sm" onClick={seed} disabled={!!busy}>
        {busy === "seed" ? "Seeding…" : "Seed week"}
      </button>
      <button className="btn btn-sm" onClick={stale} disabled={!!busy}>
        Stale threshold 30 s
      </button>
      <span className="mx-1 hidden h-9 w-px bg-line md:block" />
      <label className="flex flex-col gap-1">
        <span className="label">Ticket #</span>
        <input className="input mono w-20" style={{ minHeight: 36 }} inputMode="numeric" value={ticket} onChange={(e) => setTicket(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Item</span>
        {itemNames.length ? (
          <select className="input w-40" style={{ minHeight: 36 }} value={item} onChange={(e) => setItem(e.target.value)}>
            {itemNames.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        ) : (
          <input className="input w-40" style={{ minHeight: 36 }} value={item} onChange={(e) => setItem(e.target.value)} />
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Platform</span>
        <select className="input" style={{ minHeight: 36 }} value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
          <option value="doordash">DoorDash</option>
          <option value="ubereats">Uber Eats</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Amount $</span>
        <input className="input mono w-20" style={{ minHeight: 36 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <button className="btn btn-sm btn-gold" onClick={simulate} disabled={!!busy}>
        {busy === "charge" ? "Sending…" : "Simulate charge"}
      </button>
      {msg && (
        <span className={`self-center text-sm ${msg.startsWith("Failed") ? "text-bad" : "text-ok"}`} role="status">
          {msg}
        </span>
      )}
    </section>
  );
}
