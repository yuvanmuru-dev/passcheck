import type { ReactNode } from "react";
import { channelLabel } from "@/lib/constants";
import type { Channel } from "@/lib/types";

export function ChannelChip({ channel }: { channel: Channel }) {
  return <span className={`chip channel-${channel}`}>{channelLabel[channel]}</span>;
}

export function LivePill({ mode }: { mode: string }) {
  return <span className={`chip live live-${mode.toLowerCase()}`}><span aria-hidden="true">●</span> {mode}</span>;
}

export function ScreenHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="screen-header"><h1>{title}</h1>{children}</div>;
}

export function LoadState({ error, refresh, label = "Loading…" }: { error: string; refresh: () => void; label?: string }) {
  return error ? <div className="notice" role="alert"><span>{error}</span><button onClick={refresh}>Retry</button></div> : <p className="empty" role="status">{label}</p>;
}
