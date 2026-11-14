"use client";

import { useEffect, useRef } from "react";
import { clock } from "@/lib/format";
import type { Alert } from "@/lib/types";

const TONE: Record<Alert["severity"], string> = {
  high: "border-bad/60 bg-bad/15",
  med: "border-warn/50 bg-warn/10",
  low: "border-line bg-card",
};

/** Message-style thread of manager alerts. Model/alert text is rendered as plain text only. */
export default function PhoneMockup({ alerts }: { alerts: Alert[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [alerts.length]);

  return (
    <aside className="w-full shrink-0 lg:w-[300px]" aria-label="Manager phone alerts">
      <div className="mx-auto flex h-[560px] max-w-[300px] flex-col rounded-[34px] border-2 border-line bg-[#0e130f] p-3">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-line" />
        <div className="border-b border-line pb-2 text-center">
          <div className="head text-sm">PassCheck Alerts</div>
          <div className="label">Manager&apos;s phone</div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto py-3" aria-live="polite">
          {alerts.length === 0 && (
            <p className="px-3 pt-10 text-center text-sm text-mute">No alerts yet. A bag left waiting will show up here.</p>
          )}
          {alerts.map((a) => (
            <div key={a.id} className={`mr-6 rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${TONE[a.severity] || TONE.low}`}>
              <div>{a.message}</div>
              <div className="label mt-1">{clock(a.created_at)}</div>
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
    </aside>
  );
}
