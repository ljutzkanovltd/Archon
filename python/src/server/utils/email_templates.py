"""
Email templates for Archon User Management System.

HTML email templates with responsive design for:
- Welcome emails (registration)
- Password reset emails
- Organization invitation emails
- Email verification
"""

from typing import Optional


def get_base_template(content: str, preheader: str = "") -> str:
    """
    Base email template with responsive design.

    Args:
        content: HTML content to insert
        preheader: Optional preheader text (visible in email preview)

    Returns:
        Complete HTML email
    """
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Archon</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }}
        .email-container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
        }}
        .content {{
            padding: 40px 30px;
            color: #333333;
            line-height: 1.6;
        }}
        .content p {{
            margin: 0 0 16px 0;
        }}
        .button {{
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }}
        .footer {{
            padding: 30px;
            text-align: center;
            color: #666666;
            font-size: 14px;
            border-top: 1px solid #e0e0e0;
        }}
        .footer a {{
            color: #667eea;
            text-decoration: none;
        }}
        .code-box {{
            background-color: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: 600;
            text-align: center;
            letter-spacing: 4px;
            color: #667eea;
        }}
        .info-box {{
            background-color: #f0f7ff;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .warning-box {{
            background-color: #fff4e6;
            border-left: 4px solid #ff9800;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        @media only screen and (max-width: 600px) {{
            .email-container {{
                width: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
            }}
            .content {{
                padding: 30px 20px !important;
            }}
        }}
    </style>
</head>
<body>
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        {preheader}
    </div>
    <div class="email-container">
        <div class="header">
            <h1>Archon</h1>
        </div>
        <div class="content">
            {content}
        </div>
        <div class="footer">
            <p>© 2026 Archon. All rights reserved.</p>
            <p>
                <a href="https://archon.dev">Website</a> ·
                <a href="https://archon.dev/docs">Documentation</a> ·
                <a href="https://archon.dev/support">Support</a>
            </p>
        </div>
    </div>
</body>
</html>
    """.strip()


def welcome_email(
    user_name: str,
    user_email: str,
    organization_name: str,
    verification_link: Optional[str] = None,
) -> str:
    """
    Generate welcome email HTML for new user registration.

    Args:
        user_name: User's full name
        user_email: User's email address
        organization_name: Name of created organization
        verification_link: Optional email verification URL

    Returns:
        HTML email content
    """
    verification_section = ""
    if verification_link:
        verification_section = f"""
        <div class="info-box">
            <p><strong>📧 Verify your email address</strong></p>
            <p>Please verify your email to unlock all features:</p>
            <a href="{verification_link}" class="button">Verify Email Address</a>
            <p style="font-size: 14px; color: #666;">Or copy this link:<br>
            <span style="word-break: break-all;">{verification_link}</span></p>
        </div>
        """

    content = f"""
    <h2>Welcome to Archon, {user_name}! 🎉</h2>
    <p>Your account has been successfully created. We're excited to have you on board!</p>

    <p><strong>Account Details:</strong></p>
    <ul>
        <li><strong>Email:</strong> {user_email}</li>
        <li><strong>Organization:</strong> {organization_name}</li>
        <li><strong>Role:</strong> Owner</li>
    </ul>

    {verification_section}

    <p><strong>What's Next?</strong></p>
    <ul>
        <li>Explore your organization dashboard</li>
        <li>Invite team members to collaborate</li>
        <li>Set up your project workflows</li>
        <li>Configure integration settings</li>
    </ul>

    <p>If you have any questions or need assistance, our support team is here to help.</p>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = f"Welcome to Archon! Your account for {organization_name} is ready."
    return get_base_template(content, preheader)


