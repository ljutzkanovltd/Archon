"use client";

import { useParams } from "next/navigation";
import { AgentWorkOrderDetailView } from "@/features/agent-work-orders/views";

export default function AgentWorkOrderDetailPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  return <AgentWorkOrderDetailView workOrderId={workOrderId} />;
}
