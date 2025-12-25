import { useEffect } from "react";

/**
 * Hook to dynamically set the page title
 *
 * @param title - The page title
 * @param suffix - Optional suffix (default: "Archon")
 *
 * @example
 * // In a Projects page component:
 * usePageTitle("Projects");
 * // Document title becomes: "Projects | Archon"
 *
 * // Custom suffix:
 * usePageTitle("Dashboard", "My Custom App");
 * // Document title becomes: "Dashboard | My Custom App"
 *
 * // No suffix:
 * usePageTitle("Home", "");
 * // Document title becomes: "Home"
 */
export function usePageTitle(title: string, suffix: string = "Archon"): void {
  useEffect(() => {
    const previousTitle = document.title;

    // Set new title
    document.title = suffix ? `${title} | ${suffix}` : title;

    // Restore previous title on unmount
    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
}

/**
 * Hook to set page title with automatic reset
 * Useful for temporary titles (e.g., notifications)
 *
 * @param title - The temporary title
 * @param duration - Duration in milliseconds before resetting
 *
 * @example
 * const setTempTitle = useTemporaryPageTitle();
 *
 * // Show notification in title for 3 seconds
 * onClick={() => {
 *   setTempTitle("New Message!", 3000);
 * }}
 */
export function useTemporaryPageTitle() {
  return (title: string, duration: number = 3000) => {
    const originalTitle = document.title;
    document.title = title;

    setTimeout(() => {
      document.title = originalTitle;
    }, duration);
  };
}