def password_reset_email(
    user_name: str,
    reset_link: str,
    reset_code: Optional[str] = None,
    expiry_minutes: int = 60,
) -> str:
    """
    Generate password reset email HTML.

    Args:
        user_name: User's full name
        reset_link: Password reset URL
        reset_code: Optional reset code (for code-based reset)
        expiry_minutes: Link expiration time in minutes

    Returns:
        HTML email content
    """
    code_section = ""
    if reset_code:
        code_section = f"""
        <p><strong>Or use this reset code:</strong></p>
        <div class="code-box">{reset_code}</div>
        <p style="font-size: 14px; color: #666; text-align: center;">
            Enter this code on the password reset page
        </p>
        """

    content = f"""
    <h2>Password Reset Request</h2>
    <p>Hello {user_name},</p>
    <p>We received a request to reset your password for your Archon account. Click the button below to create a new password:</p>

    <a href="{reset_link}" class="button">Reset Password</a>

    <p style="font-size: 14px; color: #666;">Or copy this link into your browser:<br>
    <span style="word-break: break-all;">{reset_link}</span></p>

    {code_section}

    <div class="warning-box">
        <p style="margin: 0;"><strong>⏰ This link expires in {expiry_minutes} minutes</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 14px;">For security reasons, this password reset link is only valid for {expiry_minutes} minutes.</p>
    </div>

    <div class="info-box">
        <p style="margin: 0;"><strong>🔒 Security Notice</strong></p>
        <p style="margin: 8px 0 0 0;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = "Reset your Archon password - link expires in 60 minutes"
    return get_base_template(content, preheader)


def password_reset_success_email(user_name: str) -> str:
    """
    Generate password reset success confirmation email.

    Args:
        user_name: User's full name

    Returns:
        HTML email content
    """
    content = f"""
    <h2>Password Successfully Changed ✓</h2>
    <p>Hello {user_name},</p>
    <p>Your Archon account password has been successfully changed.</p>

    <div class="info-box">
        <p style="margin: 0;"><strong>🔒 Security Information</strong></p>
        <p style="margin: 8px 0 0 0;">
            <strong>Changed:</strong> Just now<br>
            <strong>IP Address:</strong> [Will be populated by backend]<br>
            <strong>Device:</strong> [Will be populated by backend]
        </p>
    </div>

    <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Didn't make this change?</strong></p>
        <p style="margin: 8px 0 0 0;">If you didn't change your password, someone else may have accessed your account. Please contact our support team immediately.</p>
        <a href="mailto:support@archon.dev" class="button">Contact Support</a>
    </div>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = "Your Archon password has been changed successfully"
    return get_base_template(content, preheader)


