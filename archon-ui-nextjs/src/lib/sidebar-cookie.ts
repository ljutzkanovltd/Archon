/**
 * Cookie-based persistence for sidebar state
 */

const SIDEBAR_COOKIE_NAME = "archon-sidebar-collapsed";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getSidebarCookie(): boolean {
  if (typeof document === "undefined") return false;

  const cookies = document.cookie.split(";");
  const sidebarCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${SIDEBAR_COOKIE_NAME}=`)
  );

  if (!sidebarCookie) return false;

  const value = sidebarCookie.split("=")[1];
  return value === "true";
}

export function setSidebarCookie(collapsed: boolean): void {
  if (typeof document === "undefined") return;

  document.cookie = `${SIDEBAR_COOKIE_NAME}=${collapsed}; max-age=${COOKIE_MAX_AGE}; path=/`;
}
