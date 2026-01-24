import { Badge } from "flowbite-react";

interface DocumentPrivacyBadgeProps {
  isPrivate: boolean;
}

/**
 * DocumentPrivacyBadge - Badge component for displaying document privacy status
 *
 * Displays document privacy with appropriate color coding:
 * - Private: Orange/Warning (project-scoped only)
 * - Public: Green/Success (global knowledge base)
 */
export function DocumentPrivacyBadge({ isPrivate }: DocumentPrivacyBadgeProps) {
  if (isPrivate) {
    return <Badge color="warning">Private</Badge>;
  }

  return <Badge color="success">Global KB</Badge>;
}
