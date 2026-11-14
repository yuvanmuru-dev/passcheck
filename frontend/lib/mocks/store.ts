import { charges as sampleCharges, evidence as sampleEvidence, orders as sampleOrders } from "./fixtures";
import { duration, stages } from "../constants";
import type { Alert, DisputeDecision, ErrorCharge, Insight, Order, OrderStatus, SimulatedCharge } from "../types";

const now = () => new Date().toISOString();
const unique = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

function initialData() {
  const evidence = structuredClone(sampleEvidence);
  return {
    orders: structuredClone(sampleOrders).map(order => ({
      ...order, evidence_count: evidence.filter(frame => frame.order_id === order.id).length,
    })),
    evidence, charges: structuredClone(sampleCharges),
    decisions: [] as DisputeDecision[], alerts: [] as Alert[], insights: [] as Insight[], threshold: 180,
  };
}

let data = initialData();

function read(): typeof data {
  const saved = typeof window === "undefined" ? null : sessionStorage.getItem("passcheck-mock-v1");
  if (saved) data = JSON.parse(saved);
  return data;
}

function save() {
  sessionStorage.setItem("passcheck-mock-v1", JSON.stringify(data));
  window.dispatchEvent(new Event("passcheck-data"));
}

function alert(type: Alert["type"], severity: Alert["severity"], message: string, order_id: string | null) {
  data.alerts.push({ id: unique("alt"), type, severity, message, order_id, created_at: now(), acked_at: null });
}

export function listOrders() {
  return read().orders;
}

export function getOrder(id: string) {
  const { orders, charges, evidence, decisions } = read();
  const order = orders.find(row => row.id === id);
  if (!order) throw new Error("Order not found.");
  const orderCharges = charges.filter(charge => charge.order_id === order.id);
  return {
    order, charges: orderCharges, evidence: evidence.filter(frame => frame.order_id === id),
    decisions: decisions.filter(decision => orderCharges.some(charge => charge.id === decision.charge_id)),
  };
}

export function bump(id: string, status: OrderStatus) {
  const { order } = getOrder(id);
  if (status === "new" || stages[stages.indexOf(order.status) + 1] !== status) throw new Error("The order has already moved.");
  const captured_at = now();
  order.status = status;
  order[`${status}_at`] = captured_at;
  order.evidence_count++;
  data.evidence.push({
    id: unique("ev"), order_id: id, kind: status, image_url: "", captured_at,
    sha256: "9b1d06c2e74a", source: "seed", description: {
      visible_items: order.items.map(({ name, qty }) => ({ name, qty })),
      notes: "Sample frame description for this order.", confidence: 0.84, visibility: "clear",
    },
  });
  save();
  return order;
}

export function listCharges() {
  const { charges, orders, decisions } = read();
  return charges.map(charge => ({
    ...charge, order: orders.find(order => order.id === charge.order_id)!,
    decision: decisions.find(decision => decision.charge_id === charge.id) ?? null,
  }));
}

export function analyze(id: string) {
  const charge = listCharges().find(row => row.id === id);
  if (!charge) throw new Error("Charge not found.");
  if (charge.decision) return charge.decision;
  const packing = data.evidence.find(frame => frame.order_id === charge.order_id && frame.kind === "packing");
  const description = packing?.description;
  const sufficient = description && description.confidence >= 0.6;
  const visible = sufficient && charge.items.every(item => description.visible_items.some(row => row.name === item.name && row.qty >= item.qty));
  const recommendation = sufficient ? (visible ? "DISPUTE" : "ACCEPT") : "NEEDS_REVIEW";
  const decision: DisputeDecision = {
    id: unique("dec"), charge_id: id, recommendation, confidence: sufficient ? 0.81 : 0.3,
    rationale: sufficient ? description.notes : "There is no clear packing frame to verify the charged items.",
    evidence_ids: packing ? [packing.id] : [],
    draft_text: visible ? `The packing frame for order #${charge.order.ticket_no} shows ${charge.items.map(item => `${item.qty} × ${item.name}`).join(", ")} before the bag was sealed. Please review the charge.` : "",
    created_at: now(), approved_action: null, approved_at: null,
  };
  data.decisions.push(decision);
  data.charges.find(row => row.id === id)!.status = "analyzed";
  alert("decision_ready", "low", `Recommendation ready for #${charge.order.ticket_no}.`, charge.order_id);
  save();
  return decision;
}

export function approve(id: string, action: "disputed" | "accepted", finalText: string) {
  const charge = listCharges().find(row => row.id === id);
  if (!charge?.decision || charge.decision.approved_action) throw new Error("This charge cannot be approved.");
  charge.decision.approved_action = action;
  charge.decision.approved_at = now();
  charge.decision.draft_text = finalText;
  data.charges.find(row => row.id === id)!.status = action;
  save();
  return charge.decision;
}

