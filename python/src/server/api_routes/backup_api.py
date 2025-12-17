"""
Archon Backup Status API

Provides backup status information for monitoring dashboards and external systems.
This API exposes metrics about Archon's PostgreSQL database backups.

Endpoints:
    GET /api/backup/status - Get current backup status
    GET /api/backup/list - List all available backups
    GET /api/backup/health - Quick health check
"""

import os
import glob
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/backup", tags=["backup"])

# Constants
# Check if running in Docker (mounted at /app/backups) or local development
if Path("/app/backups").exists():
    BACKUP_DIR = Path("/app/backups")
else:
    # Local development: calculate project root
    # api_routes -> server -> src -> python -> archon
    PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
    BACKUP_DIR = PROJECT_ROOT / "backups"

    # Fallback to hardcoded path if relative path doesn't work
    if not BACKUP_DIR.exists():
        BACKUP_DIR = Path("/home/ljutzkanov/Documents/Projects/archon/backups")

BACKUP_PATTERN = "archon_postgres-*.dump"
MAX_RETENTION = 10  # Default retention from backup script

# Health status thresholds (in hours)
HEALTHY_THRESHOLD = 6
AGING_THRESHOLD = 24
OUTDATED_THRESHOLD = 48


class BackupFile(BaseModel):
    """Model for individual backup file"""
    filename: str = Field(..., description="Backup filename")
    timestamp: str = Field(..., description="Backup timestamp (ISO format)")
    age_hours: float = Field(..., description="Age of backup in hours")
    size_bytes: int = Field(..., description="File size in bytes")
    size_human: str = Field(..., description="Human-readable file size")
    path: str = Field(..., description="Full path to backup file")


class BackupStatus(BaseModel):
    """Model for backup status response"""
    source: str = Field(default="archon", description="Backup source identifier")
    latest_backup: Optional[str] = Field(None, description="Latest backup timestamp")
    age_hours: Optional[float] = Field(None, description="Hours since last backup")
    size_bytes: Optional[int] = Field(None, description="Latest backup size in bytes")
    size_human: Optional[str] = Field(None, description="Human-readable size")
    count: int = Field(..., description="Number of backups")
    max_retention: int = Field(MAX_RETENTION, description="Maximum retention count")
    health: str = Field(..., description="Health status: healthy|aging|outdated|missing")
    health_message: str = Field(..., description="Human-readable health message")
    location: str = Field(..., description="Backup directory path")
    disk_usage_percent: Optional[float] = Field(None, description="Disk usage percentage")


class BackupListResponse(BaseModel):
    """Model for backup list response"""
    count: int = Field(..., description="Number of backups")
    backups: List[BackupFile] = Field(..., description="List of backup files")
    total_size_bytes: int = Field(..., description="Total size of all backups")
    total_size_human: str = Field(..., description="Human-readable total size")


class BackupHealthResponse(BaseModel):
    """Model for quick health check response"""
    healthy: bool = Field(..., description="Overall health status")
    status: str = Field(..., description="Status: healthy|aging|outdated|missing")
    message: str = Field(..., description="Health status message")
    age_hours: Optional[float] = Field(None, description="Hours since last backup")


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def parse_backup_timestamp(filename: str) -> Optional[datetime]:
    """
    Parse timestamp from backup filename
    Expected format: archon_postgres-YYYYMMDD_HHMMSS.dump
    """
    try:
        # Extract timestamp part: YYYYMMDD_HHMMSS
        parts = filename.replace(".dump", "").split("-")
        if len(parts) < 2:
            return None

        timestamp_str = parts[-1]  # Last part after final dash
        # Format: YYYYMMDD_HHMMSS
        return datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
    except (ValueError, IndexError) as e:
        logger.warning(f"Failed to parse timestamp from {filename}: {e}")
        return None


def determine_health_status(age_hours: Optional[float]) -> tuple[str, str]:
    """
    Determine health status based on backup age

    Returns:
        tuple[str, str]: (status_code, message)
    """
    if age_hours is None:
        return "missing", "No backups found"

    if age_hours < HEALTHY_THRESHOLD:
        return "healthy", f"Backup is fresh ({age_hours:.1f}h old)"
    elif age_hours < AGING_THRESHOLD:
        return "aging", f"Backup is aging ({age_hours:.1f}h old)"
    elif age_hours < OUTDATED_THRESHOLD:
        return "outdated", f"Backup is outdated ({age_hours:.1f}h old)"
    else:
        return "critical", f"Backup is critically old ({age_hours:.1f}h old)"


def get_disk_usage(path: Path) -> Optional[float]:
    """Get disk usage percentage for the filesystem containing the path"""
    try:
        import shutil
        usage = shutil.disk_usage(path)
        return (usage.used / usage.total) * 100
    except Exception as e:
        logger.warning(f"Failed to get disk usage: {e}")
        return None


