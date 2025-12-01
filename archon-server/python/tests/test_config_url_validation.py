"""
Unit tests for Supabase URL validation functionality.
Tests URL validation including Docker service name detection, private IPs, and HTTPS requirements.
"""

import pytest
from unittest.mock import patch

from src.server.config.config import (
    validate_supabase_url,
    ConfigurationError,
    load_environment_config,
)


class TestDockerServiceNames:
    """Test Docker Compose service name detection."""

    def test_docker_service_with_single_hyphen(self):
        """Docker service names with single hyphen should be allowed with HTTP."""
        assert validate_supabase_url("http://supabase-kong:8000") is True

    def test_docker_service_with_multiple_hyphens(self):
        """Docker service names with multiple hyphens should be allowed with HTTP."""
        assert validate_supabase_url("http://my-service-name:3000") is True
        assert validate_supabase_url("http://redis-master-1:6379") is True

    def test_docker_service_with_port(self):
        """Docker service names with ports should be allowed with HTTP."""
        assert validate_supabase_url("http://supabase-kong:8000") is True
        assert validate_supabase_url("http://postgres-db:5432") is True

    def test_docker_service_without_port(self):
        """Docker service names without ports should be allowed with HTTP."""
        assert validate_supabase_url("http://supabase-kong") is True
        assert validate_supabase_url("http://my-service") is True

    def test_docker_service_with_https(self):
        """Docker service names with HTTPS should be allowed."""
        assert validate_supabase_url("https://supabase-kong:8000") is True
        assert validate_supabase_url("https://my-service:3000") is True


class TestLocalhostAndInternalHosts:
    """Test localhost and Docker internal host validation."""

    def test_localhost_variants(self):
        """Localhost variants should be allowed with HTTP."""
        assert validate_supabase_url("http://localhost:8000") is True
        assert validate_supabase_url("http://127.0.0.1:8000") is True
        assert validate_supabase_url("http://host.docker.internal:8000") is True

    def test_localhost_suffix(self):
        """Hostnames ending with .localhost should be allowed with HTTP."""
        assert validate_supabase_url("http://myapp.localhost:3000") is True
        assert validate_supabase_url("http://test.localhost") is True

    def test_localhost_without_port(self):
        """Localhost without port should be allowed with HTTP."""
        assert validate_supabase_url("http://localhost") is True
        assert validate_supabase_url("http://127.0.0.1") is True

    def test_localhost_with_https(self):
        """Localhost with HTTPS should be allowed."""
        assert validate_supabase_url("https://localhost:8000") is True
        assert validate_supabase_url("https://127.0.0.1:8000") is True


