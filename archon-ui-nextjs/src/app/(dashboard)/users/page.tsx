"use client";

import { UsersListView } from "@/features/users/views/UsersListView";

/**
 * Users Page - Next.js page component
 *
 * Delegates to UsersListView feature component for all logic and rendering.
 */
export default function UsersPage() {
  return <UsersListView />;
}
