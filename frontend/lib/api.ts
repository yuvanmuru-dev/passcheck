import type { Alert, DisputeDecision, ErrorCharge, InboxCharge, Insight, Order, OrderDetail, OrderStatus, SimulatedCharge, Stats } from "./types";
import * as mock from "./mocks/store";

const configuredBase = process.env.NEXT_PUBLIC_API_BASE?.trim();
export const API_BASE = (configuredBase || "http://localhost:8000").replace(/\/$/, "");
export const USE_MOCKS = !configuredBase;

export const events = [
  "order.created", "order.updated", "evidence.created", "evidence.described",
  "charge.created", "decision.created", "alert.created", "insight.created", "refresh",
] as const;
export type DataEvent = typeof events[number];

export function managerPin(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem("passcheck-manager-pin") ?? "";
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: { method?: "POST"; body?: unknown; manager?: boolean; local?: boolean } = {}): Promise<T> {
  const headers = new Headers();
  if (options.manager) headers.set("X-Manager-Pin", managerPin());
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(options.local ? path : API_BASE + path, {
    method: options.method, headers, cache: "no-store", signal: AbortSignal.timeout(25000),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.message ?? `Request failed (${response.status}).`, response.status);
  return payload as T;
}

async function managerMock<T>(read: () => T): Promise<T> {
  if (managerPin() !== "4242") throw new ApiError("Enter the manager PIN.", 403);
  return read();
}

export const api = {
  orders: async () => USE_MOCKS ? mock.listOrders() : (await request<{ orders: Order[] }>("/api/orders?limit=50")).orders,
  order: async (id: string) => USE_MOCKS ? mock.getOrder(id) : request<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`),
  bump: async (id: string, status: OrderStatus) => USE_MOCKS ? mock.bump(id, status) : request<Order>(`/api/orders/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } }),
  charges: async () => USE_MOCKS ? managerMock(mock.listCharges) : (await request<{ charges: InboxCharge[] }>("/api/charges", { manager: true })).charges,
  analyze: async (id: string) => USE_MOCKS ? managerMock(() => mock.analyze(id)) : request<DisputeDecision>(`/api/charges/${encodeURIComponent(id)}/analyze`, { method: "POST", manager: true }),
  approve: async (id: string, action: "disputed" | "accepted", final_text: string) => USE_MOCKS ? managerMock(() => mock.approve(id, action, final_text)) : request<DisputeDecision>(`/api/charges/${encodeURIComponent(id)}/approve`, { method: "POST", manager: true, body: { action, final_text } }),
  alerts: async () => USE_MOCKS ? mock.listAlerts() : (await request<{ alerts: Alert[] }>("/api/alerts")).alerts,
  ack: async (id: string) => USE_MOCKS ? mock.ack(id) : request<Alert>(`/api/alerts/${encodeURIComponent(id)}/ack`, { method: "POST" }),
  insights: async () => USE_MOCKS ? managerMock(mock.listInsights) : (await request<{ insights: Insight[] }>("/api/insights", { manager: true })).insights,
  stats: async () => USE_MOCKS ? managerMock(mock.stats) : request<Stats>("/api/stats", { manager: true }),
  runInsights: async (window_start: string, window_end: string) => USE_MOCKS ? managerMock(() => mock.runInsights(window_start, window_end)) : request<Insight>("/api/insights/run", { method: "POST", manager: true, body: { window_start, window_end } }),
  seed: async () => USE_MOCKS ? mock.seed() : request<{ orders: number; evidence: number; charges: number }>("/api/demo/seed", { method: "POST" }),
  simulate: async (body: SimulatedCharge) => USE_MOCKS ? mock.simulate(body) : request<ErrorCharge>("/api/demo/simulate-charge", { method: "POST", body }),
  demoConfig: async (stale_threshold_s: number) => USE_MOCKS ? mock.config(stale_threshold_s) : request<{ stale_threshold_s: number }>("/api/demo/config", { method: "POST", body: { stale_threshold_s } }),
  newOrder: async () => USE_MOCKS ? mock.newOrder() : request<Order>("/api/demo/new-order", { method: "POST", local: true }),
};
