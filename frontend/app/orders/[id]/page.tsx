import { Suspense } from "react";
import { OrderTimeline } from "@/components/order-timeline";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p role="status">Loading order…</p>}><OrderTimeline id={id} /></Suspense>;
}
