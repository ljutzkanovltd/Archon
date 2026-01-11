#!/bin/bash
set -e

# Authenticate gh CLI using GH_TOKEN environment variable
if [ -n "$GH_TOKEN" ]; then
    echo "Authenticating GitHub CLI with GH_TOKEN..."
    echo "$GH_TOKEN" | gh auth login --with-token

    # Verify authentication succeeded
    if gh auth status &>/dev/null; then
        echo "✓ GitHub CLI authenticated successfully"
    else
        echo "✗ GitHub CLI authentication failed"
        exit 1
    fi
else
    echo "WARNING: GH_TOKEN not set - GitHub operations will fail for private repos"
fi

# Start the application
exec "$@"
