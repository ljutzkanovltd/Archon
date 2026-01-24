"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSidebar } from "@/contexts/sidebar-context";
import { useSettings } from "@/contexts/SettingsContext";
import { useProjectStore } from "@/store/useProjectStore";
import { useTaskStore } from "@/store/useTaskStore";
import { usePermissions } from "@/hooks/usePermissions";
import {
  HiChartPie,
  HiFolder,
  HiDocumentText,
  HiChevronDown,
  HiX,
  HiDatabase,
  HiCog,
  HiServer,
  HiClipboardList,
  HiBeaker,
  HiUsers,
} from "react-icons/hi";
import { useState, useEffect, useCallback, useRef } from "react";
import { ProjectTaskBadge } from "./Sidebar/ProjectTaskBadge";
import { useWorkOrders } from "@/features/agent-work-orders/hooks/useAgentWorkOrderQueries";

interface MenuItemProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string | React.ReactNode;
  children?: MenuItemProps[];
}

function MenuItem({
  item,
  isCollapsed,
  level = 0,
}: {
  item: MenuItemProps;
  isCollapsed: boolean;
  level?: number;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const isActive = pathname === item.href;
  const hasChildren = item.children && item.children.length > 0;

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        {/* Parent item - Link with separate toggle button */}
        <div className="flex items-center gap-1">
          <Link
            href={item.href}
            className={`flex flex-1 items-center gap-3 rounded-lg p-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors ${
              isActive
                ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? item.label : undefined}
          >
            <Icon className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            {!isCollapsed && (
              <span className="flex-1 whitespace-nowrap text-left">
                {item.label}
              </span>
            )}
            {!isCollapsed && item.badge && (
              typeof item.badge === 'string' ? (
                <span className="inline-flex items-center justify-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-300">
                  {item.badge}
                </span>
              ) : (
                <div>{item.badge}</div>
              )
            )}
          </Link>

          {/* Separate toggle button for expand/collapse */}
          {!isCollapsed && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label={isOpen ? "Collapse submenu" : "Expand submenu"}
              aria-expanded={isOpen}
              aria-controls={`submenu-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <HiChevronDown
                className={`h-5 w-5 transition-transform ${
                  isOpen ? "" : "-rotate-90"
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* Children */}
        {isOpen && !isCollapsed && item.children && (
          <div
            id={`submenu-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
            className="ml-4 mt-1 space-y-1"
          >
            {item.children.map((child) => {
              const childIsActive = pathname === child.href;
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                    childIsActive
                      ? "bg-brand-100 hover:bg-brand-200 text-brand-700 dark:bg-brand-900/20 dark:hover:bg-brand-900/30 dark:text-brand-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  <ChildIcon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate whitespace-nowrap">
                    {child.label}
                  </span>
                  {child.badge && (
                    <span className="ml-auto text-xs text-gray-500">
                      {child.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg p-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors ${
        isActive
          ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
          : "hover:bg-gray-100 dark:hover:bg-gray-700"
      } ${isCollapsed ? "justify-center" : ""}`}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
      {!isCollapsed && (
        <span className="flex-1 whitespace-nowrap">{item.label}</span>
      )}
      {!isCollapsed && item.badge && (
        typeof item.badge === 'string' ? (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-300">
            {item.badge}
          </span>
        ) : (
          <div className="ml-auto">{item.badge}</div>
        )
      )}
      {isCollapsed && item.badge && typeof item.badge !== 'string' && (
        <div className="absolute right-2">{item.badge}</div>
      )}
    </Link>
  );
}

export function DesktopSidebar() {
  const { desktop } = useSidebar();
  const { projects, fetchProjects } = useProjectStore();
  const { tasks, fetchTasks } = useTaskStore();
  const {
    projectsEnabled,
    tasksEnabled,
    knowledgeBaseEnabled,
    mcpServerDashboardEnabled,
    agentWorkOrdersEnabled,
  } = useSettings();
  const permissions = usePermissions();

  // Fetch work orders for badge count
  const { data: workOrders = [] } = useWorkOrders();

  // Sidebar width management
  const MIN_WIDTH = 64; // Collapsed width
  const DEFAULT_WIDTH = 256; // 16rem (w-64)
  const MAX_WIDTH = 400;

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem("sidebar-width");
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!desktop.isCollapsed) {
      localStorage.setItem("sidebar-width", sidebarWidth.toString());
    }
  }, [sidebarWidth, desktop.isCollapsed]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle resize move
  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      const newWidth = e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing]
  );

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add and remove event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Double-click to reset width
  const handleDoubleClick = useCallback(() => {
    setSidebarWidth(DEFAULT_WIDTH);
  }, []);

  // Fetch projects on mount - load ALL projects including archived for accurate counts
  // Store handles deduplication automatically (prevents race conditions)
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects({ per_page: 1000, include_archived: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch tasks on mount
  // Store handles deduplication automatically (prevents race conditions)
  useEffect(() => {
    if (tasks.length === 0) {
      fetchTasks({ include_closed: false, per_page: 1000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate active task count (todo, doing, review)
  const activeTaskCount = tasks.filter(
    (task) =>
      !task.archived &&
      task.status &&
      ["todo", "doing", "review"].includes(task.status)
  ).length;

  // Calculate active work order count (pending, running)
  const activeWorkOrderCount = workOrders.filter(
    (workOrder) => workOrder.status === "pending" || workOrder.status === "running"
  ).length;

  // Calculate active (non-archived) project count for badge
  const activeProjects = (projects || []).filter((p) => !p.archived);

  // Build menu items with projects as children
  const allMenuItems: MenuItemProps[] = [
    {
      href: "/",
      icon: HiChartPie,
      label: "Dashboard",
    },
    {
      href: "/projects",
      icon: HiFolder,
      label: "Projects",
      badge: activeProjects.length > 0 ? String(activeProjects.length) : undefined,
      children: activeProjects
        .filter((project) => project && project.id)
        .map((project) => ({
          href: `/projects/${project.id}`,
          icon: HiFolder,
          label: project.title,
          badge: <ProjectTaskBadge
              projectId={project.id}
              isCollapsed={desktop.isCollapsed}
            />,
        })),
    },
    {
      href: "/tasks",
      icon: HiClipboardList,
      label: "Tasks",
      badge: activeTaskCount > 0 ? String(activeTaskCount) : undefined,
    },
    {
      href: "/agent-work-orders",
      icon: HiBeaker,
      label: "Agent Work Orders",
      badge: activeWorkOrderCount > 0 ? String(activeWorkOrderCount) : undefined,
    },
    {
      href: "/knowledge-base",
      icon: HiDatabase,
      label: "Knowledge Base",
    },
    {
      href: "/mcp",
      icon: HiServer,
      label: "MCP Server",
    },
    {
      href: "/test-foundation",
      icon: HiBeaker,
      label: "Test Foundation",
    },
    {
      href: "/users",
      icon: HiUsers,
      label: "Users",
    },
    {
      href: "/settings",
      icon: HiCog,
      label: "Settings",
    },
  ];

  // Filter menu items based on feature toggles AND permissions (RBAC)
  const menuItems = allMenuItems.filter((item) => {
    // Feature toggle checks
    if (item.href === "/projects" && !projectsEnabled) return false;
    if (item.href === "/tasks" && !tasksEnabled) return false;
    if (item.href === "/agent-work-orders" && !agentWorkOrdersEnabled) return false;
    if (item.href === "/knowledge-base" && !knowledgeBaseEnabled) return false;
    if (item.href === "/mcp" && !mcpServerDashboardEnabled) return false;

    // Permission-based filtering (RBAC)
    if (item.href === "/users" && !permissions.canManageUsers) return false;
    if (item.href === "/test-foundation" && !permissions.canViewTestFoundation) return false;

    return true; // Show if passes all checks
  });

  return (
    <aside
      ref={sidebarRef}
      style={{
        width: desktop.isCollapsed ? `${MIN_WIDTH}px` : `${sidebarWidth}px`,
      }}
      className="relative hidden h-full border-r border-gray-200 bg-white transition-none dark:border-gray-700 dark:bg-gray-800 md:block"
    >
      <div className="flex h-full flex-col overflow-y-auto py-4">
        <div className={`space-y-2 ${desktop.isCollapsed ? "px-2" : "px-3"}`}>
          {menuItems.map((item) => (
            <MenuItem
              key={item.href}
              item={item}
              isCollapsed={desktop.isCollapsed}
            />
          ))}
        </div>
      </div>

      {/* Resize handle - Enhanced discoverability */}
      {!desktop.isCollapsed && (
        <div
          className="absolute right-0 top-0 h-full w-[3px] cursor-col-resize bg-gradient-to-r from-transparent via-gray-300 to-transparent hover:w-1 hover:via-brand-500 transition-all duration-200 dark:via-gray-600 dark:hover:via-brand-400"
          onMouseDown={handleResizeStart}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize | Double-click to reset"
        />
      )}

      {/* Toggle button */}
      <button
        onClick={desktop.toggle}
        className="absolute bottom-4 right-0 translate-x-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-md hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        title={desktop.isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={desktop.isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          className={`h-4 w-4 transition-transform ${
            desktop.isCollapsed ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    </aside>
  );
}

export function MobileSidebar() {
  const { mobile } = useSidebar();
  const { projects, fetchProjects } = useProjectStore();
  const { tasks, fetchTasks } = useTaskStore();
  const {
    projectsEnabled,
    tasksEnabled,
    knowledgeBaseEnabled,
    mcpServerDashboardEnabled,
    agentWorkOrdersEnabled,
  } = useSettings();
  const permissions = usePermissions();

  // Fetch work orders for badge count
  const { data: workOrders = [] } = useWorkOrders();

  // Fetch projects on mount - load ALL projects including archived for accurate counts
  // Store handles deduplication automatically (prevents race conditions)
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects({ per_page: 1000, include_archived: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch tasks on mount
  // Store handles deduplication automatically (prevents race conditions)
  useEffect(() => {
    if (tasks.length === 0) {
      fetchTasks({ include_closed: false, per_page: 1000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate active task count (todo, doing, review)
  const activeTaskCount = tasks.filter(
    (task) =>
      !task.archived &&
      task.status &&
      ["todo", "doing", "review"].includes(task.status)
  ).length;

  // Calculate active work order count (pending, running)
  const activeWorkOrderCount = workOrders.filter(
    (workOrder) => workOrder.status === "pending" || workOrder.status === "running"
  ).length;

  // Calculate active (non-archived) project count for badge
  const activeProjects = (projects || []).filter((p) => !p.archived);

  // Build menu items with projects as children
  const allMenuItems: MenuItemProps[] = [
    {
      href: "/",
      icon: HiChartPie,
      label: "Dashboard",
    },
    {
      href: "/projects",
      icon: HiFolder,
      label: "Projects",
      badge: activeProjects.length > 0 ? String(activeProjects.length) : undefined,
      children: activeProjects
        .filter((project) => project && project.id)
        .map((project) => ({
          href: `/projects/${project.id}`,
          icon: HiFolder,
          label: project.title,
          badge: <ProjectTaskBadge
              projectId={project.id}
              isCollapsed={false}
              isMobile={true}
            />,
        })),
    },
    {
      href: "/tasks",
      icon: HiClipboardList,
      label: "Tasks",
      badge: activeTaskCount > 0 ? String(activeTaskCount) : undefined,
    },
    {
      href: "/agent-work-orders",
      icon: HiBeaker,
      label: "Agent Work Orders",
      badge: activeWorkOrderCount > 0 ? String(activeWorkOrderCount) : undefined,
    },
    {
      href: "/knowledge-base",
      icon: HiDatabase,
      label: "Knowledge Base",
    },
    {
      href: "/mcp",
      icon: HiServer,
      label: "MCP Server",
    },
    {
      href: "/test-foundation",
      icon: HiBeaker,
      label: "Test Foundation",
    },
    {
      href: "/users",
      icon: HiUsers,
      label: "Users",
    },
    {
      href: "/settings",
      icon: HiCog,
      label: "Settings",
    },
  ];

  // Filter menu items based on feature toggles AND permissions (RBAC)
  const menuItems = allMenuItems.filter((item) => {
    // Feature toggle checks
    if (item.href === "/projects" && !projectsEnabled) return false;
    if (item.href === "/tasks" && !tasksEnabled) return false;
    if (item.href === "/agent-work-orders" && !agentWorkOrdersEnabled) return false;
    if (item.href === "/knowledge-base" && !knowledgeBaseEnabled) return false;
    if (item.href === "/mcp" && !mcpServerDashboardEnabled) return false;

    // Permission-based filtering (RBAC)
    if (item.href === "/users" && !permissions.canManageUsers) return false;
    if (item.href === "/test-foundation" && !permissions.canViewTestFoundation) return false;

    return true; // Show if passes all checks
  });

  if (!mobile.isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/50 md:hidden"
        onClick={mobile.close}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:hidden">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-xl font-bold text-brand-600 dark:text-brand-400">
              Archon
            </h2>
            <button
              onClick={mobile.close}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <HiX className="h-5 w-5" />
            </button>
          </div>

          {/* Menu */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-2 px-3">
              {menuItems.map((item) => (
                <MenuItem key={item.href} item={item} isCollapsed={false} />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
