"use client";

import { imageUrl } from "@/lib/api";
import { clock, itemSummary } from "@/lib/format";
import type { Evidence } from "@/lib/types";

const KIND: Record<Evidence["kind"], string> = { packing: "Packing", ready: "Ready", handed_off: "Handed off" };
const ORDER: Evidence["kind"][] = ["packing", "ready", "handed_off"];

/** Evidence frames for one order. Descriptions come from the vision model and are shown as plain text. */
export default function Frames({ evidence, cited = [] }: { evidence: Evidence[]; cited?: string[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-mute">No frames on record for this order.</p>;
  }
  const sorted = [...evidence].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.captured_at.localeCompare(b.captured_at),
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((e) => {
        const isCited = cited.includes(e.id);
        return (
          <figure key={e.id} className={`card overflow-hidden ${isCited ? "border-gold" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(e.image_url)} alt={`${KIND[e.kind]} frame at ${clock(e.captured_at)}`} className="aspect-[4/3] w-full bg-black/40 object-cover" />
            <figcaption className="space-y-1.5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{KIND[e.kind]}</span>
                <span className="mono text-xs text-mute">{clock(e.captured_at)}</span>
                {isCited && <span className="chip chip-gold">Cited</span>}
              </div>
              <div className="mono text-[11px] text-mute" title={`SHA-256 ${e.sha256}`}>
                sha {e.sha256.slice(0, 8)} · {e.source}
              </div>
              {e.description ? (
                <>
                  <div>
                    <span className="text-mute">Visible: </span>
                    {e.description.visible_items.length ? itemSummary(e.description.visible_items) : "nothing identified"}
                  </div>
                  <div className="text-mute">{e.description.notes}</div>
                  <div className="label">
                    View {e.description.visibility} · {Math.round(e.description.confidence * 100)}% sure
                  </div>
                </>
              ) : e.kind === "packing" ? (
                <div className="text-mute">Reading the frame…</div>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
