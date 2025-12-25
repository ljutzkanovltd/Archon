"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSidebarCookie, setSidebarCookie } from "@/lib/sidebar-cookie";

interface SidebarContextProps {
  desktop: {
    isCollapsed: boolean;
    setCollapsed: (value: boolean) => void;
    toggle: () => void;
    allExpanded: boolean;
  };
  mobile: {
    isOpen: boolean;
    close: () => void;
    open: () => void;
    toggle: () => void;
  };
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

interface SidebarProviderProps {
  children: ReactNode;
  initialCollapsed?: boolean;
}

export function SidebarProvider({
  children,
  initialCollapsed = false,
}: SidebarProviderProps) {
  // Desktop sidebar state - persisted
  const [desktopCollapsed, setDesktopCollapsed] = useState(initialCollapsed);

  // Mobile sidebar state - not persisted
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load collapsed state from cookie on mount
  useEffect(() => {
    const savedCollapsed = getSidebarCookie();
    setDesktopCollapsed(savedCollapsed);
  }, []);

  // Desktop handlers
  const handleSetDesktopCollapsed = (value: boolean) => {
    setDesktopCollapsed(value);
    setSidebarCookie(value);
  };

  const handleToggleDesktop = () => {
    handleSetDesktopCollapsed(!desktopCollapsed);
  };

  // Mobile handlers
  const handleCloseMobile = () => setMobileOpen(false);
  const handleOpenMobile = () => setMobileOpen(true);
  const handleToggleMobile = () => setMobileOpen(!mobileOpen);

  const value: SidebarContextProps = {
    desktop: {
      isCollapsed: desktopCollapsed,
      setCollapsed: handleSetDesktopCollapsed,
      toggle: handleToggleDesktop,
      allExpanded: !desktopCollapsed,
    },
    mobile: {
      isOpen: mobileOpen,
      close: handleCloseMobile,
      open: handleOpenMobile,
      toggle: handleToggleMobile,
    },
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
