"use client";

import { HiClipboardList, HiFolder } from "react-icons/hi";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import TabView from "@/components/common/TabView";
import { AgentWorkOrdersView, RepositoriesListView } from "@/features/agent-work-orders/views";
import {
  AddRepositoryModal,
  CreateWorkOrderModal,
  EditRepositoryModal,
} from "@/features/agent-work-orders/components";
import { useAgentWorkOrdersStore } from "@/features/agent-work-orders/state/agentWorkOrdersStore";

/**
 * Agent Work Orders Page
 *
 * Main page with tabs for Work Orders and Repositories.
 * Follows SportERP tab pattern from shop-and-products/page.tsx
 */
export default function AgentWorkOrdersPage() {
  // Zustand Modals State (shared across tabs)
  const showAddRepoModal = useAgentWorkOrdersStore((s) => s.showAddRepoModal);
  const showEditRepoModal = useAgentWorkOrdersStore((s) => s.showEditRepoModal);
  const showCreateWorkOrderModal = useAgentWorkOrdersStore((s) => s.showCreateWorkOrderModal);

  // Zustand Modal Actions
  const closeAddRepoModal = useAgentWorkOrdersStore((s) => s.closeAddRepoModal);
  const closeEditRepoModal = useAgentWorkOrdersStore((s) => s.closeEditRepoModal);
  const closeCreateWorkOrderModal = useAgentWorkOrdersStore((s) => s.closeCreateWorkOrderModal);

  const tabs = [
    {
      id: "work-orders",
      label: "Work Orders",
      icon: HiClipboardList,
      component: <AgentWorkOrdersView />,
      default: true,
    },
    {
      id: "repositories",
      label: "Repositories",
      icon: HiFolder,
      component: <RepositoriesListView />,
    },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb items={[{ label: "Agent Work Orders", href: "/agent-work-orders" }]} className="mb-4" />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Agent Work Orders</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage automated development workflows and repositories</p>
      </div>

      {/* Tab View */}
      <TabView tabsList={tabs} />

      {/* Shared Modals (available across all tabs) */}
      <AddRepositoryModal open={showAddRepoModal} onOpenChange={closeAddRepoModal} />
      <EditRepositoryModal open={showEditRepoModal} onOpenChange={closeEditRepoModal} />
      <CreateWorkOrderModal open={showCreateWorkOrderModal} onOpenChange={closeCreateWorkOrderModal} />
    </div>
  );
}