def scan_backup_directory() -> List[Dict[str, Any]]:
    """
    Scan backup directory and return list of backup files with metadata

    Returns:
        List of backup file dictionaries sorted by timestamp (newest first)
    """
    if not BACKUP_DIR.exists():
        logger.warning(f"Backup directory does not exist: {BACKUP_DIR}")
        return []

    backup_files = []
    pattern = str(BACKUP_DIR / BACKUP_PATTERN)

    for filepath in glob.glob(pattern):
        try:
            path = Path(filepath)
            filename = path.name

            # Get file stats
            stat = path.stat()
            size_bytes = stat.st_size

            # Parse timestamp from filename
            timestamp = parse_backup_timestamp(filename)
            if timestamp is None:
                # Fallback to file modification time
                timestamp = datetime.fromtimestamp(stat.st_mtime)

            # Calculate age
            age = datetime.now() - timestamp
            age_hours = age.total_seconds() / 3600

            backup_files.append({
                "filename": filename,
                "timestamp": timestamp,
                "timestamp_iso": timestamp.isoformat(),
                "age_hours": age_hours,
                "size_bytes": size_bytes,
                "size_human": format_size(size_bytes),
                "path": str(path.absolute())
            })

        except Exception as e:
            logger.error(f"Error processing backup file {filepath}: {e}")
            continue

    # Sort by timestamp (newest first)
    backup_files.sort(key=lambda x: x["timestamp"], reverse=True)

    return backup_files


@router.get("/status", response_model=BackupStatus)
async def get_backup_status() -> BackupStatus:
    """
    Get current backup status for monitoring dashboards

    Returns comprehensive backup status including:
    - Latest backup timestamp and age
    - Backup size and count
    - Health status (healthy/aging/outdated/missing)
    - Disk usage information

    Example:
        GET /api/backup/status

        Response:
        {
            "source": "archon",
            "latest_backup": "2025-12-16T14:43:00",
            "age_hours": 2.5,
            "size_bytes": 471859200,
            "size_human": "450.0 MB",
            "count": 8,
            "max_retention": 10,
            "health": "healthy",
            "health_message": "Backup is fresh (2.5h old)",
            "location": "/home/ljutzkanov/Documents/Projects/archon/backups",
            "disk_usage_percent": 45.3
        }
    """
    try:
        backups = scan_backup_directory()

        # Get latest backup info
        latest_backup = None
        age_hours = None
        size_bytes = None
        size_human = None

        if backups:
            latest = backups[0]
            latest_backup = latest["timestamp_iso"]
            age_hours = latest["age_hours"]
            size_bytes = latest["size_bytes"]
            size_human = latest["size_human"]

        # Determine health status
        health, health_message = determine_health_status(age_hours)

        # Get disk usage
        disk_usage = get_disk_usage(BACKUP_DIR) if BACKUP_DIR.exists() else None

        return BackupStatus(
            source="archon",
            latest_backup=latest_backup,
            age_hours=age_hours,
            size_bytes=size_bytes,
            size_human=size_human,
            count=len(backups),
            max_retention=MAX_RETENTION,
            health=health,
            health_message=health_message,
            location=str(BACKUP_DIR.absolute()),
            disk_usage_percent=disk_usage
        )

    except Exception as e:
        logger.error(f"Error getting backup status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get backup status: {str(e)}")


@router.get("/list", response_model=BackupListResponse)
async def list_backups() -> BackupListResponse:
    """
    List all available backup files

    Returns detailed information about all backups including:
    - Filename and timestamp
    - File size and age
    - Full file path

    Sorted by timestamp (newest first)

    Example:
        GET /api/backup/list

        Response:
        {
            "count": 8,
            "backups": [
                {
                    "filename": "archon_postgres-20251216_144300.dump",
                    "timestamp": "2025-12-16T14:43:00",
                    "age_hours": 2.5,
                    "size_bytes": 471859200,
                    "size_human": "450.0 MB",
                    "path": "/home/ljutzkanov/Documents/Projects/archon/backups/archon_postgres-20251216_144300.dump"
                },
                ...
            ],
            "total_size_bytes": 3774873600,
            "total_size_human": "3.5 GB"
        }
    """
    try:
        backups = scan_backup_directory()

        # Calculate total size
        total_size_bytes = sum(b["size_bytes"] for b in backups)
        total_size_human = format_size(total_size_bytes)

        # Convert to BackupFile models
        backup_files = [
            BackupFile(
                filename=b["filename"],
                timestamp=b["timestamp_iso"],
                age_hours=b["age_hours"],
                size_bytes=b["size_bytes"],
                size_human=b["size_human"],
                path=b["path"]
            )
            for b in backups
        ]

        return BackupListResponse(
            count=len(backups),
            backups=backup_files,
            total_size_bytes=total_size_bytes,
            total_size_human=total_size_human
        )

    except Exception as e:
        logger.error(f"Error listing backups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


@router.get("/health", response_model=BackupHealthResponse)
async def get_backup_health() -> BackupHealthResponse:
    """
    Quick health check for backup system

    Returns simple boolean health status for quick checks

    Example:
        GET /api/backup/health

        Response:
        {
            "healthy": true,
            "status": "healthy",
            "message": "Backup is fresh (2.5h old)",
            "age_hours": 2.5
        }
    """
    try:
        backups = scan_backup_directory()

        age_hours = backups[0]["age_hours"] if backups else None
        health, message = determine_health_status(age_hours)

        return BackupHealthResponse(
            healthy=(health == "healthy"),
            status=health,
            message=message,
            age_hours=age_hours
        )

    except Exception as e:
        logger.error(f"Error getting backup health: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get backup health: {str(e)}")
