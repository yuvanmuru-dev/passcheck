import { Suspense } from "react";
import { Board } from "@/components/board";

export default function Home() {
  return <Suspense fallback={<p role="status">Loading Pass Board…</p>}><Board /></Suspense>;
}