def organization_invitation_email(
    invitee_name: str,
    inviter_name: str,
    organization_name: str,
    role: str,
    invitation_link: str,
    expiry_days: int = 7,
) -> str:
    """
    Generate organization invitation email HTML.

    Args:
        invitee_name: Name of person being invited
        inviter_name: Name of person sending invitation
        organization_name: Organization name
        role: Role being assigned (Owner, Admin, Member)
        invitation_link: Invitation acceptance URL
        expiry_days: Invitation expiration in days

    Returns:
        HTML email content
    """
    content = f"""
    <h2>You've been invited to join {organization_name} 🎉</h2>
    <p>Hello {invitee_name},</p>
    <p><strong>{inviter_name}</strong> has invited you to join <strong>{organization_name}</strong> on Archon.</p>

    <div class="info-box">
        <p style="margin: 0;"><strong>Invitation Details</strong></p>
        <p style="margin: 8px 0 0 0;">
            <strong>Organization:</strong> {organization_name}<br>
            <strong>Your Role:</strong> {role}<br>
            <strong>Invited by:</strong> {inviter_name}
        </p>
    </div>

    <p>Accept the invitation to start collaborating:</p>
    <a href="{invitation_link}" class="button">Accept Invitation</a>

    <p style="font-size: 14px; color: #666;">Or copy this link:<br>
    <span style="word-break: break-all;">{invitation_link}</span></p>

    <div class="warning-box">
        <p style="margin: 0;"><strong>⏰ This invitation expires in {expiry_days} days</strong></p>
    </div>

    <p><strong>What is Archon?</strong></p>
    <p>Archon is a knowledge base and task management platform designed for AI-assisted development workflows. Join {organization_name} to collaborate on projects, manage tasks, and leverage AI assistance.</p>

    <p>Questions? Feel free to reach out to {inviter_name} or our support team.</p>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = f"{inviter_name} invited you to join {organization_name} on Archon"
    return get_base_template(content, preheader)


def invitation_email(
    to_email: str,
    invitation_token: str,
    invited_by_name: str,
    custom_message: Optional[str] = None,
) -> dict:
    """
    Generate user invitation email.

    Args:
        to_email: Email address of invitee
        invitation_token: Invitation token for registration link
        invited_by_name: Name of admin who sent invitation
        custom_message: Optional custom message from admin

    Returns:
        Dict with subject, html, and text keys
    """
    # TODO: Update this URL to match your frontend registration page
    invitation_link = f"http://localhost:3738/register?token={invitation_token}"

    custom_section = ""
    if custom_message:
        custom_section = f"""
        <div class="info-box">
            <p style="margin: 0;"><strong>Message from {invited_by_name}:</strong></p>
            <p style="margin: 8px 0 0 0; font-style: italic;">"{custom_message}"</p>
        </div>
        """

    content = f"""
    <h2>You've been invited to join Archon! 🎉</h2>
    <p>Hello,</p>
    <p><strong>{invited_by_name}</strong> has invited you to join Archon, an AI-powered knowledge base and task management platform.</p>

    {custom_section}

    <p>Click the button below to create your account:</p>
    <a href="{invitation_link}" class="button">Create Account</a>

    <p style="font-size: 14px; color: #666;">Or copy this link into your browser:<br>
    <span style="word-break: break-all;">{invitation_link}</span></p>

    <div class="warning-box">
        <p style="margin: 0;"><strong>⏰ This invitation expires in 7 days</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 14px;">Please accept the invitation within 7 days to join Archon.</p>
    </div>

    <p><strong>What is Archon?</strong></p>
    <p>Archon is a knowledge base and task management platform designed for AI-assisted development workflows. Features include:</p>
    <ul style="margin: 8px 0; padding-left: 20px;">
        <li>Project and task management</li>
        <li>AI-powered knowledge base with semantic search</li>
        <li>MCP (Model Context Protocol) integration</li>
        <li>Collaborative development tools</li>
    </ul>

    <p>Questions? Feel free to reach out to {invited_by_name} or our support team.</p>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = f"{invited_by_name} invited you to join Archon"
    html = get_base_template(content, preheader)

    # Plain text version
    text = f"""
You've been invited to join Archon!

{invited_by_name} has invited you to join Archon, an AI-powered knowledge base and task management platform.

{f'Message: {custom_message}' if custom_message else ''}

Create your account here:
{invitation_link}

This invitation expires in 7 days.

What is Archon?
Archon is a knowledge base and task management platform designed for AI-assisted development workflows.

Best regards,
The Archon Team
    """.strip()

    return {
        "subject": f"You've been invited to join Archon by {invited_by_name}",
        "html": html,
        "text": text,
    }


def email_verification_email(
    user_name: str,
    verification_link: str,
    verification_code: Optional[str] = None,
) -> str:
    """
    Generate email verification email HTML.

    Args:
        user_name: User's full name
        verification_link: Email verification URL
        verification_code: Optional verification code

    Returns:
        HTML email content
    """
    code_section = ""
    if verification_code:
        code_section = f"""
        <p><strong>Or use this verification code:</strong></p>
        <div class="code-box">{verification_code}</div>
        <p style="font-size: 14px; color: #666; text-align: center;">
            Enter this code to verify your email
        </p>
        """

    content = f"""
    <h2>Verify Your Email Address</h2>
    <p>Hello {user_name},</p>
    <p>Thanks for signing up for Archon! Please verify your email address to complete your registration and unlock all features.</p>

    <a href="{verification_link}" class="button">Verify Email Address</a>

    <p style="font-size: 14px; color: #666;">Or copy this link:<br>
    <span style="word-break: break-all;">{verification_link}</span></p>

    {code_section}

    <div class="info-box">
        <p style="margin: 0;"><strong>Why verify?</strong></p>
        <p style="margin: 8px 0 0 0;">Email verification helps us:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            <li>Ensure account security</li>
            <li>Enable password recovery</li>
            <li>Send important notifications</li>
        </ul>
    </div>

    <p>If you didn't create an Archon account, you can safely ignore this email.</p>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = "Verify your Archon email address to get started"
    return get_base_template(content, preheader)


def email_change_verification_email(
    user_name: str,
    current_email: str,
    new_email: str,
    verification_link: str,
    verification_code: Optional[str] = None,
    expiry_minutes: int = 60,
) -> str:
    """
    Generate email change verification email HTML.

    Args:
        user_name: User's full name
        current_email: User's current email address
        new_email: New email address to be verified
        verification_link: Email verification URL
        verification_code: Optional verification code
        expiry_minutes: Link expiration time in minutes

    Returns:
        HTML email content
    """
    code_section = ""
    if verification_code:
        code_section = f"""
        <p><strong>Or use this verification code:</strong></p>
        <div class="code-box">{verification_code}</div>
        <p style="font-size: 14px; color: #666; text-align: center;">
            Enter this code to verify your new email
        </p>
        """

    content = f"""
    <h2>Verify Your New Email Address</h2>
    <p>Hello {user_name},</p>
    <p>We received a request to change your email address for your Archon account.</p>

    <div class="info-box">
        <p style="margin: 0;"><strong>Email Change Request</strong></p>
        <p style="margin: 8px 0 0 0;">
            <strong>Current Email:</strong> {current_email}<br>
            <strong>New Email:</strong> {new_email}
        </p>
    </div>

    <p>To complete the email change, please verify your new email address by clicking the button below:</p>

    <a href="{verification_link}" class="button">Verify New Email</a>

    <p style="font-size: 14px; color: #666;">Or copy this link into your browser:<br>
    <span style="word-break: break-all;">{verification_link}</span></p>

    {code_section}

    <div class="warning-box">
        <p style="margin: 0;"><strong>⏰ This link expires in {expiry_minutes} minutes</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 14px;">For security reasons, this verification link is only valid for {expiry_minutes} minutes.</p>
    </div>

    <div class="info-box">
        <p style="margin: 0;"><strong>🔒 Security Notice</strong></p>
        <p style="margin: 8px 0 0 0;">If you didn't request an email change, you can safely ignore this email. Your email address will remain unchanged.</p>
        <p style="margin: 8px 0 0 0;">If you're concerned about unauthorized access, please contact our support team immediately.</p>
    </div>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = f"Verify your new email address: {new_email}"
    return get_base_template(content, preheader)


