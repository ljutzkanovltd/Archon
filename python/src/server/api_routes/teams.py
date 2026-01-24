"""
Teams API endpoints for Archon

Handles:
- Team management (create, list, get, update, delete)
- Team member management (add, remove, update role)
- Team filtering by project
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from pydantic import BaseModel, Field

from ..auth.dependencies import require_team_manage
from ..config.logfire_config import get_logger, logfire
from ..services.projects.team_service import TeamService

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["teams"])


class CreateTeamRequest(BaseModel):
    """Request to create a new team"""
    name: str = Field(..., description="Team name")
    description: Optional[str] = Field(None, description="Team description")
    project_id: Optional[str] = Field(None, description="Project ID (null for organization-wide teams)")


class UpdateTeamRequest(BaseModel):
    """Request to update team details"""
    name: Optional[str] = Field(None, description="New team name")
    description: Optional[str] = Field(None, description="New team description")


class AddTeamMemberRequest(BaseModel):
    """Request to add a team member"""
    user_id: str = Field(..., description="User identifier")
    role: str = Field("member", description="Team role: member, lead, observer")


class UpdateMemberRoleRequest(BaseModel):
    """Request to update a member's role"""
    role: str = Field(..., description="New role: member, lead, observer")


@router.post("/teams")
async def create_team(
    request: CreateTeamRequest,
    _user: dict = Depends(require_team_manage)
):
    """
    Create a new team.

    Requires: team:manage permission

    Args:
        request: Team details (name, description, project_id)

    Returns:
        Created team object
    """
    try:
        logfire.debug(
            f"Creating team '{request.name}'" +
            (f" for project {request.project_id}" if request.project_id else " (organization-wide)")
        )

        team_service = TeamService()
        success, result = await team_service.create_team(
            name=request.name,
            description=request.description,
            project_id=request.project_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            # Return 404 if project not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Team '{request.name}' created successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating team: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/teams")
async def list_teams(project_id: Optional[str] = None):
    """
    List all teams, optionally filtered by project.

    Args:
        project_id: Optional project UUID to filter teams

    Returns:
        Array of team objects with member counts
    """
    try:
        logfire.debug(f"Listing teams" + (f" for project {project_id}" if project_id else " (all)"))

        team_service = TeamService()

        # Use Supabase client to list teams
        from ..utils import get_supabase_client
        supabase = get_supabase_client()

        query = supabase.table("archon_teams").select("*")
        if project_id:
            query = query.eq("project_id", project_id)

        teams_response = query.order("created_at", desc=True).execute()

        teams = teams_response.data or []

        # Get member counts for each team
        for team in teams:
            members_response = (
                supabase.table("archon_team_members")
                .select("id", count="exact")
                .eq("team_id", team["id"])
                .execute()
            )
            team["member_count"] = members_response.count or 0

        logfire.debug(f"Retrieved {len(teams)} teams")
        return {
            "teams": teams,
            "count": len(teams)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing teams: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/teams/{team_id}")
async def get_team(team_id: str, include_members: bool = True):
    """
    Get team details, optionally with members.

    Args:
        team_id: UUID of the team
        include_members: Whether to include team members (default: True)

    Returns:
        Team object with optional members array
    """
    try:
        logfire.debug(f"Getting team {team_id} (include_members={include_members})")

        team_service = TeamService()

        if include_members:
            success, result = await team_service.get_team_members(team_id)
        else:
            from ..utils import get_supabase_client
            supabase = get_supabase_client()
            team_response = supabase.table("archon_teams").select("*").eq("id", team_id).execute()

            if not team_response.data:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=f"Team {team_id} not found"
                )

            team = team_response.data[0]
            success, result = True, {"team": team, "members": [], "count": 0}

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved team {team_id} with {result['count']} members")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/teams/{team_id}")
async def update_team(
    team_id: str,
    request: UpdateTeamRequest,
    _user: dict = Depends(require_team_manage)
):
    """
    Update team details (name, description).

    Requires: team:manage permission

    Args:
        team_id: UUID of the team
        request: Updated team details

    Returns:
        Updated team object
    """
    try:
        logfire.debug(f"Updating team {team_id}")

        from ..utils import get_supabase_client
        supabase = get_supabase_client()

        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description

        if not update_data:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Update team
        update_response = (
            supabase.table("archon_teams")
            .update(update_data)
            .eq("id", team_id)
            .execute()
        )

        if not update_response.data:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Team {team_id} not found"
            )

        team = update_response.data[0]
        logfire.debug(f"Team {team_id} updated successfully")
        return {"team": team}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/teams/{team_id}")
