#!/bin/bash
# Install PostgreSQL 17 client tools to fix version mismatch

set -e

echo "Installing PostgreSQL 17 client tools..."
echo ""

# Add PostgreSQL APT repository
echo "Adding PostgreSQL APT repository..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import repository signing key
echo "Importing PostgreSQL repository signing key..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package list
echo "Updating package list..."
sudo apt-get update

# Install PostgreSQL 17 client
echo "Installing postgresql-client-17..."
sudo apt-get install -y postgresql-client-17

# Verify installation
echo ""
echo "Verifying installation..."
/usr/lib/postgresql/17/bin/pg_dump --version

echo ""
echo "✅ PostgreSQL 17 client installed successfully!"
echo ""
echo "To use pg_dump 17, run:"
echo "  /usr/lib/postgresql/17/bin/pg_dump [options]"
echo ""
