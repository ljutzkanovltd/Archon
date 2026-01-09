/**
 * Agent Work Orders - UI Components
 *
 * Central export point for all React components related to
 * the Agent Work Orders feature (cards, modals, tables, etc.).
 */

// Repository Cards
export { RepositoryCard, RepositoryCardSkeleton, type RepositoryCardProps } from "./RepositoryCard";
export { SidebarRepositoryCard, type SidebarRepositoryCardProps } from "./SidebarRepositoryCard";

// Work Order Table & Cards
export { WorkOrderTable, type WorkOrderTableProps } from "./WorkOrderTable";
export { WorkOrderRow, type WorkOrderRowProps } from "./WorkOrderRow";
export { WorkOrderCard, WorkOrderCardSkeleton, type WorkOrderCardProps } from "./WorkOrderCard";

// Modals
export { AddRepositoryModal, type AddRepositoryModalProps } from "./AddRepositoryModal";
export { EditRepositoryModal, type EditRepositoryModalProps } from "./EditRepositoryModal";
export { CreateWorkOrderModal, type CreateWorkOrderModalProps } from "./CreateWorkOrderModal";

// Workflow & Execution
export { WorkflowStepButton, type WorkflowStepButtonProps } from "./WorkflowStepButton";
export { RealTimeStats, type RealTimeStatsProps } from "./RealTimeStats";
export { ExecutionLogs, type ExecutionLogsProps } from "./ExecutionLogs";
export { StepHistoryCard, type StepHistoryCardProps } from "./StepHistoryCard";

// More components will be added during migration
