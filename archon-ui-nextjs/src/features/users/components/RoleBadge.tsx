import { Badge } from "flowbite-react";

interface RoleBadgeProps {
  role?: string;
}

/**
 * RoleBadge - Badge component for displaying user roles
 *
 * Displays user role with appropriate color coding:
 * - Admin: Purple/Red
 * - Member: Blue
 * - Viewer: Gray
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  const normalizedRole = (role || "member").toLowerCase();

  const badgeProps = {
    admin: { color: "failure" as const, label: "Admin" },
    member: { color: "info" as const, label: "Member" },
    viewer: { color: "gray" as const, label: "Viewer" },
  }[normalizedRole] || { color: "gray" as const, label: "Member" };

  return <Badge color={badgeProps.color}>{badgeProps.label}</Badge>;
}
