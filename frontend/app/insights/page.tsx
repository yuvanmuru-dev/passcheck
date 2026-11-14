import { Suspense } from "react";
import { Insights } from "@/components/insights";

export const metadata = { title: "Insights" };

export default function InsightsPage() {
  return <Suspense fallback={<p role="status">Loading insights…</p>}><Insights /></Suspense>;
}
