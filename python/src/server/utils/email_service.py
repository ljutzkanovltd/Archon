"""
Email service for Archon User Management System.

Supports multiple email providers:
- Resend (recommended, modern API)
- SendGrid (enterprise-grade)
- SMTP (fallback for any provider)

Configuration via environment variables.
"""

import logging
import os
from enum import Enum
from typing import Optional

import httpx
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)


class EmailProvider(str, Enum):
    """Supported email providers"""
    RESEND = "resend"
    SENDGRID = "sendgrid"
    SMTP = "smtp"


class EmailConfig(BaseModel):
    """Email service configuration"""
    provider: EmailProvider
    from_email: EmailStr
    from_name: str
    api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True


class EmailMessage(BaseModel):
    """Email message structure"""
    to_email: EmailStr
    to_name: Optional[str] = None
    subject: str
    html_content: str
    text_content: Optional[str] = None


class EmailServiceError(Exception):
    """Custom exception for email service errors"""
    pass


class EmailService:
    """
    Unified email service supporting multiple providers.

    Usage:
        service = EmailService.from_env()
        await service.send_email(
            to_email="user@example.com",
            to_name="John Doe",
            subject="Welcome",
            html_content="<h1>Welcome!</h1>"
        )
    """

    def __init__(self, config: EmailConfig):
        """
        Initialize email service with configuration.

        Args:
            config: EmailConfig instance with provider settings
        """
        self.config = config
        self._validate_config()

    @classmethod
    def from_env(cls) -> "EmailService":
        """
        Create EmailService from environment variables.

        Required environment variables:
            EMAIL_PROVIDER: resend|sendgrid|smtp
            EMAIL_FROM: sender email address
            EMAIL_FROM_NAME: sender display name

        Provider-specific:
            Resend:
                RESEND_API_KEY: API key from resend.com
            SendGrid:
                SENDGRID_API_KEY: API key from sendgrid.com
            SMTP:
                SMTP_HOST: SMTP server host
                SMTP_PORT: SMTP server port
                SMTP_USERNAME: SMTP username
                SMTP_PASSWORD: SMTP password
                SMTP_USE_TLS: true/false (default: true)

        Returns:
            EmailService instance

        Raises:
            EmailServiceError: If configuration is invalid
        """
        provider_str = os.getenv("EMAIL_PROVIDER", "").lower()
        if not provider_str:
            raise EmailServiceError(
                "EMAIL_PROVIDER not set. "
                "Set to 'resend', 'sendgrid', or 'smtp'"
            )

        try:
            provider = EmailProvider(provider_str)
        except ValueError:
            raise EmailServiceError(
                f"Invalid EMAIL_PROVIDER: {provider_str}. "
                f"Must be one of: resend, sendgrid, smtp"
            )

        from_email = os.getenv("EMAIL_FROM")
        if not from_email:
            raise EmailServiceError("EMAIL_FROM not set")

        from_name = os.getenv("EMAIL_FROM_NAME", "Archon")

        config = EmailConfig(
            provider=provider,
            from_email=from_email,
            from_name=from_name,
        )

        # Provider-specific configuration
        if provider == EmailProvider.RESEND:
            config.api_key = os.getenv("RESEND_API_KEY")
            if not config.api_key:
                raise EmailServiceError("RESEND_API_KEY not set for Resend provider")

        elif provider == EmailProvider.SENDGRID:
            config.api_key = os.getenv("SENDGRID_API_KEY")
            if not config.api_key:
                raise EmailServiceError("SENDGRID_API_KEY not set for SendGrid provider")

        elif provider == EmailProvider.SMTP:
            config.smtp_host = os.getenv("SMTP_HOST")
            config.smtp_port = int(os.getenv("SMTP_PORT", "587"))
            config.smtp_username = os.getenv("SMTP_USERNAME")
            config.smtp_password = os.getenv("SMTP_PASSWORD")
            config.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

            if not config.smtp_host:
                raise EmailServiceError("SMTP_HOST not set for SMTP provider")
            if not config.smtp_username or not config.smtp_password:
                raise EmailServiceError("SMTP_USERNAME and SMTP_PASSWORD required for SMTP provider")

        return cls(config)

    def _validate_config(self):
        """Validate configuration based on provider"""
        if self.config.provider == EmailProvider.RESEND and not self.config.api_key:
            raise EmailServiceError("API key required for Resend")
        elif self.config.provider == EmailProvider.SENDGRID and not self.config.api_key:
            raise EmailServiceError("API key required for SendGrid")
        elif self.config.provider == EmailProvider.SMTP:
            if not self.config.smtp_host or not self.config.smtp_username:
                raise EmailServiceError("SMTP configuration incomplete")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        to_name: Optional[str] = None,
        text_content: Optional[str] = None,
    ) -> dict:
        """
        Send email using configured provider.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email body
            to_name: Optional recipient name
            text_content: Optional plain text fallback

        Returns:
            dict with status and provider-specific response

        Raises:
            EmailServiceError: If sending fails
        """
        message = EmailMessage(
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            html_content=html_content,
            text_content=text_content or self._html_to_text(html_content),
        )

        logger.info(
            f"Sending email via {self.config.provider.value}: "
            f"to={to_email}, subject='{subject}'"
        )

        try:
            if self.config.provider == EmailProvider.RESEND:
                return await self._send_via_resend(message)
            elif self.config.provider == EmailProvider.SENDGRID:
                return await self._send_via_sendgrid(message)
            elif self.config.provider == EmailProvider.SMTP:
                return await self._send_via_smtp(message)
            else:
                raise EmailServiceError(f"Unsupported provider: {self.config.provider}")
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            raise EmailServiceError(f"Email sending failed: {str(e)}")

    async def _send_via_resend(self, message: EmailMessage) -> dict:
        """Send email via Resend API"""
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": f"{self.config.from_name} <{self.config.from_email}>",
            "to": [message.to_email],
            "subject": message.subject,
            "html": message.html_content,
        }

        if message.text_content:
            payload["text"] = message.text_content

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)

            if response.status_code not in (200, 201):
                raise EmailServiceError(
                    f"Resend API error: {response.status_code} - {response.text}"
                )

            result = response.json()
            logger.info(f"Email sent via Resend: id={result.get('id')}")
            return {
                "success": True,
                "provider": "resend",
                "message_id": result.get("id"),
                "response": result,
            }

    async def _send_via_sendgrid(self, message: EmailMessage) -> dict:
        """Send email via SendGrid API"""
        url = "https://api.sendgrid.com/v3/mail/send"
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        to_obj = {"email": message.to_email}
        if message.to_name:
            to_obj["name"] = message.to_name

        payload = {
            "personalizations": [{"to": [to_obj]}],
            "from": {
                "email": self.config.from_email,
                "name": self.config.from_name,
            },
            "subject": message.subject,
            "content": [
                {"type": "text/html", "value": message.html_content},
            ],
        }

        if message.text_content:
            payload["content"].insert(0, {
                "type": "text/plain",
                "value": message.text_content
            })

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)

            if response.status_code not in (200, 201, 202):
                raise EmailServiceError(
                    f"SendGrid API error: {response.status_code} - {response.text}"
                )

            message_id = response.headers.get("X-Message-Id", "unknown")
            logger.info(f"Email sent via SendGrid: id={message_id}")
            return {
                "success": True,
                "provider": "sendgrid",
                "message_id": message_id,
                "status_code": response.status_code,
            }

    async def _send_via_smtp(self, message: EmailMessage) -> dict:
        """Send email via SMTP (using aiosmtplib)"""
        try:
            import aiosmtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
        except ImportError:
            raise EmailServiceError(
                "aiosmtplib not installed. "
                "Install with: pip install aiosmtplib"
            )

        # Create message
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{self.config.from_name} <{self.config.from_email}>"
        msg["To"] = message.to_email
        msg["Subject"] = message.subject

        # Attach text and HTML parts
        if message.text_content:
            text_part = MIMEText(message.text_content, "plain")
            msg.attach(text_part)

        html_part = MIMEText(message.html_content, "html")
        msg.attach(html_part)

        # Send via SMTP
        try:
            smtp_client = aiosmtplib.SMTP(
                hostname=self.config.smtp_host,
                port=self.config.smtp_port,
                use_tls=self.config.smtp_use_tls,
            )

            await smtp_client.connect()
            await smtp_client.login(self.config.smtp_username, self.config.smtp_password)
            await smtp_client.send_message(msg)
            await smtp_client.quit()

            logger.info(f"Email sent via SMTP: to={message.to_email}")
            return {
                "success": True,
                "provider": "smtp",
                "to": message.to_email,
            }
        except Exception as e:
            raise EmailServiceError(f"SMTP error: {str(e)}")

    @staticmethod
    def _html_to_text(html: str) -> str:
        """
        Convert HTML to plain text (basic implementation).

        For production, consider using libraries like:
        - html2text
        - beautifulsoup4 + get_text()
        """
        import re

        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html)
        # Decode HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text


# Singleton instance for easy access
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """
    Get or create email service singleton.

    Returns:
        EmailService instance

    Raises:
        EmailServiceError: If configuration is invalid
    """
    global _email_service
    if _email_service is None:
        _email_service = EmailService.from_env()
    return _email_service


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    to_name: Optional[str] = None,
    text_content: Optional[str] = None,
) -> dict:
    """
    Convenience function to send email using global service.

    Args:
        to_email: Recipient email
        subject: Email subject
        html_content: HTML body
        to_name: Optional recipient name
        text_content: Optional plain text fallback

    Returns:
        dict with send status
    """
    service = get_email_service()
    return await service.send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        to_name=to_name,
        text_content=text_content,
    )
