"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const pages = [["/", "Pass Board"], ["/disputes", "Disputes"], ["/insights", "Insights"]];

export function useDemo() {
  return useSearchParams().get("demo") === "1";
}

export function Navigation() {
  const demo = useDemo();
  const path = usePathname();
  const suffix = demo ? "?demo=1" : "";
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href={"/" + suffix}><span aria-hidden="true">✓</span> PassCheck</Link>
        <nav aria-label="Main navigation">
          {pages.map(([href, label]) => {
            const selected = path === href || (href === "/" && path.startsWith("/orders/"));
            return <Link aria-current={selected ? "page" : undefined} key={href} href={href + suffix}>{label}</Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
