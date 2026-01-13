"""
JWT Token Utilities for Archon User Management System.

Implements JWT token creation, verification, and password hashing.
Based on SportERP patterns but simplified for Archon's needs.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing configuration (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token with user data.

    Args:
        data: Dictionary containing user claims (user_id, email, etc.)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string

    Example:
        token = create_access_token(
            data={
                "sub": str(user_id),
                "email": "user@example.com",
                "full_name": "John Doe"
            }
        )
    """
    to_encode = data.copy()

    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    # Encode JWT token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT token.

    Args:
        token: JWT token string to verify

    Returns:
        Decoded token payload (dict)

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password string (bcrypt format)

    Example:
        hashed = hash_password("password123")
        # Returns: $2a$12$...
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database

    Returns:
        True if password matches, False otherwise

    Example:
        is_valid = verify_password("password123", user.hashed_password)
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_token_expiry(minutes: Optional[int] = None) -> datetime:
    """
    Calculate token expiration timestamp.

    Args:
        minutes: Optional custom expiration time in minutes

    Returns:
        datetime object representing expiration time
    """
    if minutes:
        return datetime.utcnow() + timedelta(minutes=minutes)
    return datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)


def extract_user_id_from_token(token: str) -> str:
    """
    Extract user ID from JWT token payload.

    Args:
        token: JWT token string

    Returns:
        User ID (UUID string) from 'sub' claim

    Raises:
        HTTPException: If token is invalid or missing 'sub' claim
    """
    payload = verify_token(token)
    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id
