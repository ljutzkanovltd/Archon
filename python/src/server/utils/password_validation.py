"""
Password strength validation utilities for Archon User Management System.

Provides comprehensive password validation:
- Minimum requirements (length, character types)
- Strength scoring using zxcvbn
- Common password detection
- User data similarity checks
"""

import re
from typing import Optional

from zxcvbn import zxcvbn


class PasswordValidationError(Exception):
    """Custom exception for password validation failures"""
    pass


# Common weak passwords that should never be allowed
COMMON_PASSWORDS = {
    "password",
    "password123",
    "12345678",
    "123456789",
    "qwerty",
    "abc123",
    "monkey",
    "letmein",
    "trustno1",
    "dragon",
    "baseball",
    "iloveyou",
    "master",
    "sunshine",
    "ashley",
    "bailey",
    "passw0rd",
    "shadow",
    "123123",
    "654321",
    "superman",
    "qazwsx",
    "michael",
    "football",
    "welcome",
    "jesus",
    "ninja",
    "mustang",
    "access",
    "password1",
    "admin",
    "root",
    "user",
    "test",
}


def check_password_requirements(password: str) -> dict:
    """
    Check if password meets minimum security requirements.

    Requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character

    Args:
        password: Password to validate

    Returns:
        Dictionary with check results:
        {
            "valid": bool,
            "errors": list[str],
            "requirements_met": dict
        }
    """
    errors = []
    requirements_met = {
        "min_length": len(password) >= 8,
        "has_uppercase": bool(re.search(r'[A-Z]', password)),
        "has_lowercase": bool(re.search(r'[a-z]', password)),
        "has_digit": bool(re.search(r'\d', password)),
        "has_special": bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password)),
    }

    if not requirements_met["min_length"]:
        errors.append("Password must be at least 8 characters long")

    if not requirements_met["has_uppercase"]:
        errors.append("Password must contain at least one uppercase letter")

    if not requirements_met["has_lowercase"]:
        errors.append("Password must contain at least one lowercase letter")

    if not requirements_met["has_digit"]:
        errors.append("Password must contain at least one digit")

    if not requirements_met["has_special"]:
        errors.append("Password must contain at least one special character (!@#$%^&*...)")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "requirements_met": requirements_met,
    }


def check_common_password(password: str) -> bool:
    """
    Check if password is in the list of commonly used weak passwords.

    Args:
        password: Password to check

    Returns:
        True if password is common (weak), False otherwise
    """
    return password.lower() in COMMON_PASSWORDS


def calculate_password_strength(
    password: str,
    user_inputs: Optional[list] = None
) -> dict:
    """
    Calculate password strength using zxcvbn algorithm.

    zxcvbn provides realistic password strength estimation considering:
    - Pattern matching (dates, sequences, keyboard patterns)
    - Dictionary attacks
    - Common substitutions (@ for a, 3 for e, etc.)
    - User-specific data (name, email, etc.)

    Args:
        password: Password to analyze
        user_inputs: Optional list of user-specific strings (name, email, etc.)
                    to check for similarity

    Returns:
        Dictionary with strength analysis:
        {
            "score": int (0-4, where 4 is strongest),
            "feedback": {
                "warning": str or None,
                "suggestions": list[str]
            },
            "crack_times_display": {
                "offline_fast_hashing_1e10_per_second": str,
                "offline_slow_hashing_1e4_per_second": str,
                "online_no_throttling_10_per_second": str,
                "online_throttling_100_per_hour": str
            },
            "guesses": int (estimated number of guesses to crack)
        }

    Score interpretation:
        0: Too guessable (risky password, < 10^3 guesses)
        1: Very guessable (protection from throttled online attacks, < 10^6 guesses)
        2: Somewhat guessable (protection from unthrottled online attacks, < 10^8 guesses)
        3: Safely unguessable (moderate protection from offline slow-hash scenario, < 10^10 guesses)
        4: Very unguessable (strong protection from offline fast-hash scenario, >= 10^10 guesses)
    """
    result = zxcvbn(password, user_inputs=user_inputs or [])

    return {
        "score": result["score"],
        "feedback": result["feedback"],
        "crack_times_display": result["crack_times_display"],
        "guesses": result["guesses"],
    }


