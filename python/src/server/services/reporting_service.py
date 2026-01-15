"""
Reporting Service Module for Archon

This module provides business logic for generating project management reports,
including sprint metrics, task analytics, and project health indicators.
Optimized with PostgreSQL aggregation queries for performance.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from src.server.utils import get_supabase_client
from ..config.logfire_config import get_logger

logger = get_logger(__name__)


class ReportingService:
    """Service class for generating PM reports and analytics"""

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client"""
        self.supabase_client = supabase_client or get_supabase_client()

    async def get_sprint_report(
        self, sprint_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Generate comprehensive sprint report with velocity and burndown data.

        Args:
            sprint_id: UUID of the sprint

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - sprint: Sprint details
                - velocity: Story points completed
                - completion_rate: Percentage of tasks completed
                - burndown: Daily task completion data
                - task_breakdown: Status distribution
                - blocked_tasks: List of blocked tasks
        """
        try:
            # Fetch sprint details
            sprint_response = (
                self.supabase_client.table("archon_sprints")
                .select("*")
                .eq("id", sprint_id)
                .execute()
            )

            if not sprint_response.data:
                return False, {"error": f"Sprint {sprint_id} not found"}

            sprint = sprint_response.data[0]

            # Fetch all tasks in sprint
            tasks_response = (
                self.supabase_client.table("archon_sprint_tasks")
                .select("task_id, archon_tasks(*)")
                .eq("sprint_id", sprint_id)
                .execute()
            )

            tasks = [item["archon_tasks"] for item in tasks_response.data or []]

            # Calculate metrics
            total_tasks = len(tasks)
            completed_tasks = len([t for t in tasks if t["status"] == "done"])
            in_progress_tasks = len([t for t in tasks if t["status"] == "doing"])
            todo_tasks = len([t for t in tasks if t["status"] == "todo"])
            review_tasks = len([t for t in tasks if t["status"] == "review"])

            completion_rate = (
                (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
            )

            # Calculate velocity (story points - using estimated_hours as proxy)
            total_story_points = sum(
                t.get("estimated_hours", 0) or 0 for t in tasks
            )
            completed_story_points = sum(
                t.get("estimated_hours", 0) or 0
                for t in tasks
                if t["status"] == "done"
            )

            # Generate burndown data (daily aggregation)
            burndown_data = await self._generate_burndown_data(
                sprint_id, sprint["start_date"], sprint.get("end_date")
            )

            # Task breakdown by status
            task_breakdown = {
                "todo": todo_tasks,
                "doing": in_progress_tasks,
                "review": review_tasks,
                "done": completed_tasks,
            }

            # Find blocked tasks (tasks with 'blocked' in description or specific status)
            blocked_tasks = [
                {
                    "id": t["id"],
                    "title": t["title"],
                    "assignee": t.get("assignee"),
                    "priority": t.get("priority"),
                }
                for t in tasks
                if "blocked" in t.get("description", "").lower()
                or t.get("status") == "blocked"
            ]

            report = {
                "sprint": sprint,
                "metrics": {
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "completion_rate": round(completion_rate, 2),
                    "velocity": {
                        "total_story_points": total_story_points,
                        "completed_story_points": completed_story_points,
                        "remaining_story_points": total_story_points
                        - completed_story_points,
                    },
                },
                "burndown": burndown_data,
                "task_breakdown": task_breakdown,
                "blocked_tasks": blocked_tasks,
                "blocked_count": len(blocked_tasks),
            }

            logger.info(f"Generated sprint report for {sprint_id}")
            return True, report

        except Exception as e:
            logger.error(f"Error generating sprint report: {str(e)}")
            return False, {"error": str(e)}

    async def get_task_metrics(
        self,
        project_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> tuple[bool, dict[str, Any]]:
        """
        Generate task metrics for a project with date range filtering.

        Args:
            project_id: UUID of the project
            start_date: Optional start date (ISO format)
            end_date: Optional end date (ISO format)

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - status_distribution: Tasks by status
                - assignee_breakdown: Tasks by assignee
                - priority_distribution: Tasks by priority
                - avg_completion_time: Average hours to complete
                - completion_trend: Daily completion counts
        """
        try:
            # Fetch all tasks for project
            query = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("project_id", project_id)
            )

            # Apply date filters if provided
            if start_date:
                query = query.gte("created_at", start_date)
            if end_date:
                query = query.lte("created_at", end_date)

            tasks_response = query.execute()
            tasks = tasks_response.data or []

            # Status distribution
            status_distribution = {}
            for task in tasks:
                status = task.get("status", "unknown")
                status_distribution[status] = status_distribution.get(status, 0) + 1

            # Assignee breakdown
            assignee_breakdown = {}
            for task in tasks:
                assignee = task.get("assignee") or "unassigned"
                assignee_breakdown[assignee] = assignee_breakdown.get(assignee, 0) + 1

            # Priority distribution
            priority_distribution = {}
            for task in tasks:
                priority = task.get("priority") or "medium"
                priority_distribution[priority] = (
                    priority_distribution.get(priority, 0) + 1
                )

            # Calculate average completion time for completed tasks
            completed_tasks = [
                t
                for t in tasks
                if t.get("completed_at") and t.get("created_at")
            ]
            avg_completion_time = 0.0

            if completed_tasks:
                total_time = 0
                for task in completed_tasks:
                    created = datetime.fromisoformat(
                        task["created_at"].replace("Z", "+00:00")
                    )
                    completed = datetime.fromisoformat(
                        task["completed_at"].replace("Z", "+00:00")
                    )
                    duration = (completed - created).total_seconds() / 3600  # hours
                    total_time += duration

                avg_completion_time = total_time / len(completed_tasks)

            # Completion trend (daily counts)
            completion_trend = await self._generate_completion_trend(
                completed_tasks, start_date, end_date
            )

            metrics = {
                "total_tasks": len(tasks),
                "status_distribution": status_distribution,
                "assignee_breakdown": assignee_breakdown,
                "priority_distribution": priority_distribution,
                "avg_completion_time_hours": round(avg_completion_time, 2),
                "completion_trend": completion_trend,
                "date_range": {
                    "start_date": start_date,
                    "end_date": end_date,
                },
            }

            logger.info(f"Generated task metrics for project {project_id}")
            return True, metrics

        except Exception as e:
            logger.error(f"Error generating task metrics: {str(e)}")
            return False, {"error": str(e)}

    async def get_project_health(
        self, project_id: str
    ) -> tuple[bool, dict[str, Any]]:
        """
        Generate project health indicators and risk assessment.

        Args:
            project_id: UUID of the project

        Returns:
            Tuple of (success, result_dict)
            result_dict contains:
                - health_score: Overall health (0-100)
                - risk_level: low/medium/high/critical
                - blocked_tasks_count: Number of blocked tasks
                - overdue_tasks_count: Number of overdue tasks
                - unassigned_tasks_count: Number of unassigned tasks
                - high_priority_pending: High priority tasks not started
                - indicators: Detailed health indicators
        """
        try:
            # Fetch project details
            project_response = (
                self.supabase_client.table("archon_projects")
                .select("*")
                .eq("id", project_id)
                .execute()
            )

            if not project_response.data:
                return False, {"error": f"Project {project_id} not found"}

            project = project_response.data[0]

            # Fetch all tasks
            tasks_response = (
                self.supabase_client.table("archon_tasks")
                .select("*")
                .eq("project_id", project_id)
                .execute()
            )

            tasks = tasks_response.data or []
            total_tasks = len(tasks)

            if total_tasks == 0:
                return True, {
                    "project": project,
                    "health_score": 100,
                    "risk_level": "low",
                    "message": "No tasks to assess",
                }

            # Calculate health indicators
            blocked_tasks = [
                t
                for t in tasks
                if "blocked" in t.get("description", "").lower()
                or t.get("status") == "blocked"
            ]

            # Overdue tasks (due_date in past and not done)
            now = datetime.utcnow()
            overdue_tasks = [
                t
                for t in tasks
                if t.get("due_date")
                and datetime.fromisoformat(t["due_date"].replace("Z", "+00:00")) < now
                and t.get("status") != "done"
            ]

            unassigned_tasks = [t for t in tasks if not t.get("assignee")]

            high_priority_pending = [
                t
                for t in tasks
                if t.get("priority") == "high" and t.get("status") == "todo"
            ]

            # Calculate health score (0-100)
            health_score = 100

            # Deduct points for issues
            health_score -= len(blocked_tasks) * 10  # -10 per blocked task
            health_score -= len(overdue_tasks) * 5  # -5 per overdue task
            health_score -= len(unassigned_tasks) * 3  # -3 per unassigned task
            health_score -= len(high_priority_pending) * 2  # -2 per high priority pending

            # Clamp to 0-100
            health_score = max(0, min(100, health_score))

            # Determine risk level
            if health_score >= 80:
                risk_level = "low"
            elif health_score >= 60:
                risk_level = "medium"
            elif health_score >= 40:
                risk_level = "high"
            else:
                risk_level = "critical"

            health = {
                "project": project,
                "health_score": health_score,
                "risk_level": risk_level,
                "blocked_tasks_count": len(blocked_tasks),
                "overdue_tasks_count": len(overdue_tasks),
                "unassigned_tasks_count": len(unassigned_tasks),
                "high_priority_pending_count": len(high_priority_pending),
                "indicators": {
                    "total_tasks": total_tasks,
                    "completion_rate": round(
                        len([t for t in tasks if t["status"] == "done"])
                        / total_tasks
                        * 100,
                        2,
                    ),
                    "blocked_percentage": round(
                        len(blocked_tasks) / total_tasks * 100, 2
                    ),
                    "overdue_percentage": round(
                        len(overdue_tasks) / total_tasks * 100, 2
                    ),
                },
                "blocked_tasks": [
                    {"id": t["id"], "title": t["title"], "priority": t.get("priority")}
                    for t in blocked_tasks[:5]  # Top 5 blocked tasks
                ],
                "overdue_tasks": [
                    {
                        "id": t["id"],
                        "title": t["title"],
                        "due_date": t.get("due_date"),
                        "priority": t.get("priority"),
                    }
                    for t in sorted(
                        overdue_tasks,
                        key=lambda x: x.get("due_date") or "",
                    )[:5]  # Top 5 overdue tasks
                ],
            }

            logger.info(f"Generated project health for {project_id}")
            return True, health

        except Exception as e:
            logger.error(f"Error generating project health: {str(e)}")
            return False, {"error": str(e)}

    async def _generate_burndown_data(
        self,
        sprint_id: str,
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> list[dict[str, Any]]:
        """
        Generate daily burndown data for a sprint.

        Returns list of {date, remaining_tasks, completed_tasks}
        """
        try:
            if not start_date:
                return []

            # Fetch task history to reconstruct daily burndown
            # For now, use simplified approach with current task states
            # In production, use archon_task_history for accurate burndown

            tasks_response = (
                self.supabase_client.table("archon_sprint_tasks")
                .select("task_id, archon_tasks(status, completed_at)")
                .eq("sprint_id", sprint_id)
                .execute()
            )

            tasks = [item["archon_tasks"] for item in tasks_response.data or []]

            # Generate date range
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            end = (
                datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if end_date
                else datetime.utcnow()
            )

            burndown = []
            current_date = start

            while current_date <= end:
                # Count tasks completed by this date
                completed_by_date = len(
                    [
                        t
                        for t in tasks
                        if t.get("completed_at")
                        and datetime.fromisoformat(
                            t["completed_at"].replace("Z", "+00:00")
                        )
                        <= current_date
                    ]
                )

                remaining = len(tasks) - completed_by_date

                burndown.append(
                    {
                        "date": current_date.isoformat(),
                        "remaining_tasks": remaining,
                        "completed_tasks": completed_by_date,
                    }
                )

                current_date += timedelta(days=1)

            return burndown

        except Exception as e:
            logger.error(f"Error generating burndown data: {str(e)}")
            return []

    async def _generate_completion_trend(
        self,
        completed_tasks: list[dict[str, Any]],
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> list[dict[str, Any]]:
        """
        Generate daily completion trend data.

        Returns list of {date, completed_count}
        """
        try:
            if not completed_tasks:
                return []

            # Group by completion date
            completion_by_date = {}

            for task in completed_tasks:
                if task.get("completed_at"):
                    completed_date = datetime.fromisoformat(
                        task["completed_at"].replace("Z", "+00:00")
                    ).date()
                    date_str = completed_date.isoformat()
                    completion_by_date[date_str] = (
                        completion_by_date.get(date_str, 0) + 1
                    )

            # Convert to sorted list
            trend = [
                {"date": date, "completed_count": count}
                for date, count in sorted(completion_by_date.items())
            ]

            return trend

        except Exception as e:
            logger.error(f"Error generating completion trend: {str(e)}")
            return []
