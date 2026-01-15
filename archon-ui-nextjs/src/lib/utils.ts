import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * This ensures Tailwind classes are properly merged without conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Darkens a hex color by a specified percentage
 * @param hex - Hex color string (e.g., "#ef0606")
 * @param percent - Percentage to darken (0-100)
 */
export function darkenHexColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse r, g, b values
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - percent / 100)));
  const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - percent / 100)));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Applies dynamic branding colors to the document root
 * @param primaryColor - Primary brand color (default: #ef0606)
 */
export function applyBranding(primaryColor: string = "#ef0606") {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--color-brand-700", primaryColor);

  const brand800 = darkenHexColor(primaryColor, 20);
  document.documentElement.style.setProperty("--color-brand-800", brand800);
}

/**
 * Check if a dev-only feature should be shown
 * @param featureName - Name of the environment variable (without NEXT_PUBLIC_ prefix)
 * @returns true if feature is enabled, false otherwise
 *
 * @example
 * ```tsx
 * if (isDevFeatureEnabled("SHOW_TEST_FOUNDATION")) {
 *   return <TestFoundationTab />;
 * }
 * ```
 */
export function isDevFeatureEnabled(featureName: string): boolean {
  const envKey = `NEXT_PUBLIC_${featureName}`;
  const envValue = process.env[envKey];

  // Feature is enabled only if explicitly set to "true" (case-insensitive)
  return envValue?.toLowerCase() === "true";
}

/**
 * Check if Test Foundation page should be shown in Settings
 * This is a convenience wrapper around isDevFeatureEnabled
 */
export function shouldShowTestFoundation(): boolean {
  return isDevFeatureEnabled("SHOW_TEST_FOUNDATION");
}
