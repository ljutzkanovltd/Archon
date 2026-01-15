"""
Casbin Service Module for Archon

This module provides RBAC (Role-Based Access Control) functionality using Casbin.
Supports project-level permissions with domain isolation (domain = project_id).
"""

import os
from pathlib import Path
from typing import Any, Optional

import casbin
from casbin_sqlalchemy_adapter import Adapter

from src.server.utils import get_supabase_client
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class CasbinService:
    """Service class for Casbin RBAC operations"""

    # Role definitions
    ROLES = ["admin", "manager", "member", "viewer"]

    # Permission format: "resource:action"
    PERMISSIONS = [
        "project:read",
        "project:write",
        "project:delete",
        "task:create",
        "task:assign",
        "task:read",
        "task:write",
        "task:delete",
        "sprint:manage",
        "sprint:read",
        "team:manage",
        "team:read",
        "hierarchy:manage",
        "hierarchy:read",
    ]

    def __init__(self, supabase_client=None, use_database_adapter=False):
        """
        Initialize Casbin service.

        Args:
            supabase_client: Optional Supabase client
            use_database_adapter: If True, use database adapter for policies (future enhancement)
        """
        self.supabase_client = supabase_client or get_supabase_client()
        self._enforcer = None
        self._use_database_adapter = use_database_adapter

    def _get_enforcer(self) -> casbin.Enforcer:
        """
        Get or create Casbin enforcer instance (singleton).

        Returns:
            Casbin Enforcer instance
        """
        if self._enforcer is None:
            # Get paths to model and policy files
            config_dir = Path(__file__).parent.parent.parent / "config"
            model_path = config_dir / "rbac_model.conf"
            policy_path = config_dir / "rbac_policy.csv"

            if not model_path.exists():
                raise FileNotFoundError(f"Casbin model file not found: {model_path}")

            if self._use_database_adapter:
                # Future enhancement: use database adapter
                # adapter = Adapter(DATABASE_URI)
                # self._enforcer = casbin.Enforcer(str(model_path), adapter)
                logger.warning("Database adapter not yet implemented, falling back to CSV")
                self._enforcer = casbin.Enforcer(str(model_path), str(policy_path))
            else:
                # Use CSV policy file
                if not policy_path.exists():
                    logger.warning(f"Policy file not found: {policy_path}. Creating enforcer with empty policies.")
                    # Create enforcer with model only
                    self._enforcer = casbin.Enforcer(str(model_path))
                else:
                    self._enforcer = casbin.Enforcer(str(model_path), str(policy_path))

            logger.info("Casbin enforcer initialized")

        return self._enforcer

    async def enforce(
        self, user_id: str, project_id: str, resource: str, action: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Check if a user has permission to perform an action on a resource in a project.

        Args:
            user_id: User identifier
            project_id: Project UUID (domain)
            resource: Resource type (e.g., "project", "task", "sprint")
            action: Action to perform (e.g., "read", "write", "manage")

        Returns:
            Tuple of (allowed, result_dict)
            result_dict contains decision info or error message
        """
        try:
            enforcer = self._get_enforcer()

            # Check permission using domain-based RBAC
            # Format: enforce(sub, dom, obj, act)
            allowed = enforcer.enforce(user_id, project_id, resource, action)

            if allowed:
                logger.info(f"Permission granted: {user_id} can {action} {resource} in {project_id}")
                return True, {
                    "allowed": True,
                    "user_id": user_id,
                    "project_id": project_id,
                    "resource": resource,
                    "action": action,
                }
            else:
                logger.warning(f"Permission denied: {user_id} cannot {action} {resource} in {project_id}")
                return False, {
                    "allowed": False,
                    "error": f"Permission denied: User {user_id} cannot {action} {resource} in project {project_id}",
                    "user_id": user_id,
                    "project_id": project_id,
                    "resource": resource,
                    "action": action,
                }

        except Exception as e:
            logger.error(f"Error checking permission: {str(e)}")
            return False, {"error": str(e)}

    async def assign_role(
        self, user_id: str, role: str, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Assign a role to a user in a specific project.

        Args:
            user_id: User identifier
            role: Role name (admin, manager, member, viewer)
            project_id: Project UUID (domain)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            if role not in self.ROLES:
                return False, {
                    "error": f"Invalid role. Must be one of: {', '.join(self.ROLES)}"
                }

            enforcer = self._get_enforcer()

            # Add role assignment: g, user, role, domain
            success = enforcer.add_grouping_policy(user_id, role, project_id)

            if success:
                logger.info(f"Assigned role '{role}' to user '{user_id}' in project {project_id}")
                return True, {
                    "user_id": user_id,
                    "role": role,
                    "project_id": project_id,
                    "message": "Role assigned successfully"
                }
            else:
                return False, {
                    "error": f"Role assignment already exists or failed"
                }

        except Exception as e:
            logger.error(f"Error assigning role: {str(e)}")
            return False, {"error": str(e)}

    async def remove_role(
        self, user_id: str, role: str, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Remove a role from a user in a specific project.

        Args:
            user_id: User identifier
            role: Role name
            project_id: Project UUID (domain)

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            enforcer = self._get_enforcer()

            # Remove role assignment: g, user, role, domain
            success = enforcer.remove_grouping_policy(user_id, role, project_id)

            if success:
                logger.info(f"Removed role '{role}' from user '{user_id}' in project {project_id}")
                return True, {"message": "Role removed successfully"}
            else:
                return False, {"error": "Role assignment not found"}

        except Exception as e:
            logger.error(f"Error removing role: {str(e)}")
            return False, {"error": str(e)}

    async def get_user_roles(
        self, user_id: str, project_id: Optional[str] = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all roles assigned to a user, optionally filtered by project.

        Args:
            user_id: User identifier
            project_id: Optional project UUID filter

        Returns:
            Tuple of (success, result_dict)
            result_dict contains roles list
        """
        try:
            enforcer = self._get_enforcer()

            # Get all role assignments for user
            roles = enforcer.get_roles_for_user(user_id)

            if project_id:
                # Filter by project (domain)
                # get_roles_for_user_in_domain is the correct method for domain-based roles
                roles = enforcer.get_roles_for_user_in_domain(user_id, project_id)

            return True, {
                "user_id": user_id,
                "project_id": project_id,
                "roles": roles,
                "count": len(roles)
            }

        except Exception as e:
            logger.error(f"Error getting user roles: {str(e)}")
            return False, {"error": str(e)}

    async def get_users_with_role(
        self, role: str, project_id: Optional[str] = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all users with a specific role, optionally filtered by project.

        Args:
            role: Role name
            project_id: Optional project UUID filter

        Returns:
            Tuple of (success, result_dict)
            result_dict contains users list
        """
        try:
            if role not in self.ROLES:
                return False, {
                    "error": f"Invalid role. Must be one of: {', '.join(self.ROLES)}"
                }

            enforcer = self._get_enforcer()

            # Get all users with role
            if project_id:
                users = enforcer.get_users_for_role_in_domain(role, project_id)
            else:
                users = enforcer.get_users_for_role(role)

            return True, {
                "role": role,
                "project_id": project_id,
                "users": users,
                "count": len(users)
            }

        except Exception as e:
            logger.error(f"Error getting users with role: {str(e)}")
            return False, {"error": str(e)}

    async def has_permission(
        self, user_id: str, project_id: str, permission: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Check if user has a specific permission (convenience method).

        Args:
            user_id: User identifier
            project_id: Project UUID
            permission: Permission string (e.g., "project:read", "task:write")

        Returns:
            Tuple of (allowed, result_dict)
        """
        try:
            if ":" not in permission:
                return False, {"error": "Invalid permission format. Use 'resource:action'"}

            resource, action = permission.split(":", 1)
            return await self.enforce(user_id, project_id, resource, action)

        except Exception as e:
            logger.error(f"Error checking permission: {str(e)}")
            return False, {"error": str(e)}
