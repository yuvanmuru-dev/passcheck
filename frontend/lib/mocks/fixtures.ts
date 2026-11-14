import type { ErrorCharge, Evidence, Order, OrderStatus } from "../types";

const reference = Date.now();
export const stamp = (seconds = 0) => new Date(reference + seconds * 1000).toISOString();

const menu = {
  burger: { name: "Cheeseburger", qty: 2, price: 6.49, modifiers: ["no onion"] },
  fries: { name: "Fries", qty: 1, price: 3.99, modifiers: [] },
  coke: { name: "Coke", qty: 1, price: 2.49, modifiers: [] },
};

function order(ticket: number, status: OrderStatus, channel: Order["channel"], station: number, age: number, items: Order["items"]): Order {
  const stage = ["new", "packing", "ready", "handed_off"].indexOf(status);
  return {
    id: `ord_${ticket}`, ticket_no: ticket, external_id: `toast_${ticket}`, channel, station, items,
    total: Number(items.reduce((total, item) => total + item.price * item.qty, 0).toFixed(2)),
    status, created_at: stamp(-age - 150), packing_at: stage >= 1 ? stamp(-age - 45) : null,
    ready_at: stage >= 2 ? stamp(-age) : null, handed_off_at: stage >= 3 ? stamp(-age + 96) : null,
    evidence_count: 0,
  };
}

export const orders = [
  order(219, "new", "doordash", 2, 0, [menu.burger, menu.fries, menu.coke]),
  order(218, "new", "takeout", 1, 15, [menu.burger, menu.coke]),
  order(217, "packing", "ubereats", 3, 35, [menu.burger, menu.fries]),
  order(216, "ready", "takeout", 1, 60, [menu.burger, menu.coke]),
  order(142, "ready", "doordash", 2, 130, [menu.burger, menu.fries, menu.coke]),
  order(139, "handed_off", "doordash", 2, 172800, [menu.burger, menu.fries, menu.coke]),
  order(131, "handed_off", "doordash", 2, 180000, [menu.burger, menu.fries]),
];

export const evidence: Evidence[] = [139, 131, 142].flatMap(ticket =>
  (["packing", "ready", "handed_off"] as const).slice(0, ticket === 142 ? 2 : 3).map((kind, index) => ({
    id: `ev_${ticket.toString(16).padStart(6, "0")}0${index}`, order_id: `ord_${ticket}`, kind,
    image_url: "", captured_at: orders.find(order => order.ticket_no === ticket)![`${kind}_at`]!,
    sha256: "9b1d06c2e74a", source: "seed",
    description: {
      visible_items: ticket === 131 ? [{ name: "Cheeseburger", qty: 2 }] : [{ name: "Cheeseburger", qty: 2 }, { name: "Fries", qty: 1 }],
      visibility: "clear", notes: ticket === 131 ? "Two wrapped burgers. No fries visible." : "Two wrapped burgers and one fries sleeve.",
      confidence: 0.84,
    },
  })),
);

export const charges: ErrorCharge[] = [{
  id: "chg_a1b2c3d4", order_id: "ord_139", platform: "doordash", reason: "missing_item",
  items: [{ name: "Fries", qty: 1 }], amount: 3.99, customer_note: "No fries in the bag",
  charged_at: stamp(-3600), dispute_deadline: stamp(13 * 86400), status: "new",
}, {
  id: "chg_51c0d9e2", order_id: "ord_131", platform: "doordash", reason: "missing_item",
  items: [{ name: "Fries", qty: 1 }], amount: 3.99, customer_note: "My order was missing the fries.",
  charged_at: stamp(-7200), dispute_deadline: stamp(12 * 86400), status: "new",
}];
