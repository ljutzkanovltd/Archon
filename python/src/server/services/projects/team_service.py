"""
Team Service Module for Archon

This module provides business logic for team management operations.
Teams group users together for collaboration on projects with role-based access.
"""

from typing import Any, Optional

from src.server.utils import get_supabase_client
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class TeamService:
    """Service class for team management operations"""

    VALID_ROLES = ["member", "lead", "observer"]

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def create_team(
        self,
        name: str,
        description: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Create a new team.

        Args:
            name: Team name
            description: Optional team description
            project_id: Optional project association (NULL for organization-wide teams)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains team data or error message
        """
        try:
            # Validate project exists if provided
            if project_id:
                project_response = (
                    self.supabase_client.table("archon_projects")
                    .select("id, title")
                    .eq("id", project_id)
                    .execute()
                )
                if not project_response.data:
                    return False, {"error": f"Project {project_id} not found"}

            # Create team
            team_data = {
                "name": name,
                "description": description,
                "project_id": project_id,
            }

            team_response = (
                self.supabase_client.table("archon_teams")
                .insert(team_data)
                .execute()
            )

            if not team_response.data:
                return False, {"error": "Failed to create team"}

            team = team_response.data[0]
            team["member_count"] = 0  # New team has no members

            logger.info(f"Created team '{name}'" + (f" for project {project_id}" if project_id else " (organization-wide)"))
            return True, {"team": team}

        except Exception as e:
            logger.error(f"Error creating team: {str(e)}")
            return False, {"error": str(e)}

    async def add_team_member(
        self, team_id: str, user_id: str, role: str = "member"
    ) -> tuple[bool, dict[str, Any]]:
        """
        Add a user to a team with a specific role.

        Args:
            team_id: UUID of the team
            user_id: User identifier (matches assignee field)
            role: Team role (member, lead, observer)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains member data or error message
        """
        try:
            # Validate role
            if role not in self.VALID_ROLES:
                return False, {
                    "error": f"Invalid role. Must be one of: {', '.join(self.VALID_ROLES)}"
                }

            # Validate team exists
            team_response = (
                self.supabase_client.table("archon_teams")
                .select("id, name")
                .eq("id", team_id)
                .execute()
            )
            if not team_response.data:
                return False, {"error": f"Team {team_id} not found"}

            # Add member
            member_data = {
                "team_id": team_id,
                "user_id": user_id,
                "role": role,
            }

            member_response = (
                self.supabase_client.table("archon_team_members")
                .insert(member_data)
                .execute()
            )

            if not member_response.data:
                return False, {"error": "Failed to add team member"}

            member = member_response.data[0]
            logger.info(f"Added user '{user_id}' to team '{team_response.data[0]['name']}' as {role}")
            return True, {
                "member": member,
                "team": team_response.data[0]
            }

        except Exception as e:
            error_msg = str(e)
            if "duplicate key" in error_msg.lower():
                return False, {"error": f"User {user_id} is already a member of this team"}
            logger.error(f"Error adding team member: {error_msg}")
            return False, {"error": error_msg}

    async def remove_team_member(
        self, team_id: str, user_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Remove a user from a team.

        Args:
            team_id: UUID of the team
            user_id: User identifier

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Delete team member
            delete_response = (
                self.supabase_client.table("archon_team_members")
                .delete()
                .eq("team_id", team_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not delete_response.data:
                return False, {
                    "error": f"User {user_id} is not a member of team {team_id}"
                }

            logger.info(f"Removed user '{user_id}' from team {team_id}")
            return True, {"message": "Member removed successfully"}

        except Exception as e:
            logger.error(f"Error removing team member: {str(e)}")
            return False, {"error": str(e)}

    async def get_team_members(
        self, team_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all members of a team.

        Args:
            team_id: UUID of the team

        Returns:
            Tuple of (success, result_dict)
            result_dict contains members list with roles or error message
        """
        try:
            # Validate team exists
            team_response = (
                self.supabase_client.table("archon_teams")
                .select("*")
                .eq("id", team_id)
                .execute()
            )
            if not team_response.data:
                return False, {"error": f"Team {team_id} not found"}

            # Get team members
            members_response = (
                self.supabase_client.table("archon_team_members")
                .select("*")
                .eq("team_id", team_id)
                .order("joined_at")
                .execute()
            )

            members = members_response.data or []
            team = team_response.data[0]
            team["member_count"] = len(members)

            return True, {
                "team": team,
                "members": members,
                "count": len(members)
            }

        except Exception as e:
            logger.error(f"Error getting team members: {str(e)}")
            return False, {"error": str(e)}

    async def get_user_teams(
        self, user_id: str, project_id: Optional[str] = None
    ) -> tuple[bool, dict[str, Any]]:
        """
        Get all teams a user belongs to.

        Args:
            user_id: User identifier
            project_id: Optional filter by project

        Returns:
            Tuple of (success, result_dict)
            result_dict contains teams list with user's role or error message
        """
        try:
            # Get user's team memberships
            memberships_response = (
                self.supabase_client.table("archon_team_members")
                .select("team_id, role, joined_at")
                .eq("user_id", user_id)
                .execute()
            )

            if not memberships_response.data:
                return True, {"teams": [], "count": 0}

            # Get full team details
            team_ids = [m["team_id"] for m in memberships_response.data]
            teams_query = (
                self.supabase_client.table("archon_teams")
                .select("*")
                .in_("id", team_ids)
            )

            # Filter by project if provided
            if project_id:
                teams_query = teams_query.eq("project_id", project_id)

            teams_response = teams_query.execute()

            # Enrich teams with user's role
            teams_map = {t["id"]: t for t in teams_response.data}
            enriched_teams = []
            for membership in memberships_response.data:
                team = teams_map.get(membership["team_id"])
                if team:
                    team["user_role"] = membership["role"]
                    team["joined_at"] = membership["joined_at"]
                    enriched_teams.append(team)

            return True, {"teams": enriched_teams, "count": len(enriched_teams)}

        except Exception as e:
            logger.error(f"Error getting user teams: {str(e)}")
            return False, {"error": str(e)}

    async def update_member_role(
        self, team_id: str, user_id: str, new_role: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Update a team member's role.

        Args:
            team_id: UUID of the team
            user_id: User identifier
            new_role: New role (member, lead, observer)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains updated member data or error message
        """
        try:
            # Validate role
            if new_role not in self.VALID_ROLES:
                return False, {
                    "error": f"Invalid role. Must be one of: {', '.join(self.VALID_ROLES)}"
                }

            # Update member role
            update_response = (
                self.supabase_client.table("archon_team_members")
                .update({"role": new_role})
                .eq("team_id", team_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not update_response.data:
                return False, {
                    "error": f"User {user_id} is not a member of team {team_id}"
                }

            member = update_response.data[0]
            logger.info(f"Updated user '{user_id}' role to '{new_role}' in team {team_id}")
            return True, {"member": member}

        except Exception as e:
            logger.error(f"Error updating member role: {str(e)}")
            return False, {"error": str(e)}

    async def delete_team(self, team_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Delete a team and all its members (cascade).

        Args:
            team_id: UUID of the team

        Returns:
            Tuple of (success, result_dict)
        """
        try:
            # Delete team (members will be cascade deleted)
            delete_response = (
                self.supabase_client.table("archon_teams")
                .delete()
                .eq("id", team_id)
                .execute()
            )

            if not delete_response.data:
                return False, {"error": f"Team {team_id} not found"}

            logger.info(f"Deleted team {team_id}")
            return True, {"message": "Team deleted successfully"}

        except Exception as e:
            logger.error(f"Error deleting team: {str(e)}")
            return False, {"error": str(e)}