def email_change_success_email(
    user_name: str,
    old_email: str,
    new_email: str,
) -> str:
    """
    Generate email change success confirmation email.

    Args:
        user_name: User's full name
        old_email: Previous email address
        new_email: New email address

    Returns:
        HTML email content
    """
    content = f"""
    <h2>Email Address Changed Successfully ✓</h2>
    <p>Hello {user_name},</p>
    <p>Your Archon account email address has been successfully changed.</p>

    <div class="info-box">
        <p style="margin: 0;"><strong>✅ Email Change Confirmed</strong></p>
        <p style="margin: 8px 0 0 0;">
            <strong>Previous Email:</strong> {old_email}<br>
            <strong>New Email:</strong> {new_email}<br>
            <strong>Changed:</strong> Just now
        </p>
    </div>

    <p><strong>What happens next?</strong></p>
    <ul>
        <li>All future emails will be sent to <strong>{new_email}</strong></li>
        <li>Use <strong>{new_email}</strong> to sign in to your account</li>
        <li>Your previous email address is no longer associated with this account</li>
    </ul>

    <div class="warning-box">
        <p style="margin: 0;"><strong>⚠️ Didn't make this change?</strong></p>
        <p style="margin: 8px 0 0 0;">If you didn't change your email address, someone else may have accessed your account. Please contact our support team immediately.</p>
        <a href="mailto:support@archon.dev" class="button">Contact Support</a>
    </div>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = "Your Archon email address has been changed successfully"
    return get_base_template(content, preheader)


def test_email(recipient_name: str = "User") -> str:
    """
    Generate test email for service verification.

    Args:
        recipient_name: Name of recipient

    Returns:
        HTML email content
    """
    content = f"""
    <h2>Email Service Test ✓</h2>
    <p>Hello {recipient_name},</p>
    <p>This is a test email from Archon to verify that the email service is working correctly.</p>

    <div class="info-box">
        <p style="margin: 0;"><strong>✅ Email Service Status: Operational</strong></p>
        <p style="margin: 8px 0 0 0;">If you're seeing this email, the email service is configured correctly and ready to send emails.</p>
    </div>

    <p><strong>Service Details:</strong></p>
    <ul>
        <li>Email delivery: Working</li>
        <li>Template rendering: Working</li>
        <li>HTML formatting: Working</li>
    </ul>

    <p>You can safely delete this test email.</p>

    <p>Best regards,<br><strong>The Archon Team</strong></p>
    """

    preheader = "Archon Email Service Test - Service is operational"
    return get_base_template(content, preheader)
