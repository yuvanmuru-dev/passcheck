"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE, events, USE_MOCKS, type DataEvent } from "./api";
import { errorMessage } from "./constants";

export function useFeed<T>(load: () => Promise<T>, topics: readonly DataEvent[]) {
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: "" });
  const [mode, setMode] = useState(USE_MOCKS ? "Demo" : "Connecting");
  const refreshRef = useRef<() => void>(() => {});
  const topicKey = topics.join(",");

  useEffect(() => {
    let active = true;
    let pending = false;
    let refreshQueued = false;
    let interval: number | undefined;
    const refresh = async () => {
      if (pending) {
        refreshQueued = true;
        return;
      }
      pending = true;
      try {
        const data = await load();
        if (active) setState({ data, error: "" });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, error: errorMessage(error) }));
      } finally {
        pending = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };
    const poll = () => { interval ??= window.setInterval(refresh, 2000); };
    const stopPolling = () => { window.clearInterval(interval); interval = undefined; };
    refreshRef.current = refresh;
    window.addEventListener("passcheck-data", refresh);
    void refresh();

    const stream = USE_MOCKS ? null : new EventSource(API_BASE + "/api/stream");
    poll();
    if (stream) {
      for (const event of events) {
        if (topicKey.split(",").includes(event)) stream.addEventListener(event, refresh);
      }
      stream.onopen = () => { stopPolling(); setMode("Live"); void refresh(); };
      stream.onerror = () => { setMode("Polling"); poll(); };
    }

    return () => {
      active = false;
      stopPolling();
      stream?.close();
      window.removeEventListener("passcheck-data", refresh);
    };
  }, [load, topicKey]);

  return { ...state, mode, refresh: () => refreshRef.current() };
}

export function signalRefresh() {
  window.dispatchEvent(new Event("passcheck-data"));
}
