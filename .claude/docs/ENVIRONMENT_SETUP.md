# Environment Setup - Archon Knowledge Base

Complete environment configuration, variables, and Supabase setup for Archon services.

---

## Required Environment Variables

### Configuration File Location

Create `config/.env` or `.env` in the Archon root directory.

### Complete .env Template

```env
# OpenAI API (for embeddings - optional)
OPENAI_API_KEY=sk-xxx

# Azure OpenAI Configuration (optional)
# Note: As of December 15, 2025, Azure OpenAI supports separate keys for chat and embeddings
# You can configure:
#   1. Separate keys (recommended): AZURE_OPENAI_CHAT_API_KEY + AZURE_OPENAI_EMBEDDING_API_KEY
#   2. Legacy single key (fallback): AZURE_OPENAI_API_KEY (used for both chat and embeddings)
#
# Chat/LLM Configuration:
AZURE_OPENAI_CHAT_API_KEY=your_chat_api_key
AZURE_OPENAI_CHAT_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=your_deployment_name
#
# Embedding Configuration:
AZURE_OPENAI_EMBEDDING_API_KEY=your_embedding_api_key
AZURE_OPENAI_EMBEDDING_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=your_embedding_deployment_name
#
# Legacy Configuration (fallback if separate keys not provided):
# AZURE_OPENAI_API_KEY=your_api_key
# AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
# AZURE_OPENAI_DEPLOYMENT=your_deployment_name

# Server Configuration
SERVER_PORT=8181         # Backend API port
MCP_PORT=8051           # MCP server port
FRONTEND_PORT=3737      # Dashboard UI port
AGENTS_PORT=8052        # AI agents port (optional)

# Supabase Configuration
SUPABASE_URL=http://localhost:8002
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/archon

# Logging
LOG_LEVEL=info
LOG_FILE=logs/archon.log

# Environment
ENVIRONMENT=development
DEBUG=true
```

---

## Supabase Setup

### Docker Compose Configuration

Supabase services are managed via Docker Compose in local-ai-packaged project.

**Key Services** (from docker-compose.yml):

```yaml
services:
  supabase-db:
    image: supabase/postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres

  supabase-studio:
    image: supabase/studio
    ports:
      - "3001:3000"

  kong:
    image: kong
    ports:
      - "8002:8000"  # API Gateway
```

### Access URLs

- **Supabase Studio**: http://localhost:3001 (database admin UI)
- **Kong Gateway**: http://localhost:8002 (API proxy)
- **PostgreSQL**: localhost:5432 (direct database connection)

### Starting Supabase

```bash
cd ~/Documents/Projects/local-ai-packaged
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# Or Docker Compose directly:
docker compose up -d supabase-ai-db supabase-ai-kong supabase-ai-studio
```

---

## Environment Variable Categories

### 1. AI/Embeddings (Optional)

Used for semantic search and code example generation.

**OpenAI**:
```env
OPENAI_API_KEY=sk-xxx
```

**Azure OpenAI** (Recommended for production):
```env
# Separate keys for chat and embeddings
AZURE_OPENAI_CHAT_API_KEY=your_chat_api_key
AZURE_OPENAI_CHAT_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4-deployment-name

AZURE_OPENAI_EMBEDDING_API_KEY=your_embedding_api_key
AZURE_OPENAI_EMBEDDING_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002-deployment
```

### 2. Server Configuration (Required)

Archon service ports.

```env
SERVER_PORT=8181         # Backend API
MCP_PORT=8051           # MCP Server
FRONTEND_PORT=3737      # Dashboard UI
AGENTS_PORT=8052        # AI Agents (optional)
```

**Note**: These ports must be available on the host machine.

### 3. Supabase Configuration (Required)

Connection to Supabase backend.

```env
# Via Kong Gateway (recommended for API/Auth)
SUPABASE_URL=http://host.docker.internal:18000

# Service key for admin operations
SUPABASE_SERVICE_KEY=eyJh...JWT_token...

# Anon key for public access (optional)
SUPABASE_ANON_KEY=eyJh...JWT_token...
```

