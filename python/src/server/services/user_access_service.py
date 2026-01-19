"""
User Project Access Service.

Handles user access control for projects:
- Admins see everything (no filtering)
- Regular users only see projects they have explicit access to
"""

from typing import List, Optional, Tuple
from uuid import UUID

from ..config.logfire_config import get_logger
from ..utils.db_utils import get_direct_db_connection

logger = get_logger(__name__)


class UserAccessService:
    """Service for managing user project access."""

    async def has_project_access(
        self, user_id: UUID, project_id: UUID
    ) -> Tuple[bool, str]:
        """
        Check if user has access to a project.

        Admins have access to everything.
        Regular users need explicit access record.

        Args:
            user_id: User UUID
            project_id: Project UUID

        Returns:
            Tuple of (has_access: bool, reason: str)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                # Use the database helper function
                has_access = await conn.fetchval(
                    "SELECT has_project_access($1::uuid, $2::uuid)",
                    user_id,
                    project_id,
                )

                reason = "access granted" if has_access else "access denied"
                return has_access, reason

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error checking project access | user_id={user_id} | project_id={project_id} | error={str(e)}")
            return False, f"error: {str(e)}"

    async def get_user_accessible_project_ids(
        self, user_id: UUID
    ) -> Tuple[bool, List[UUID] | str]:
        """
        Get list of project IDs that user has access to.

        Admins get all projects.
        Regular users get only assigned projects.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (success: bool, project_ids: List[UUID] | error: str)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                # Use the database helper function
                rows = await conn.fetch(
                    "SELECT project_id FROM get_user_accessible_project_ids($1::uuid)",
                    user_id,
                )

                project_ids = [row["project_id"] for row in rows]
                logger.debug(f"Accessible projects | user_id={user_id} | count={len(project_ids)}")

                return True, project_ids

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error getting accessible projects | user_id={user_id} | error={str(e)}")
            return False, str(e)

    async def is_user_admin(self, user_id: UUID) -> Tuple[bool, bool]:
        """
        Check if user has admin role.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (success: bool, is_admin: bool)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                role = await conn.fetchval(
                    "SELECT role FROM archon_users WHERE id = $1",
                    user_id,
                )

                is_admin = role == "admin"
                logger.debug(f"User role check | user_id={user_id} | role={role} | is_admin={is_admin}")

                return True, is_admin

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error checking user role | user_id={user_id} | error={str(e)}")
            return False, False

    async def add_user_to_project(
        self,
        user_id: UUID,
        project_id: UUID,
        access_level: str,
        added_by: UUID,
    ) -> Tuple[bool, dict | str]:
        """
        Add user to project with specified access level.

        Args:
            user_id: User UUID to grant access
            project_id: Project UUID
            access_level: 'owner' or 'member'
            added_by: User UUID who is granting access

        Returns:
            Tuple of (success: bool, result: dict | error: str)
        """
        try:
            if access_level not in ("owner", "member"):
                return False, "access_level must be 'owner' or 'member'"

            conn = await get_direct_db_connection()
            try:
                # Check if access already exists
                existing = await conn.fetchval(
                    """
                    SELECT id FROM archon_user_project_access
                    WHERE user_id = $1 AND project_id = $2 AND removed_at IS NULL
                    """,
                    user_id,
                    project_id,
                )

                if existing:
                    # Update access level if it already exists
                    await conn.execute(
                        """
                        UPDATE archon_user_project_access
                        SET access_level = $3, updated_at = NOW()
                        WHERE user_id = $1 AND project_id = $2 AND removed_at IS NULL
                        """,
                        user_id,
                        project_id,
                        access_level,
                    )
                    logger.info(f"Updated project access | user_id={user_id} | project_id={project_id} | access_level={access_level}")
                else:
                    # Insert new access record
                    await conn.execute(
                        """
                        INSERT INTO archon_user_project_access
                        (user_id, project_id, access_level, added_by, added_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        """,
                        user_id,
                        project_id,
                        access_level,
                        added_by,
                    )
                    logger.info(f"Added user to project | user_id={user_id} | project_id={project_id} | access_level={access_level}")

                return True, {
                    "user_id": str(user_id),
                    "project_id": str(project_id),
                    "access_level": access_level,
                }

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error adding user to project | user_id={user_id} | project_id={project_id} | error={str(e)}")
            return False, str(e)

    async def remove_user_from_project(
        self,
        user_id: UUID,
        project_id: UUID,
        removed_by: UUID,
    ) -> Tuple[bool, str]:
        """
        Remove user from project (soft delete).

        Args:
            user_id: User UUID to remove access
            project_id: Project UUID
            removed_by: User UUID who is removing access

        Returns:
            Tuple of (success: bool, message: str)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                # Soft delete by setting removed_at timestamp
                result = await conn.execute(
                    """
                    UPDATE archon_user_project_access
                    SET removed_at = NOW(), removed_by = $3, updated_at = NOW()
                    WHERE user_id = $1 AND project_id = $2 AND removed_at IS NULL
                    """,
                    user_id,
                    project_id,
                    removed_by,
                )

                if result == "UPDATE 0":
                    return False, "User does not have access to this project"

                logger.info(f"Removed user from project | user_id={user_id} | project_id={project_id}")
                return True, "User removed from project successfully"

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error removing user from project | user_id={user_id} | project_id={project_id} | error={str(e)}")
            return False, str(e)

    async def get_project_members(
        self, project_id: UUID
    ) -> Tuple[bool, List[dict] | str]:
        """
        Get list of users who have access to a project.

        Args:
            project_id: Project UUID

        Returns:
            Tuple of (success: bool, members: List[dict] | error: str)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                rows = await conn.fetch(
                    """
                    SELECT
                        upa.id,
                        upa.user_id,
                        upa.access_level,
                        upa.added_at,
                        upa.added_by,
                        u.email,
                        u.full_name,
                        u.avatar_url,
                        u.role,
                        added_by_user.full_name as added_by_name
                    FROM archon_user_project_access upa
                    JOIN archon_users u ON u.id = upa.user_id
                    LEFT JOIN archon_users added_by_user ON added_by_user.id = upa.added_by
                    WHERE upa.project_id = $1 AND upa.removed_at IS NULL
                    ORDER BY upa.access_level DESC, upa.added_at ASC
                    """,
                    project_id,
                )

                members = [
                    {
                        "id": str(row["id"]),
                        "user_id": str(row["user_id"]),
                        "email": row["email"],
                        "full_name": row["full_name"],
                        "avatar_url": row["avatar_url"],
                        "role": row["role"],
                        "access_level": row["access_level"],
                        "added_at": row["added_at"].isoformat() if row["added_at"] else None,
                        "added_by": str(row["added_by"]) if row["added_by"] else None,
                        "added_by_name": row["added_by_name"],
                    }
                    for row in rows
                ]

                logger.debug(f"Project members retrieved | project_id={project_id} | count={len(members)}")
                return True, members

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error getting project members | project_id={project_id} | error={str(e)}")
            return False, str(e)

    async def get_user_projects(
        self, user_id: UUID
    ) -> Tuple[bool, List[dict] | str]:
        """
        Get list of projects a user has access to with access level.

        Args:
            user_id: User UUID

        Returns:
            Tuple of (success: bool, projects: List[dict] | error: str)
        """
        try:
            conn = await get_direct_db_connection()
            try:
                # Check if user is admin
                is_admin_success, is_admin = await self.is_user_admin(user_id)

                if is_admin:
                    # Admins see all projects
                    rows = await conn.fetch(
                        """
                        SELECT
                            p.id as project_id,
                            p.title,
                            p.description,
                            p.github_repo,
                            p.pinned,
                            p.archived,
                            p.created_at,
                            p.updated_at,
                            'owner' as access_level
                        FROM archon_projects p
                        WHERE p.archived = false
                        ORDER BY p.pinned DESC, p.updated_at DESC
                        """
                    )
                else:
                    # Regular users see only assigned projects
                    rows = await conn.fetch(
                        """
                        SELECT
                            p.id as project_id,
                            p.title,
                            p.description,
                            p.github_repo,
                            p.pinned,
                            p.archived,
                            p.created_at,
                            p.updated_at,
                            upa.access_level
                        FROM archon_user_project_access upa
                        JOIN archon_projects p ON p.id = upa.project_id
                        WHERE upa.user_id = $1 AND upa.removed_at IS NULL AND p.archived = false
                        ORDER BY p.pinned DESC, p.updated_at DESC
                        """,
                        user_id,
                    )

                projects = [
                    {
                        "project_id": str(row["project_id"]),
                        "title": row["title"],
                        "description": row["description"],
                        "github_repo": row["github_repo"],
                        "pinned": row["pinned"],
                        "archived": row["archived"],
                        "access_level": row["access_level"],
                        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                    }
                    for row in rows
                ]

                logger.debug(f"User projects retrieved | user_id={user_id} | is_admin={is_admin} | count={len(projects)}")
                return True, projects

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Error getting user projects | user_id={user_id} | error={str(e)}")
            return False, str(e)
