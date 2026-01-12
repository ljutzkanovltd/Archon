# Crawl Queue Scripts

## initialize_crawl_queue.py

Populates the crawl queue with all sources from the `archon_sources` table, organized into batches with priority assignments.

### Prerequisites

- Archon backend API running at `http://localhost:8181`
- Database credentials configured in `.env` file
- Python environment with required dependencies (supabase, requests, python-dotenv)

### Usage

#### Basic Usage

```bash
# Dry run (shows what would be added without actually adding)
python scripts/initialize_crawl_queue.py --dry-run

# Add all sources to queue with default settings
python scripts/initialize_crawl_queue.py

# Custom batch size
python scripts/initialize_crawl_queue.py --batch-size 10

# Custom priorities
python scripts/initialize_crawl_queue.py --priority-high 90 --priority-normal 40
```

#### Running in Docker

If running Archon in Docker, execute the script inside the container:

```bash
# Find the container name
docker ps --filter "name=archon"

# Execute script in container (example with archon-mcp)
docker exec archon-mcp python /app/scripts/initialize_crawl_queue.py --dry-run

# Or if scripts are mounted from host:
docker exec -w /app/scripts archon-mcp python initialize_crawl_queue.py --dry-run
```

#### Running with uv (if using uv for dependency management)

```bash
cd python
uv run scripts/initialize_crawl_queue.py --dry-run
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Show what would be added without actually adding | N/A |
| `--batch-size N` | Number of sources per batch | 5 |
| `--priority-high N` | Priority for llms.txt sources (fast, single file) | 100 |
| `--priority-normal N` | Priority for sitemap sources | 50 |
| `--api-url URL` | Backend API URL | http://localhost:8181 |
| `--help` | Show help message | N/A |

### Priority Logic

The script automatically assigns priorities based on source type:

- **High Priority (100)**: `llms.txt` files - Fast, single file downloads
- **Normal Priority (50)**: Regular sitemap-based sources - Multi-page documentation

Sources are processed in priority order, with higher-priority sources crawled first.

### Examples

#### Example 1: Dry Run

```bash
python scripts/initialize_crawl_queue.py --dry-run
```

Output:
```
🚀 Archon Crawl Queue Initialization
📅 2026-01-12 15:30:00
--------------------------------------------------------------------------------
⚠️  DRY RUN MODE - No changes will be made
--------------------------------------------------------------------------------
📊 Fetching all sources from database...
✅ Found 44 sources in database

📊 Categorizing sources by type and priority...
📦 Creating batches of 5 sources...

================================================================================
📋 CRAWL QUEUE INITIALIZATION SUMMARY
================================================================================
Total sources:        44
  - llms.txt:         8 (high priority)
  - sitemap/regular:  36 (normal priority)

Batches to create:    9
Sources per batch:    5 (last batch may have fewer)
================================================================================

🔹 Batch 1 (DRY RUN - would add 5 sources):
   - [llms.txt] Supabase Documentation (priority: 100)
   - [llms.txt] Zod Documentation (priority: 100)
   - [llms.txt] Stripe API (priority: 100)
   - [llms.txt] Pydantic Documentation (priority: 100)
   - [llms.txt] FastAPI Documentation (priority: 100)

🔹 Batch 2 (DRY RUN - would add 5 sources):
   - [llms.txt] OpenAI API (priority: 100)
   - [llms.txt] Anthropic API (priority: 100)
   - [llms.txt] MCP Protocol (priority: 100)
   ...
```

#### Example 2: Production Run

```bash
python scripts/initialize_crawl_queue.py
```

The script will:
1. Fetch all sources from database
2. Categorize and prioritize
3. Create batches
4. Show summary
5. **Ask for confirmation** before adding to queue
6. Add each batch via API
7. Show final completion report

#### Example 3: Custom Configuration

```bash
# Process 10 sources per batch with custom priorities
python scripts/initialize_crawl_queue.py \
  --batch-size 10 \
  --priority-high 90 \
  --priority-normal 40 \
  --api-url http://localhost:8181
```

### Output

The script provides detailed progress logging:

- 📊 Data fetching progress
- 📦 Batch creation
- 🔹 Per-batch status
- ✅ Success confirmations
- ❌ Error messages with details
- 📋 Final summary report

### Monitoring After Initialization

Once the queue is populated, monitor progress via:

```bash
# Queue status
curl http://localhost:8181/api/crawl-queue/status | jq

# Specific batch progress
curl http://localhost:8181/api/crawl-queue/batch/{batch_id}/progress | jq

# Items needing review
curl http://localhost:8181/api/crawl-queue/review | jq
```

### Error Handling

The script handles:
- **Database connection failures**: Exits with error message
- **API errors**: Shows detailed error response
- **Network timeouts**: 30-second timeout per API call
- **Missing dependencies**: Clear module import errors

### Notes

- The script requires the queue API endpoints to be available
- Worker must be running to process queued items (auto-starts with backend)
- Failed API calls are reported but don't stop processing other batches
- Use `--dry-run` first to verify configuration before production run

### Related Files

- **API Endpoints**: `python/src/server/api_routes/knowledge_api.py` - Queue management endpoints
- **Worker**: `python/src/server/services/crawling/queue_worker.py` - Background processor
- **Queue Manager**: `python/src/server/services/crawling/queue_manager.py` - Queue operations
- **Migration**: `python/migrations/add_crawl_queue_system.sql` - Database schema

---

**Created:** 2026-01-12
**Phase:** 5 - Testing & Initialization
**Part of:** Bulk Re-Crawl System
