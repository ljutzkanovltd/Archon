#!/bin/bash
set -e

# GitHub CLI authentication
# When GH_TOKEN is set, gh CLI uses it automatically - no need to call gh auth login
if [ -n "$GH_TOKEN" ]; then
    echo "GitHub CLI: Using GH_TOKEN from environment"

    # Verify token works
    if gh auth status &>/dev/null; then
        echo "✓ GitHub CLI authenticated successfully"
    else
        echo "⚠️  WARNING: GitHub authentication failed (non-fatal)"
        echo "   GitHub operations may not work for private repositories"
        echo "   Service will continue starting..."
    fi
else
    echo "⚠️  WARNING: GH_TOKEN not set - GitHub operations will fail for private repos"
fi

# Start the application
exec "$@"
