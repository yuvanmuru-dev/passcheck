"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";
import { stages, statusLabel, time } from "@/lib/constants";
import type { Evidence } from "@/lib/types";

function FrameImage({ frame }: { frame: Evidence }) {
  const [failed, setFailed] = useState(false);
  if (!frame.image_url || failed) return <div className="frame-placeholder">{failed ? "Image unavailable" : "Sample frame · no photo"}</div>;
  return (
    // The backend serves frame bytes from the configured API origin.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="frame-image" src={API_BASE + frame.image_url} loading="lazy" alt={`${statusLabel[frame.kind]} frame`} onError={() => setFailed(true)} />
  );
}

export function EvidenceTimeline({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return <p className="empty">No frames captured yet.</p>;
  const ordered = evidence.slice().sort((a, b) => stages.indexOf(a.kind) - stages.indexOf(b.kind) || a.captured_at.localeCompare(b.captured_at));
  return <ol className="timeline">
    {ordered.map(frame => <li className="panel frame stack" key={frame.id} id={frame.id}>
      <div className="row spread"><h3>{statusLabel[frame.kind]}</h3><time dateTime={frame.captured_at} className="muted">{time(frame.captured_at)}</time></div>
      <FrameImage key={frame.image_url} frame={frame} />
      <div className="row spread"><code title={frame.sha256}>SHA-256 <span>{frame.sha256.slice(0, 8)}</span></code>{frame.description && <span className="chip">{frame.description.visibility}</span>}</div>
      {frame.description ? <>
        <p>{frame.description.notes}</p>
        {frame.description.visible_items.length > 0 && <p className="muted">Visible: {frame.description.visible_items.map(item => `${item.qty} × ${item.name}`).join(", ")}</p>}
      </> : <div className="description-pending"><span className="skeleton" aria-hidden="true" /><p className="muted">Description pending</p></div>}
    </li>)}
  </ol>;
}
