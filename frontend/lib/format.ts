import type { Channel, ChargeReason, OrderStatus, Platform } from "./types";

export const CHANNEL_LABEL: Record<Channel, string> = {
  dine_in: "Dine in",
  takeout: "Takeout",
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  drive_thru: "Drive-thru",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  packing: "Packing",
  ready: "Ready",
  handed_off: "Handed off",
};

export const REASON_LABEL: Record<ChargeReason, string> = {
  missing_item: "Missing",
  wrong_item: "Wrong item",
  cold_food: "Cold food",
  other: "Other",
};

export function chipClass(channel: Channel | Platform): string {
  if (channel === "doordash") return "chip chip-dd";
  if (channel === "ubereats") return "chip chip-ue";
  return "chip";
}

export function usd(n: number): string {
  return "$" + (Number(n) || 0).toFixed(2);
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function dayAndTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function daysLeft(deadlineIso: string, now: number): number {
  return Math.ceil((new Date(deadlineIso).getTime() - now) / 86_400_000);
}

export function itemSummary(items: { name: string; qty: number }[]): string {
  return items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(", ");
}