class TestPrivateIPAddresses:
    """Test private IP address validation (RFC 1918)."""

    def test_class_a_private_ips(self):
        """Class A private IPs (10.0.0.0/8) should be allowed with HTTP."""
        assert validate_supabase_url("http://10.0.0.1:8000") is True
        assert validate_supabase_url("http://10.255.255.255:8000") is True
        assert validate_supabase_url("http://10.1.2.3") is True

    def test_class_b_private_ips(self):
        """Class B private IPs (172.16.0.0/12) should be allowed with HTTP."""
        assert validate_supabase_url("http://172.16.0.1:8000") is True
        assert validate_supabase_url("http://172.31.255.255:8000") is True
        assert validate_supabase_url("http://172.20.0.5") is True

    def test_class_c_private_ips(self):
        """Class C private IPs (192.168.0.0/16) should be allowed with HTTP."""
        assert validate_supabase_url("http://192.168.1.1:8000") is True
        assert validate_supabase_url("http://192.168.255.255:8000") is True
        assert validate_supabase_url("http://192.168.0.100") is True

    def test_link_local_ips(self):
        """Link-local IPs (169.254.0.0/16) should be allowed with HTTP."""
        assert validate_supabase_url("http://169.254.1.1:8000") is True
        assert validate_supabase_url("http://169.254.169.254") is True

    def test_loopback_ips(self):
        """Loopback IPs (127.0.0.0/8) should be allowed with HTTP."""
        assert validate_supabase_url("http://127.0.0.1:8000") is True
        assert validate_supabase_url("http://127.0.0.2:8000") is True

    def test_unspecified_address_rejected(self):
        """Unspecified address (0.0.0.0) should be rejected for security."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://0.0.0.0:8000")
        assert "non-local environments" in str(exc_info.value)


class TestPublicDomainHTTPSRequirement:
    """Test that public domains require HTTPS."""

    def test_public_domain_http_rejected(self):
        """Public domains with HTTP should be rejected."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://example.com:8000")
        assert "must use HTTPS" in str(exc_info.value)
        assert "example.com" in str(exc_info.value)

    def test_public_domain_https_accepted(self):
        """Public domains with HTTPS should be accepted."""
        assert validate_supabase_url("https://example.com:8000") is True
        assert validate_supabase_url("https://supabase.co") is True

    def test_subdomain_http_rejected(self):
        """Public subdomains with HTTP should be rejected."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://api.example.com:8000")
        assert "must use HTTPS" in str(exc_info.value)

    def test_subdomain_https_accepted(self):
        """Public subdomains with HTTPS should be accepted."""
        assert validate_supabase_url("https://api.example.com:8000") is True
        assert validate_supabase_url("https://my.supabase.co") is True

    def test_production_supabase_url(self):
        """Real Supabase URLs should require HTTPS."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://myproject.supabase.co")
        assert "must use HTTPS" in str(exc_info.value)

        # But HTTPS should work
        assert validate_supabase_url("https://myproject.supabase.co") is True


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_url_rejected(self):
        """Empty URL should be rejected."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("")
        assert "cannot be empty" in str(exc_info.value)

    def test_invalid_scheme_rejected(self):
        """Invalid schemes should be rejected."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("ftp://example.com:8000")
        assert "must use HTTP or HTTPS" in str(exc_info.value)

        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("ws://example.com:8000")
        assert "must use HTTP or HTTPS" in str(exc_info.value)

    def test_url_without_scheme_rejected(self):
        """URL without scheme should be rejected."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("example.com:8000")
        # urlparse treats this as path, so scheme is empty
        assert "must use HTTP or HTTPS" in str(exc_info.value)

    def test_url_with_path_accepted(self):
        """URL with path should be accepted if base URL is valid."""
        assert validate_supabase_url("http://supabase-kong:8000/rest/v1") is True
        assert validate_supabase_url("https://example.com/api/v1") is True

    def test_url_with_query_params_accepted(self):
        """URL with query parameters should be accepted if base URL is valid."""
        assert validate_supabase_url("http://supabase-kong:8000?apikey=test") is True
        assert validate_supabase_url("https://example.com?param=value") is True


class TestPatternDistinction:
    """Test that Docker service names are distinguished from public domains."""

    def test_hyphenated_public_domain_rejected(self):
        """Public domains with hyphens but also dots should require HTTPS."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://my-app.example.com:8000")
        assert "must use HTTPS" in str(exc_info.value)

        # But HTTPS should work
        assert validate_supabase_url("https://my-app.example.com:8000") is True

    def test_single_word_no_hyphen_rejected(self):
        """Single-word hostnames without hyphens should be rejected (not Docker pattern)."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://myservice:8000")
        assert "must use HTTPS" in str(exc_info.value)

        # Exception: localhost-like names are still allowed
        assert validate_supabase_url("http://localhost:8000") is True

    def test_numeric_only_rejected(self):
        """Numeric-only hostnames should be validated as IPs."""
        # Public IP should require HTTPS
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://8.8.8.8:8000")
        assert "must use HTTPS" in str(exc_info.value)

        # Private IP should be allowed
        assert validate_supabase_url("http://10.0.0.1:8000") is True


class TestConfigurationIntegration:
    """Test URL validation within full configuration loading."""

    def test_config_with_docker_service_url(self):
        """Configuration should accept Docker service name URLs."""
        from jose import jwt
        service_payload = {"role": "service_role", "iss": "supabase"}
        mock_service_key = jwt.encode(service_payload, "secret", algorithm="HS256")

        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "http://supabase-kong:8000",
                "SUPABASE_SERVICE_KEY": mock_service_key,
                "PORT": "8051",
                "OPENAI_API_KEY": "",
            },
        ):
            config = load_environment_config()
            assert config.supabase_url == "http://supabase-kong:8000"

    def test_config_with_private_ip_url(self):
        """Configuration should accept private IP URLs."""
        from jose import jwt
        service_payload = {"role": "service_role", "iss": "supabase"}
        mock_service_key = jwt.encode(service_payload, "secret", algorithm="HS256")

        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "http://172.20.0.5:8000",
                "SUPABASE_SERVICE_KEY": mock_service_key,
                "PORT": "8051",
                "OPENAI_API_KEY": "",
            },
        ):
            config = load_environment_config()
            assert config.supabase_url == "http://172.20.0.5:8000"

    def test_config_with_public_http_url_rejected(self):
        """Configuration should reject public HTTP URLs."""
        from jose import jwt
        service_payload = {"role": "service_role", "iss": "supabase"}
        mock_service_key = jwt.encode(service_payload, "secret", algorithm="HS256")

        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "http://example.com:8000",
                "SUPABASE_SERVICE_KEY": mock_service_key,
                "PORT": "8051",
                "OPENAI_API_KEY": "",
            },
        ):
            with pytest.raises(ConfigurationError) as exc_info:
                load_environment_config()
            assert "must use HTTPS" in str(exc_info.value)

    def test_config_with_production_https_url(self):
        """Configuration should accept production HTTPS URLs."""
        from jose import jwt
        service_payload = {"role": "service_role", "iss": "supabase"}
        mock_service_key = jwt.encode(service_payload, "secret", algorithm="HS256")

        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "https://myproject.supabase.co",
                "SUPABASE_SERVICE_KEY": mock_service_key,
                "PORT": "8051",
                "OPENAI_API_KEY": "",
            },
        ):
            config = load_environment_config()
            assert config.supabase_url == "https://myproject.supabase.co"


class TestErrorMessages:
    """Test that error messages are clear and helpful."""

    def test_error_message_includes_hostname(self):
        """Error messages should include the problematic hostname."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://bad-domain.com:8000")
        error_msg = str(exc_info.value)
        assert "bad-domain.com" in error_msg

    def test_error_message_explains_allowed_patterns(self):
        """Error messages should explain what patterns are allowed."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://example.com:8000")
        error_msg = str(exc_info.value)
        assert "localhost" in error_msg
        assert "private IPs" in error_msg
        assert "Docker service names" in error_msg

    def test_error_message_provides_example(self):
        """Error messages should provide an example of valid Docker service name."""
        with pytest.raises(ConfigurationError) as exc_info:
            validate_supabase_url("http://example.com:8000")
        error_msg = str(exc_info.value)
        assert "supabase-kong" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
