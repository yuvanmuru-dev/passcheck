import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const unavailable = { sent: false, via: "none" } as const;
const timeoutMs = 3000;
const digest = (key: string) => createHash("sha256").update(key).digest();

async function sendPhoton(text: string) {
  const { PHOTON_PROJECT_ID: projectId, PHOTON_API_KEY: projectSecret, PHOTON_TO: recipient } = process.env;
  if (!projectId || !projectSecret || !recipient) return false;
  const signal = AbortSignal.timeout(timeoutMs);
  const work = async () => {
    const [{ Spectrum }, { imessage }] = await Promise.all([
      import("spectrum-ts"), import("spectrum-ts/providers/imessage"),
    ]);
    signal.throwIfAborted();
    const app = await Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
    try {
      signal.throwIfAborted();
      const provider = imessage(app);
      const user = await provider.user(recipient);
      signal.throwIfAborted();
      const chat = await provider.space.create(user);
      signal.throwIfAborted();
      await chat.send(text);
      return true;
    } finally {
      void app.stop().catch(() => {});
    }
  };

  return Promise.race([
    work().catch(() => false),
    new Promise<false>(resolve => signal.addEventListener("abort", () => resolve(false), { once: true })),
  ]);
}

async function sendTelegram(text: string) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat_id } = process.env;
  if (!token || !chat_id) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text }), signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok && (await response.json()).ok === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const key = process.env.NOTIFY_KEY;
    const provided = request.headers.get("X-Notify-Key");
    if (!key || !provided || !timingSafeEqual(digest(key), digest(provided))) {
      return Response.json(unavailable, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return Response.json(unavailable, { status: 400 });
    if (await sendPhoton(text)) return Response.json({ sent: true, via: "photon" });
    if (await sendTelegram(text)) return Response.json({ sent: true, via: "telegram" });
    return Response.json(unavailable);
  } catch {
    return Response.json(unavailable);
  }
}
