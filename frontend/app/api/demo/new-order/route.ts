import { createHmac, randomInt, randomUUID } from "node:crypto";
import type { PosOrder } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: { message: "Set WEBHOOK_SECRET to enable demo orders." } }, { status: 503 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: { message: "Demo orders must come from this dashboard." } }, { status: 403 });
  }

  const base = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");
  const channels = ["doordash", "ubereats", "takeout"] as const;
  const payload: PosOrder = {
    external_id: `demo_${randomUUID()}`,
    ticket_no: randomInt(300, 1000000),
    channel: channels[randomInt(channels.length)], station: randomInt(1, 4),
    items: [
      { name: "Cheeseburger", qty: randomInt(1, 3), price: 6.49, modifiers: [] },
      { name: "Fries", qty: 1, price: 3.99, modifiers: [] },
    ],
    created_at: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  try {
    const response = await fetch(base + "/api/pos/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": createHmac("sha256", secret).update(body).digest("hex") },
      body, signal: AbortSignal.timeout(5000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ error: { message: "Couldn’t reach the POS webhook." } }, { status: 502 });
  }
}