async def delete_team(
    team_id: str,
    _user: dict = Depends(require_team_manage)
):
    """
    Delete a team and all its members (cascade).

    Requires: team:manage permission

    Args:
        team_id: UUID of the team

    Returns:
        Success message
    """
    try:
        logfire.debug(f"Deleting team {team_id}")

        team_service = TeamService()
        success, result = await team_service.delete_team(team_id)

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Team {team_id} deleted successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/teams/{team_id}/members")
async def add_team_member(
    team_id: str,
    request: AddTeamMemberRequest,
    _user: dict = Depends(require_team_manage)
):
    """
    Add a member to a team.

    Requires: team:manage permission

    Args:
        team_id: UUID of the team
        request: Member details (user_id, role)

    Returns:
        Created member object
    """
    try:
        logfire.debug(f"Adding user {request.user_id} to team {team_id} as {request.role}")

        team_service = TeamService()
        success, result = await team_service.add_team_member(
            team_id=team_id,
            user_id=request.user_id,
            role=request.role
        )

        if not success:
            error_msg = result.get("error", "Unknown error")

            # Return 404 if team not found
            if "not found" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )

            # Return 400 for invalid role or duplicate member
            if "invalid role" in error_msg.lower() or "already a member" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"User {request.user_id} added to team {team_id} successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding member to team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/teams/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    _user: dict = Depends(require_team_manage)
):
    """
    Remove a member from a team.

    Requires: team:manage permission

    Args:
        team_id: UUID of the team
        user_id: User identifier

    Returns:
        Success message
    """
    try:
        logfire.debug(f"Removing user {user_id} from team {team_id}")

        team_service = TeamService()
        success, result = await team_service.remove_team_member(
            team_id=team_id,
            user_id=user_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            if "not a member" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"User {user_id} removed from team {team_id} successfully")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing member from team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/teams/{team_id}/members/{user_id}/role")
async def update_member_role(
    team_id: str,
    user_id: str,
    request: UpdateMemberRoleRequest,
    _user: dict = Depends(require_team_manage)
):
    """
    Update a team member's role.

    Requires: team:manage permission

    Args:
        team_id: UUID of the team
        user_id: User identifier
        request: New role details

    Returns:
        Updated member object
    """
    try:
        logfire.debug(f"Updating user {user_id} role to {request.role} in team {team_id}")

        team_service = TeamService()
        success, result = await team_service.update_member_role(
            team_id=team_id,
            user_id=user_id,
            new_role=request.role
        )

        if not success:
            error_msg = result.get("error", "Unknown error")

            # Return 404 if member not found
            if "not a member" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=error_msg
                )

            # Return 400 for invalid role
            if "invalid role" in error_msg.lower():
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=error_msg
                )

            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"User {user_id} role updated to {request.role} in team {team_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating member role in team {team_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/users/{user_id}/teams")
async def get_user_teams(user_id: str, project_id: Optional[str] = None):
    """
    Get all teams a user belongs to.

    Args:
        user_id: User identifier
        project_id: Optional project UUID to filter teams

    Returns:
        Array of teams with user's role in each
    """
    try:
        logfire.debug(
            f"Getting teams for user {user_id}" +
            (f" in project {project_id}" if project_id else "")
        )

        team_service = TeamService()
        success, result = await team_service.get_user_teams(
            user_id=user_id,
            project_id=project_id
        )

        if not success:
            error_msg = result.get("error", "Unknown error")
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

        logfire.debug(f"Retrieved {result['count']} teams for user {user_id}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting teams for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