### 4. Database Configuration (Required)

Direct PostgreSQL connection.

```env
# Direct connection (recommended)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# Alternative: Via pooler (not recommended - causes tenant errors)
# DATABASE_URI=postgresql://postgres:PASSWORD@host.docker.internal:5432/postgres
```

### 5. Logging Configuration (Optional)

```env
LOG_LEVEL=info            # debug, info, warning, error
LOG_FILE=logs/archon.log  # Log file path
```

### 6. Environment Mode (Optional)

```env
ENVIRONMENT=development   # development, staging, production
DEBUG=true               # Enable debug mode
```

---

## Configuration Best Practices

### Security

1. **Never commit `.env` files** to version control
2. **Use `.env.example`** as a template (with placeholder values)
3. **Rotate secrets** regularly (service keys, API keys)
4. **Use strong passwords** for database credentials

### Organization

```bash
# Create .env from template
cp .env.example .env

# Edit with secure values
nano .env

# Verify configuration
grep -v "^#" .env | grep -v "^$"
```

### Docker-Specific

When running in Docker, use these connection patterns:

**For database** (from Archon containers):
```env
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres
```

**For Supabase API** (from Archon containers):
```env
SUPABASE_URL=http://host.docker.internal:18000
```

---

## Validation

### Check Required Variables

```bash
# Verify critical variables are set
for var in DATABASE_URI SUPABASE_URL SUPABASE_SERVICE_KEY MCP_PORT SERVER_PORT FRONTEND_PORT; do
  if grep -q "^${var}=" .env; then
    echo "✅ $var is set"
  else
    echo "❌ $var is missing"
  fi
done
```

### Test Connections

```bash
# Test database connection
docker exec -it supabase-ai-db psql \
  -U postgres \
  -d postgres \
  -c "SELECT version();"

# Test Kong Gateway
curl http://localhost:18000/health

# Test Supabase Studio
curl -I http://localhost:3001
```

---

## Troubleshooting

### Problem: "Environment variable not set"

**Solution**:
```bash
# 1. Check if .env exists
ls -la .env

# 2. Verify syntax (no spaces around =)
cat .env | grep -v "^#"

# 3. Source the file (for testing)
export $(grep -v '^#' .env | xargs)

# 4. Restart services to load new env
./stop-archon.sh && ./start-archon.sh
```

### Problem: "Invalid Supabase service key"

**Solution**:
```bash
# 1. Get service key from Supabase Studio
# Navigate to: http://localhost:3001 → Settings → API

# 2. Copy "service_role" key (not "anon" key)

# 3. Update .env
# SUPABASE_SERVICE_KEY=eyJh...very_long_JWT_token...

# 4. Restart services
./stop-archon.sh && ./start-archon.sh
```

### Problem: Database connection fails

**Solution**:
```bash
# 1. Verify Supabase is running
docker ps | grep supabase-ai-db

# 2. Check DATABASE_URI format
grep DATABASE_URI .env

# Should be: postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# 3. Test connection manually
docker exec -it supabase-ai-db psql \
  -U postgres \
  -d postgres \
  -c "\l"  # List databases
```

---

## Environment-Specific Configurations

### Development

```env
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=debug
DATABASE_URI=postgresql://postgres:postgres@supabase-ai-db:5432/postgres
```

### Staging

```env
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=info
DATABASE_URI=postgresql://postgres:SECURE_PASSWORD@supabase-ai-db:5432/postgres
```

### Production

```env
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=warning
DATABASE_URI=postgresql://postgres:VERY_SECURE_PASSWORD@prod-db:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
```

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Database Config: `@.claude/docs/DATABASE_CONFIG.md`
- Network Architecture: `@.claude/docs/NETWORK_ARCHITECTURE.md`
- System Setup: `@.claude/docs/SYSTEM_SETUP.md`
