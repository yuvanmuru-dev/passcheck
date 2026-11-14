import { Suspense } from "react";
import { Disputes } from "@/components/disputes";

export const metadata = { title: "Disputes" };

export default function DisputesPage() {
  return <Suspense fallback={<p role="status">Loading disputes…</p>}><Disputes /></Suspense>;
}
