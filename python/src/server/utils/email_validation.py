"""
Email validation utilities for Archon User Management System.

Provides comprehensive email validation:
- Format validation (handled by pydantic EmailStr)
- DNS MX record checking
- Disposable email domain blocking
"""

import re
from typing import Optional

import dns.resolver
from pydantic import EmailStr, ValidationError


# Comprehensive list of disposable email domains
# Source: https://github.com/disposable-email-domains/disposable-email-domains
DISPOSABLE_EMAIL_DOMAINS = {
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
    "tempmail.com",
    "throwaway.email",
    "yopmail.com",
    "temp-mail.org",
    "getairmail.com",
    "fakeinbox.com",
    "trashmail.com",
    "maildrop.cc",
    "sharklasers.com",
    "grr.la",
    "guerrillamail.biz",
    "guerrillamail.org",
    "spam4.me",
    "tempr.email",
    "tempmail.ninja",
    "moakt.com",
    "mohmal.com",
    "emailondeck.com",
    "mintemail.com",
    "mytemp.email",
    "dispostable.com",
    "mailnesia.com",
    "mailnator.com",
    "emailsensei.com",
    "harakirimail.com",
    "incognitomail.org",
    "minbox.com",
    "zetmail.com",
    "throwawaymail.com",
    "spambox.us",
    "discard.email",
    "fakemail.fr",
    "nospam.ze.tc",
    "tempinbox.com",
    "thrma.com",
    "tempemail.net",
    "tempmail.de",
    "tafmail.com",
    "getnada.com",
    "mailtemp.info",
    "10mail.org",
    "20minutemail.com",
    "33mail.com",
    "anonbox.net",
    "binkmail.com",
    "bobmail.info",
    "bugmenot.com",
    "deadaddress.com",
    "e4ward.com",
    "emailias.com",
    "fastmail.fm",
    "filzmail.com",
    "haltospam.com",
    "hidemail.de",
    "jetable.org",
    "jourrapide.com",
    "mailin8r.com",
    "meltmail.com",
    "mytrashmail.com",
    "netmails.net",
    "no-spam.ws",
    "nospamthanks.info",
    "nowmymail.com",
    "rtrtr.com",
    "s0ny.net",
    "safe-mail.net",
    "selfdestructingmail.com",
    "spambog.com",
    "spamfree24.org",
    "spamgourmet.com",
    "supermailer.jp",
    "tagyourself.com",
    "teleworm.us",
    "tempalias.com",
    "temporaryemail.net",
    "tempsky.com",
    "trashemail.de",
    "trash-mail.com",
    "trillianpro.com",
    "twinmail.de",
    "upliftnow.com",
    "wegwerfmail.de",
    "yopmail.fr",
    "zetmail.com",
    "zippymail.info",
    # Add more as needed
}


class EmailValidationError(Exception):
    """Custom exception for email validation failures"""
    pass


def validate_email_format(email: str) -> str:
    """
    Validate email format using Pydantic's EmailStr.

    Args:
        email: Email address to validate

    Returns:
        Validated email address (lowercased)

    Raises:
        EmailValidationError: If email format is invalid
    """
    try:
        # Pydantic EmailStr validates format and normalizes to lowercase
        validated = EmailStr._validate(email)
        return validated
    except ValidationError as e:
        raise EmailValidationError(f"Invalid email format: {str(e)}")


def check_mx_records(email: str) -> bool:
    """
    Check if the email domain has valid MX (Mail Exchange) records.

    This verifies that the domain can actually receive emails.

    Args:
        email: Email address to check

    Returns:
        True if domain has MX records, False otherwise

    Note:
        - This performs a DNS lookup which may take 1-2 seconds
        - Should be cached or rate-limited in production
        - Network errors are treated as "valid" to avoid false rejections
    """
    domain = email.split('@')[1]

    try:
        # Query MX records for the domain
        mx_records = dns.resolver.resolve(domain, 'MX')
        return len(mx_records) > 0
    except dns.resolver.NXDOMAIN:
        # Domain doesn't exist
        return False
    except dns.resolver.NoAnswer:
        # Domain exists but has no MX records
        # Check if domain has A/AAAA records (can receive mail directly)
        try:
            dns.resolver.resolve(domain, 'A')
            return True
        except Exception:
            try:
                dns.resolver.resolve(domain, 'AAAA')
                return True
            except Exception:
                return False
    except Exception:
        # Network error, DNS timeout, etc.
        # Return True to avoid false rejections during network issues
        return True