def validate_password_strength(
    password: str,
    user_inputs: Optional[list] = None,
    min_strength_score: int = 2
) -> dict:
    """
    Comprehensive password validation combining requirements and strength analysis.

    Args:
        password: Password to validate
        user_inputs: Optional list of user-specific strings (name, email, etc.)
        min_strength_score: Minimum acceptable zxcvbn score (0-4, default: 2)

    Returns:
        Dictionary with validation results:
        {
            "valid": bool,
            "errors": list[str],
            "warnings": list[str],
            "strength": dict (from calculate_password_strength),
            "requirements_met": dict (from check_password_requirements)
        }
    """
    result = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "strength": None,
        "requirements_met": None,
    }

    # Step 1: Check basic requirements
    requirements_check = check_password_requirements(password)
    result["requirements_met"] = requirements_check["requirements_met"]

    if not requirements_check["valid"]:
        result["valid"] = False
        result["errors"].extend(requirements_check["errors"])
        return result  # Don't proceed if basic requirements not met

    # Step 2: Check against common passwords
    if check_common_password(password):
        result["valid"] = False
        result["errors"].append("This password is too common. Please choose a more unique password.")
        return result

    # Step 3: Calculate strength using zxcvbn
    strength = calculate_password_strength(password, user_inputs)
    result["strength"] = strength

    # Check if strength meets minimum score
    if strength["score"] < min_strength_score:
        result["valid"] = False
        result["errors"].append(
            f"Password is too weak (strength score: {strength['score']}/4, minimum required: {min_strength_score}/4)"
        )

        # Add specific feedback from zxcvbn
        if strength["feedback"]["warning"]:
            result["errors"].append(f"Warning: {strength['feedback']['warning']}")

        if strength["feedback"]["suggestions"]:
            result["warnings"].extend(strength["feedback"]["suggestions"])

    # Add helpful warnings even for valid passwords
    if result["valid"] and strength["feedback"]["suggestions"]:
        result["warnings"].extend(strength["feedback"]["suggestions"])

    return result


def validate_password(
    password: str,
    user_inputs: Optional[list] = None,
    min_strength_score: int = 2
) -> str:
    """
    Simple password validation function for use in API endpoints.

    Raises PasswordValidationError if validation fails.

    Args:
        password: Password to validate
        user_inputs: Optional list of user-specific strings (name, email, etc.)
        min_strength_score: Minimum acceptable zxcvbn score (0-4, default: 2)

    Returns:
        The validated password (unchanged)

    Raises:
        PasswordValidationError: If password fails validation

    Example:
        >>> try:
        ...     validate_password("weak", ["user@example.com", "User Name"])
        ... except PasswordValidationError as e:
        ...     print(f"Validation failed: {e}")
    """
    result = validate_password_strength(password, user_inputs, min_strength_score)

    if not result["valid"]:
        error_messages = result["errors"]
        if result["warnings"]:
            error_messages.extend(["Suggestions: " + "; ".join(result["warnings"])])
        raise PasswordValidationError(" | ".join(error_messages))

    return password


# Async version for FastAPI endpoints
async def validate_password_async(
    password: str,
    user_inputs: Optional[list] = None,
    min_strength_score: int = 2
) -> str:
    """
    Async wrapper for validate_password (keeps API consistent).

    Args:
        password: Password to validate
        user_inputs: Optional list of user-specific strings
        min_strength_score: Minimum acceptable zxcvbn score (0-4, default: 2)

    Returns:
        The validated password

    Raises:
        PasswordValidationError: If password fails validation
    """
    # zxcvbn is CPU-bound, but fast enough for inline execution
    # For very high-traffic scenarios, consider running in thread pool
    return validate_password(password, user_inputs, min_strength_score)


def get_password_strength_label(score: int) -> str:
    """
    Get human-readable label for zxcvbn score.

    Args:
        score: zxcvbn score (0-4)

    Returns:
        Label string: "Very Weak", "Weak", "Fair", "Strong", or "Very Strong"
    """
    labels = {
        0: "Very Weak",
        1: "Weak",
        2: "Fair",
        3: "Strong",
        4: "Very Strong",
    }
    return labels.get(score, "Unknown")


if __name__ == "__main__":
    # Test cases
    test_passwords = [
        ("password", ["user@example.com"]),  # Common password
        ("Pass123", ["user@example.com"]),  # Too short
        ("Password123", ["user@example.com"]),  # Missing special char
        ("P@ssw0rd", ["user@example.com"]),  # Common pattern
        ("MyP@ssw0rd2024!", ["user@example.com"]),  # Good
        ("correct horse battery staple", []),  # Famous xkcd password
        ("J0hn.D0e@2024", ["John Doe", "john.doe@example.com"]),  # Contains user data
        ("x7$mK9#pL2qR5&vN", []),  # Very strong random
    ]

    print("Password Strength Validation Tests:")
    print("=" * 80)

    for password, user_inputs in test_passwords:
        result = validate_password_strength(password, user_inputs, min_strength_score=2)

        print(f"\nPassword: {'*' * len(password)}")  # Don't print actual password
        print(f"Valid: {result['valid']}")

        if result['strength']:
            score = result['strength']['score']
            print(f"Strength: {score}/4 ({get_password_strength_label(score)})")
            print(f"Time to crack (offline slow): {result['strength']['crack_times_display']['offline_slow_hashing_1e4_per_second']}")

        if result['errors']:
            print(f"Errors: {result['errors']}")

        if result['warnings']:
            print(f"Suggestions: {result['warnings']}")

        print(f"Requirements met: {result['requirements_met']}")