function trackStale() {
  let changed = false;
  for (const order of data.orders) {
    if (order.status !== "ready" || !order.ready_at) continue;
    const seconds = Math.floor((Date.now() - Date.parse(order.ready_at)) / 1000);
    if (seconds < data.threshold || data.alerts.some(row => row.type === "stale_handoff" && row.order_id === order.id)) continue;
    alert("stale_handoff", "high", `Bag #${order.ticket_no} has been waiting ${duration(seconds)}.`, order.id);
    changed = true;
  }
  if (changed) save();
}

export function listAlerts() {
  read();
  trackStale();
  return data.alerts;
}

export function ack(id: string) {
  const entry = read().alerts.find(row => row.id === id);
  if (!entry) throw new Error("Alert not found.");
  entry.acked_at ??= now();
  save();
  return entry;
}

export function listInsights() {
  return read().insights;
}

export function stats() {
  const { charges, orders, alerts, insights } = read();
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const disputed = charges.filter(row => row.status === "disputed").reduce((sum, row) => sum + row.amount, 0);
  const accepted = charges.filter(row => row.status === "accepted").reduce((sum, row) => sum + row.amount, 0);
  const timings = orders.flatMap(row => row.ready_at && row.handed_off_at ? [(Date.parse(row.handed_off_at) - Date.parse(row.ready_at)) / 1000] : []);
  return {
    charges_total_usd: total, disputed_usd: disputed, accepted_usd: accepted, pending_usd: total - disputed - accepted,
    avg_handoff_s: timings.length ? Math.round(timings.reduce((sum, seconds) => sum + seconds, 0) / timings.length) : 0,
    stale_count_today: alerts.filter(row => row.type === "stale_handoff" && row.created_at.slice(0, 10) === now().slice(0, 10)).length,
    top_cause: insights[0]?.cause ?? null,
  };
}

export function runInsights(window_start: string, window_end: string) {
  const { charges } = read();
  const fries = charges.filter(charge => charge.charged_at >= window_start && charge.charged_at <= window_end && charge.items.some(item => item.name === "Fries"));
  const result: Insight = {
    id: unique("ins"), window_start, window_end, created_at: now(),
    cause: fries.length ? "Fries missing on delivery orders" : "Insufficient evidence",
    confidence: fries.length ? 0.78 : 0.2,
    reasoning: fries.length ? `${fries.length} charges mention fries in this sample. Compare the affected stations and shifts before changing the packing process.` : "There are no missing-fries charges in this window.",
    evidence: { charge_ids: fries.map(row => row.id), order_ids: [...new Set(fries.map(row => row.order_id))], alert_ids: [] },
    recommendations: fries.length ? [
      { priority: 1, action: "Add a fries checkpoint for delivery bags", est_impact: "Fewer missing-item charges" },
      { priority: 2, action: "Review station coverage during lunch", est_impact: "More time to check each bag" },
      { priority: 3, action: "Keep the bag opening inside the camera frame", est_impact: "Clearer evidence for disputes" },
    ] : [],
  };
  data.insights.unshift(result);
  alert("insight_ready", "low", "Your seven-day review is ready.", null);
  save();
  return result;
}

export function seed() {
  data = initialData();
  save();
  return { orders: data.orders.length, evidence: data.evidence.length, charges: data.charges.length };
}

export function simulate(body: SimulatedCharge) {
  const order = read().orders.find(row => row.ticket_no === body.ticket_no);
  if (!order) throw new Error("Order not found.");
  const { platform, reason, items, amount } = body;
  const charge: ErrorCharge = {
    id: unique("chg"), order_id: order.id, platform, reason, items, amount,
    customer_note: "Simulated charge", charged_at: now(), status: "new",
    dispute_deadline: new Date(Date.now() + (platform === "doordash" ? 14 : 30) * 86400000).toISOString(),
  };
  data.charges.unshift(charge);
  alert("charge_received", "med", `New charge for #${order.ticket_no}.`, order.id);
  save();
  return charge;
}

export function config(stale_threshold_s: number) {
  read().threshold = stale_threshold_s;
  save();
  return { stale_threshold_s };
}

export function newOrder() {
  const orders = read().orders;
  const sample = sampleOrders[Math.floor(Math.random() * sampleOrders.length)];
  const ticket_no = Math.max(...orders.map(row => row.ticket_no), 219) + 1;
  const order: Order = {
    ...sample, id: `ord_${ticket_no}`, ticket_no, external_id: unique("demo"), status: "new",
    created_at: now(), packing_at: null, ready_at: null, handed_off_at: null, evidence_count: 0,
  };
  orders.unshift(order);
  save();
  return order;
}
