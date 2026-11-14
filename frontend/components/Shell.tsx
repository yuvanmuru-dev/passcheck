"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/", label: "Pass Board" },
  { href: "/disputes", label: "Disputes" },
  { href: "/insights", label: "Insights" },
];

/** True when the URL has ?demo=1 (kept across the nav links). */
export function useDemo(): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);
  return demo;
}

export default function Shell({
  live,
  demo,
  children,
}: {
  live: boolean;
  demo: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-bg/80 px-5 py-3">
        <Link href={demo ? "/?demo=1" : "/"} className="head text-2xl font-semibold tracking-wider">
          Pass<span className="text-gold">Check</span>
        </Link>
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={demo ? `${t.href}?demo=1` : t.href}
                aria-current={active ? "page" : undefined}
                className={`head rounded-md px-3 py-2 text-sm ${
                  active ? "bg-card text-gold" : "text-mute hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <span className={`chip ml-auto ${live ? "chip-ue" : "chip-warn"}`} title={live ? "Live updates" : "Refreshing every 2 seconds"}>
          <span className="dot" /> {live ? "Live" : "Polling"}
        </span>
      </header>
      {children}
    </>
  );
}
