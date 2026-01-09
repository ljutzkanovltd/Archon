/**
 * Agent Work Orders - Zustand Slices
 *
 * Central export point for all Zustand store slices:
 * - filtersSlice: Search and filtering state
 * - modalsSlice: Modal visibility and editing context
 * - sseSlice: Server-Sent Events connections and live logs
 * - uiPreferencesSlice: Layout mode and UI preferences (persisted)
 */

export { createFiltersSlice, type FiltersSlice } from "./filtersSlice";
export { createModalsSlice, type ModalsSlice } from "./modalsSlice";
export { createSSESlice, type SSESlice, type LiveProgress } from "./sseSlice";
export { createUIPreferencesSlice, type UIPreferencesSlice, type LayoutMode } from "./uiPreferencesSlice";
