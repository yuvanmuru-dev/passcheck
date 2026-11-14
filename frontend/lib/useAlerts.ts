"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Alert } from "./types";

const MAX = 30;

/** Alerts oldest → newest. `add` takes an SSE alert.created payload; `reload` is the polling fallback. */
export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ alerts: Alert[] }>("/api/alerts");
      setAlerts([...r.alerts].reverse().slice(-MAX));
    } catch {
      /* the page shows its own backend error */
    }
  }, []);

  const add = useCallback((a: Alert) => {
    setAlerts((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a].slice(-MAX)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { alerts, add, reload };
}
