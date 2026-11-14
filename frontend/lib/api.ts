// Fetch helper for the PassCheck backend. The manager PIN lives in localStorage
// (typed by the manager, never baked into the bundle) and is sent as X-Manager-Pin.

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

const PIN_KEY = "passcheck_manager_pin";
const STALE_KEY = "passcheck_stale_threshold_s";
export const DEFAULT_STALE_S = 180;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getPin(): string {
  return store()?.getItem(PIN_KEY) || "";
}
export function setPin(pin: string) {
  if (pin) store()?.setItem(PIN_KEY, pin);
  else store()?.removeItem(PIN_KEY);
}

export function getStaleThreshold(): number {
  const n = Number(store()?.getItem(STALE_KEY));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_S;
}
export function setStaleThreshold(s: number) {
  store()?.setItem(STALE_KEY, String(s));
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const pin = getPin();
  if (pin) headers["X-Manager-Pin"] = pin;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the PassCheck backend. Is it running on port 8000?");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code || "error", e?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function imageUrl(image_url: string): string {
  return API_BASE + image_url;
}
