"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errorMessage, time } from "@/lib/constants";
import { signalRefresh, useFeed } from "@/lib/stream";
import { LoadState } from "./ui";

export function Phone() {
  const { data, error, refresh } = useFeed(api.alerts, ["alert.created"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const alerts = (data ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function acknowledge(id: string) {
    setBusy(id);
    setFailure("");
    try {
      await api.ack(id);
      signalRefresh();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <aside className="phone" aria-label="Phone alerts">
    <h2>Phone alerts</h2>
    {(!data || error) && <LoadState error={error} refresh={refresh} label="Loading alerts…" />}
    {data && alerts.length === 0 && <p className="empty">No alerts yet.</p>}
    <div className="phone-thread" aria-live="polite">
      {alerts.map(alert => <article id={alert.id} className={`bubble ${alert.severity === "high" && !alert.acked_at ? "buzz" : ""}`} key={alert.id}>
        <p>{alert.message}</p>
        <small>{time(alert.created_at)}</small>
        {alert.acked_at ? <small> Acknowledged</small> : <button disabled={busy !== null} onClick={() => acknowledge(alert.id)}>{busy === alert.id ? "Saving…" : "Ack"}</button>}
      </article>)}
    </div>
    {failure && <p className="red" role="alert">{failure}</p>}
  </aside>;
}