def is_disposable_email(email: str) -> bool:
    """
    Check if the email address uses a known disposable email domain.

    Args:
        email: Email address to check

    Returns:
        True if email uses disposable domain, False otherwise
    """
    domain = email.split('@')[1].lower()
    return domain in DISPOSABLE_EMAIL_DOMAINS


def validate_email_comprehensive(
    email: str,
    check_mx: bool = True,
    block_disposable: bool = True
) -> dict:
    """
    Perform comprehensive email validation.

    Args:
        email: Email address to validate
        check_mx: Whether to check DNS MX records (default: True)
        block_disposable: Whether to block disposable email domains (default: True)

    Returns:
        Dictionary with validation results:
        {
            "valid": bool,
            "email": str (normalized),
            "errors": list[str],
            "warnings": list[str]
        }

    Example:
        >>> result = validate_email_comprehensive("user@example.com")
        >>> if result["valid"]:
        ...     print(f"Valid email: {result['email']}")
        ... else:
        ...     print(f"Errors: {result['errors']}")
    """
    result = {
        "valid": True,
        "email": email.lower(),
        "errors": [],
        "warnings": []
    }

    # Step 1: Format validation
    try:
        result["email"] = validate_email_format(email)
    except EmailValidationError as e:
        result["valid"] = False
        result["errors"].append(str(e))
        return result  # No point checking further

    # Step 2: Check disposable domains
    if block_disposable and is_disposable_email(result["email"]):
        result["valid"] = False
        result["errors"].append("Disposable email addresses are not allowed")
        return result

    # Step 3: Check MX records (optional, can be slow)
    if check_mx:
        has_mx = check_mx_records(result["email"])
        if not has_mx:
            result["valid"] = False
            result["errors"].append("Email domain has no valid mail server (MX records)")
        else:
            result["warnings"].append("MX records verified")

    return result


def validate_email(email: str) -> str:
    """
    Simple email validation function for use in API endpoints.

    Raises EmailValidationError if validation fails.

    Args:
        email: Email address to validate

    Returns:
        Validated and normalized email address

    Raises:
        EmailValidationError: If email fails validation
    """
    result = validate_email_comprehensive(email, check_mx=True, block_disposable=True)

    if not result["valid"]:
        raise EmailValidationError("; ".join(result["errors"]))

    return result["email"]


# Async version for FastAPI endpoints
async def validate_email_async(email: str) -> str:
    """
    Async wrapper for validate_email (DNS lookup is sync, but this keeps API consistent).

    Args:
        email: Email address to validate

    Returns:
        Validated and normalized email address

    Raises:
        EmailValidationError: If email fails validation
    """
    # Note: dnspython doesn't have async support, so we run sync version
    # For production, consider using aiodns or running in thread pool
    return validate_email(email)


if __name__ == "__main__":
    # Test cases
    test_emails = [
        "user@example.com",
        "invalid-email",
        "test@mailinator.com",
        "admin@nonexistent-domain-12345.com",
        "Test.User+tag@Gmail.COM",
    ]

    print("Email Validation Tests:")
    print("=" * 60)

    for email in test_emails:
        result = validate_email_comprehensive(email, check_mx=False)  # Skip MX for tests
        print(f"\nEmail: {email}")
        print(f"Valid: {result['valid']}")
        print(f"Normalized: {result['email']}")
        if result['errors']:
            print(f"Errors: {result['errors']}")
        if result['warnings']:
            print(f"Warnings: {result['warnings']}")
