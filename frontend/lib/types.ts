// Shapes copied from contracts/api.md §2. Do not rename fields.

export type Channel = "dine_in" | "takeout" | "doordash" | "ubereats" | "drive_thru";
export type OrderStatus = "new" | "packing" | "ready" | "handed_off";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  modifiers: string[];
}

export interface Order {
  id: string;
  ticket_no: number;
  external_id: string;
  channel: Channel;
  station: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  created_at: string;
  packing_at: string | null;
  ready_at: string | null;
  handed_off_at: string | null;
  evidence_count: number;
}

export interface EvidenceDescription {
  visible_items: { name: string; qty: number }[];
  visibility: "clear" | "partial" | "blocked";
  notes: string;
  confidence: number;
}

export interface Evidence {
  id: string;
  order_id: string;
  kind: "packing" | "ready" | "handed_off";
  image_url: string;
  captured_at: string;
  sha256: string;
  source: "webcam" | "video" | "upload" | "seed";
  description: EvidenceDescription | null;
}

export type Platform = "doordash" | "ubereats";
export type ChargeReason = "missing_item" | "wrong_item" | "cold_food" | "other";
export type ChargeStatus = "new" | "analyzed" | "disputed" | "accepted";

export interface ErrorCharge {
  id: string;
  order_id: string;
  platform: Platform;
  reason: ChargeReason;
  items: { name: string; qty: number }[];
  amount: number;
  customer_note: string;
  charged_at: string;
  dispute_deadline: string;
  status: ChargeStatus;
}

export type Recommendation = "DISPUTE" | "ACCEPT" | "NEEDS_REVIEW";

export interface DisputeDecision {
  id: string;
  charge_id: string;
  recommendation: Recommendation;
  confidence: number;
  rationale: string;
  evidence_ids: string[];
  draft_text: string;
  created_at: string;
  approved_action: null | "disputed" | "accepted";
  approved_at: string | null;
}

export interface ChargeRow extends ErrorCharge {
  order: Order | null;
  decision: DisputeDecision | null;
}

export interface Alert {
  id: string;
  type: "stale_handoff" | "charge_received" | "decision_ready" | "insight_ready";
  severity: "low" | "med" | "high";
  order_id: string | null;
  message: string;
  created_at: string;
  acked_at: string | null;
}

export interface Insight {
  id: string;
  window_start: string;
  window_end: string;
  cause: string;
  confidence: number;
  reasoning: string;
  evidence: { charge_ids: string[]; order_ids: string[]; alert_ids: string[] };
  recommendations: { priority: number; action: string; est_impact: string }[];
  created_at: string;
}

export interface Stats {
  charges_total_usd: number;
  disputed_usd: number;
  accepted_usd: number;
  pending_usd: number;
  avg_handoff_s: number;
  stale_count_today: number;
  top_cause: string;
}

export interface OrderDetail {
  order: Order;
  evidence: Evidence[];
  charges: ErrorCharge[];
  decisions: DisputeDecision[];
}
