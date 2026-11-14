"use client";
// One shared EventSource per tab (browsers cap connections per host, and the
// demo keeps three tabs open). While SSE is not connected, subscribers are
// polled every 2 seconds instead.

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "./api";

export const EVENTS = [
  "order.created",
  "order.updated",
  "evidence.created",
  "evidence.described",
  "charge.created",
  "decision.created",
  "alert.created",
  "insight.created",
] as const;
export type StreamEvent = (typeof EVENTS)[number];

type Handler = (event: StreamEvent, data: unknown) => void;

const subs = new Set<Handler>();
let es: EventSource | null = null;

function ensure() {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return;
  if (es && es.readyState !== EventSource.CLOSED) return;
  es?.close();
  const source = new EventSource(API_BASE + "/api/stream");
  for (const name of EVENTS) {
    source.addEventListener(name, (e) => {
      let data: unknown;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        return;
      }
      subs.forEach((h) => h(name, data));
    });
  }
  es = source;
}

function isLive() {
  return !!es && es.readyState === EventSource.OPEN;
}

/** Subscribe to SSE events. `poll` runs every 2 s while the stream is down, and once on reconnect. */
export function useStream(onEvent: Handler, poll?: () => void): boolean {
  const [live, setLive] = useState(false);
  const onEventRef = useRef(onEvent);
  const pollRef = useRef(poll);
  useEffect(() => {
    onEventRef.current = onEvent;
    pollRef.current = poll;
  });

  useEffect(() => {
    const handler: Handler = (ev, data) => onEventRef.current(ev, data);
    subs.add(handler);
    ensure();
    let wasLive = true; // first load is done by the page itself
    const tick = () => {
      ensure();
      const now = isLive();
      setLive(now);
      if (!now || !wasLive) pollRef.current?.();
      wasLive = now;
    };
    const first = setTimeout(() => setLive(isLive()), 400);
    const timer = setInterval(tick, 2000);
    return () => {
      subs.delete(handler);
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return live;
}
