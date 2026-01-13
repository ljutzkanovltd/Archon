"""
Authentication module for Archon User Management System.
"""

from .dependencies import (
    get_current_user,
    get_current_user_optional,
    get_current_verified_user,
    oauth2_scheme,
    require_admin,
)
from .jwt_utils import (
    create_access_token,
    extract_user_id_from_token,
    get_token_expiry,
    hash_password,
    verify_password,
    verify_token,
)

__all__ = [
    # JWT utilities
    "create_access_token",
    "verify_token",
    "hash_password",
    "verify_password",
    "get_token_expiry",
    "extract_user_id_from_token",
    # Dependencies
    "oauth2_scheme",
    "get_current_user",
    "get_current_verified_user",
    "get_current_user_optional",
    "require_admin",
]
