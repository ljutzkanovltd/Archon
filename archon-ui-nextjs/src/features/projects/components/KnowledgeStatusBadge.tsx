"use client";

import { Badge, Tooltip } from "flowbite-react";
import {
  HiLockClosed,
  HiGlobeAlt,
  HiCheck,
  HiLightBulb,
} from "react-icons/hi";
import { IconType } from "react-icons";

export type KnowledgeStatusType = "private" | "global" | "linked" | "suggested";

interface KnowledgeStatusBadgeProps {
  type: KnowledgeStatusType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

interface BadgeConfig {
  icon: IconType;
  label: string;
  color: "gray" | "blue" | "green" | "yellow" | "info" | "success" | "warning";
  bgColor: string;
  textColor: string;
  iconColor: string;
  tooltip: string;
}

const BADGE_CONFIG: Record<KnowledgeStatusType, BadgeConfig> = {
  private: {
    icon: HiLockClosed,
    label: "Private",
    color: "gray",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-700 dark:text-gray-300",
    iconColor: "text-gray-500",
    tooltip: "Only visible in this project",
  },
  global: {
    icon: HiGlobeAlt,
    label: "Global",
    color: "blue",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    textColor: "text-blue-700 dark:text-blue-300",
    iconColor: "text-blue-500",
    tooltip: "Available across all projects",
  },
  linked: {
    icon: HiCheck,
    label: "Linked",
    color: "success",
    bgColor: "bg-green-100 dark:bg-green-900",
    textColor: "text-green-700 dark:text-green-300",
    iconColor: "text-green-500",
    tooltip: "Linked to this project",
  },
  suggested: {
    icon: HiLightBulb,
    label: "Suggested",
    color: "warning",
    bgColor: "bg-yellow-100 dark:bg-yellow-900",
    textColor: "text-yellow-700 dark:text-yellow-300",
    iconColor: "text-yellow-500",
    tooltip: "AI-recommended for this project",
  },
};

/**
 * KnowledgeStatusBadge - Reusable status badge for knowledge items
 *
 * Features:
 * - 4 status types: private, global, linked, suggested
 * - 3 size variants: sm (icon only), md (icon + label), lg (icon + label + prominent)
 * - Tooltip explanations on hover
 * - Dark mode support
 * - Accessibility with aria-label
 *
 * Usage:
 * <KnowledgeStatusBadge type="global" size="md" showLabel />
 * <KnowledgeStatusBadge type="linked" size="sm" />
 */
export function KnowledgeStatusBadge({
  type,
  size = "md",
  showLabel = true,
  className = "",
}: KnowledgeStatusBadgeProps) {
  const config = BADGE_CONFIG[type];
  const Icon = config.icon;

  const iconSizeClass = {
    sm: "h-3 w-3",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  }[size];

  const badgeContent = (
    <Badge color={config.color} size={size} className={className}>
      <div className="flex items-center gap-1">
        <Icon className={iconSizeClass} aria-hidden="true" />
        {showLabel && <span>{config.label}</span>}
      </div>
    </Badge>
  );

  return (
    <Tooltip content={config.tooltip} placement="top">
      <div
        role="status"
        aria-label={`${config.label}: ${config.tooltip}`}
        className="inline-block"
      >
        {badgeContent}
      </div>
    </Tooltip>
  );
}

/**
 * KnowledgeStatusBadgeGroup - Display multiple status badges together
 *
 * Usage:
 * <KnowledgeStatusBadgeGroup types={["global", "linked"]} size="sm" />
 */
interface KnowledgeStatusBadgeGroupProps {
  types: KnowledgeStatusType[];
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  className?: string;
}

export function KnowledgeStatusBadgeGroup({
  types,
  size = "sm",
  showLabels = false,
  className = "",
}: KnowledgeStatusBadgeGroupProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {types.map((type) => (
        <KnowledgeStatusBadge
          key={type}
          type={type}
          size={size}
          showLabel={showLabels}
        />
      ))}
    </div>
  );
}
