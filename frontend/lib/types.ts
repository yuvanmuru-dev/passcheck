export type Channel = "dine_in" | "takeout" | "doordash" | "ubereats" | "drive_thru";
export type OrderStatus = "new" | "packing" | "ready" | "handed_off";
export type EvidenceKind = Exclude<OrderStatus, "new">;
export type Platform = Extract<Channel, "doordash" | "ubereats">;
export type ChargeReason = "missing_item" | "wrong_item" | "cold_food" | "other";

export interface Item {
  name: string;
  qty: number;
}

export interface OrderItem extends Item {
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

export interface Evidence {
  id: string;
  order_id: string;
  kind: EvidenceKind;
  image_url: string;
  captured_at: string;
  sha256: string;
  source: "webcam" | "video" | "upload" | "seed";
  description: {
    visible_items: Item[];
    visibility: "clear" | "partial" | "blocked";
    notes: string;
    confidence: number;
  } | null;
}

export interface ErrorCharge {
  id: string;
  order_id: string;
  platform: Platform;
  reason: ChargeReason;
  items: Item[];
  amount: number;
  customer_note: string;
  charged_at: string;
  dispute_deadline: string;
  status: "new" | "analyzed" | "disputed" | "accepted";
}

export interface DisputeDecision {
  id: string;
  charge_id: string;
  recommendation: "DISPUTE" | "ACCEPT" | "NEEDS_REVIEW";
  confidence: number;
  rationale: string;
  evidence_ids: string[];
  draft_text: string;
  created_at: string;
  approved_action: "disputed" | "accepted" | null;
  approved_at: string | null;
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
  top_cause: string | null;
}

export interface OrderDetail {
  order: Order;
  evidence: Evidence[];
  charges: ErrorCharge[];
  decisions: DisputeDecision[];
}

export type InboxCharge = ErrorCharge & { order: Order; decision: DisputeDecision | null };

export interface SimulatedCharge {
  ticket_no: number;
  platform: Platform;
  reason: ChargeReason;
  items: Item[];
  amount: number;
}

export type PosOrder = Pick<Order, "external_id" | "ticket_no" | "channel" | "station" | "items" | "created_at">;
