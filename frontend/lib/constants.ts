import type { Channel, ChargeReason, OrderStatus } from "./types";

export const stages: OrderStatus[] = ["new", "packing", "ready", "handed_off"];
export const statusLabel: Record<OrderStatus, string> = { new: "New", packing: "Packing", ready: "Ready", handed_off: "Handed off" };
export const channelLabel: Record<Channel, string> = { doordash: "DoorDash", ubereats: "Uber Eats", takeout: "Takeout", dine_in: "Dine-in", drive_thru: "Drive-thru" };
export const reasonLabel: Record<ChargeReason, string> = { missing_item: "Missing item", wrong_item: "Wrong item", cold_food: "Cold food", other: "Other" };
export const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
export const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
