# Archon Batch Crawling System

Automated batch crawling system for populating the Archon knowledge base with library documentation.

## 🎯 Overview

This system provides intelligent batch crawling with:
- **Deduplication**: Automatically skips already-crawled sources
- **Completeness validation**: Detects incomplete crawls (like Odoo with "too many requests")
- **Concurrency control**: Limits to 2-3 concurrent jobs to prevent system overload
- **Progress monitoring**: Real-time progress tracking via HTTP polling
- **Special handling**: Rate limiting for problematic sources (Odoo, Azure)

## 📁 File Structure

```
archon/
├── docs/
│   └── library_catalog_extended.py      # 69 libraries across 3 projects
├── scripts/
│   ├── batch_crawler.py                 # Core orchestration engine
│   ├── completeness_validator.py        # Validation logic
│   ├── crawl_diff_detector.py           # Deduplication & diff detection
│   ├── submit_crawl_jobs.py             # Main CLI interface ⭐
│   ├── crawl_config.yaml                # Configuration file
│   └── README.md                        # This file
└── logs/
    ├── crawl_results_*.json             # Crawl results history
    └── validation_*.json                # Validation reports
```

## 🚀 Quick Start

### Prerequisites

1. **Archon backend running**:
   ```bash
   cd ~/Projects/archon
   docker compose up -d  # or make dev
   ```

2. **Verify Archon is accessible**:
   ```bash
   curl http://localhost:8181/api/knowledge-items
   curl http://localhost:8051/health  # MCP server
   ```

### Basic Usage

```bash
cd ~/Projects/archon/scripts

# 1. Check what needs crawling (dry run)
python submit_crawl_jobs.py --mode all --dry-run

# 2. Crawl all missing Tier 1 libraries
python submit_crawl_jobs.py --mode missing --priority 1

# 3. Re-crawl incomplete sources (like Odoo)
python submit_crawl_jobs.py --mode incomplete

# 4. Crawl specific library
python submit_crawl_jobs.py --library "Supabase"

# 5. Validate existing sources
python submit_crawl_jobs.py --mode validate
```

## 📋 Modes

### `--mode missing`
Crawl **new** libraries that haven't been crawled yet.

```bash
# Crawl all new Tier 1 libraries
python submit_crawl_jobs.py --mode missing --priority 1

# Just Azure services
python submit_crawl_jobs.py --mode missing --tag azure
```

### `--mode incomplete`
Re-crawl libraries with issues:
- Low word count (< 50% expected)
- "Too many requests" errors
- Missing critical sections (e.g., FastAPI tutorials)

```bash
# Re-crawl all incomplete sources
python submit_crawl_jobs.py --mode incomplete

# Focus on Tier 1 incomplete
python submit_crawl_jobs.py --mode incomplete --priority 1
```

### `--mode all`
Crawl ALL actionable libraries (new + incomplete + missing sections).

```bash
# Crawl everything that needs attention
python submit_crawl_jobs.py --mode all

# Tier 1 only
python submit_crawl_jobs.py --mode all --priority 1
```

### `--mode validate`
Just validate, don't crawl. Checks:
- Word count vs expected thresholds
- Missing sections
- Crawl errors

```bash
# Validate all sources
python submit_crawl_jobs.py --mode validate

# Export validation report
python completeness_validator.py --export validation_report.json
```

## 🎛️ Options

| Option | Description | Example |
|--------|-------------|---------|
| `--priority 1/2/3` | Filter by priority tier | `--priority 1` |
| `--library NAME` | Crawl specific library | `--library "FastAPI"` |
| `--tag TAG` | Filter by tag | `--tag azure` |
| `--batch-size N` | Concurrent crawls (2-3 recommended) | `--batch-size 3` |
| `--dry-run` | Show plan without crawling | `--dry-run` |
| `--api-base URL` | Archon API URL | `--api-base http://localhost:8181` |

## 📊 Library Catalog

**Total**: 69 unique libraries
- **Archon**: 26 libraries (Backend, Frontend, AI/ML, Database, Testing)
- **SportERP**: 33 libraries (Frontend, UI, State, Forms, Viz, AI, Payment, Backend, ERP, **Azure**)
- **Local AI**: 20 libraries (LLM, Workflows, Vector DBs, Graphs, Observability, Infrastructure)

**Priority Breakdown**:
- **Tier 1 (Critical)**: 21 libraries - Weekly updates recommended
- **Tier 2 (High)**: 33 libraries - Bi-weekly updates
- **Tier 3 (Medium)**: 15 libraries - Monthly updates

**Azure Services** (6 total):
- Azure Storage Blob (Priority 1)
- Azure Functions (Priority 2)
- Azure App Service (Priority 2)
- Azure PostgreSQL (Priority 2)
- Azure Virtual Networks (Priority 3)
- Azure AI Foundry (Priority 2) - Already crawled

## 🔧 Individual Tools

### `batch_crawler.py`
Core orchestration engine. Can be used standalone:

```bash
# Crawl all Priority 1 libraries
python batch_crawler.py --priority 1

# Force re-crawl existing sources
python batch_crawler.py --priority 1 --force

# Dry run with 3 concurrent jobs
python batch_crawler.py --concurrent 3 --dry-run
```

### `completeness_validator.py`
Validate existing sources:

```bash
# Validate all sources
python completeness_validator.py

# Export validation report
python completeness_validator.py --export validation_report.json

# Check specific library
python completeness_validator.py --library "Odoo"
```

### `crawl_diff_detector.py`
Compare catalog vs crawled:

```bash
# Full diff report
python crawl_diff_detector.py

# Actionable items only
python crawl_diff_detector.py --actionable-only

# Priority 1 only
python crawl_diff_detector.py --priority 1

# Export diff report
python crawl_diff_detector.py --export diff_report.json
```

## ⚙️ Configuration

Edit `crawl_config.yaml` to customize:

```yaml
# Global settings
global:
  max_concurrent_crawls: 2  # 2-3 recommended
  default_crawl_delay: 1.0  # Seconds between requests

# Per-source overrides
source_configs:
  odoo:
    max_depth: 3
    crawl_delay: 2.0  # 0.5 req/sec (slow for rate limiting)
    expected_word_count: 200000
```

## 🚨 Known Issues & Solutions

### Issue: Odoo "Too Many Requests"
**Solution**: Use aggressive rate limiting
```bash
# Odoo automatically gets crawl_delay: 2.0 (0.5 req/sec)
python submit_crawl_jobs.py --library "Odoo"
```

### Issue: FastAPI missing tutorials/API reference
**Solution**: Validator detects missing sections, re-crawl suggested
```bash
python submit_crawl_jobs.py --mode incomplete
```

### Issue: System overload with many crawls
**Solution**: Use batch-size 2 (default) or maximum 3
```bash
# Safe - 2 concurrent
python submit_crawl_jobs.py --mode all --batch-size 2

# Risky - 3 concurrent (only if system can handle it)
python submit_crawl_jobs.py --mode all --batch-size 3
```

## 📈 Crawl Phases (Recommended Order)

### Week 1: Urgent - /llms.txt Sources
**18 libraries with native /llms.txt support** (highest quality)

```bash
# Phase 1: Crawl all /llms.txt sources
python submit_crawl_jobs.py --mode missing --priority 1 --batch-size 3
```

Libraries: MCP, PydanticAI, TanStack Query, Supabase, Flowbite React, n8n, Qdrant, Langfuse, Flowise, CopilotKit, SQLAlchemy, Uvicorn, Vite, Framer Motion, Vitest, ClickHouse, Docker Compose

**Estimated time**: 3-4 hours

### Week 1-2: Critical - Tier 1 Without /llms.txt

```bash
# Phase 2: Tier 1 sitemap/robots sources
python submit_crawl_jobs.py --mode missing --priority 1 --batch-size 2
```

Libraries: FastAPI, React, Next.js, TypeScript, Tailwind CSS, PostgreSQL, Odoo

**Estimated time**: 4-5 hours

### Week 2: Azure Services

```bash
# Phase 3: Azure infrastructure
python submit_crawl_jobs.py --tag azure --batch-size 2
```

Libraries: Azure Blob Storage, Functions, App Service, PostgreSQL, Virtual Networks

**Estimated time**: 2-3 hours

### Week 3: Remaining Tier 2 & GitHub Docs

```bash
# Phase 4: High-priority libraries
python submit_crawl_jobs.py --mode missing --priority 2 --batch-size 2

# Phase 5: GitHub-based docs (Ollama, llama.cpp, pgvector)
python submit_crawl_jobs.py --library "Ollama"
python submit_crawl_jobs.py --library "llama.cpp"
```

**Estimated time**: 3-4 hours

## 📊 Expected Results

### Current State (Before)
- ✅ 7 sources crawled (10.9% coverage)
- ✅ PydanticAI: Excellent (127 pages, 409k words)
- ✅ FastAPI: Good (145 pages, 344k words)
- ⚠️ Odoo: INCOMPLETE (49k words, should be 200k+)
- ❌ 57 libraries missing

### Target State (After Phases 1-2)
- ✅ 30+ sources crawled (46% coverage)
- ✅ All Tier 1 at 90%+ coverage
- ✅ 18 /llms.txt sources complete
- ✅ Odoo re-crawled successfully
- ✅ Total: ~10M words

### Ultimate Goal (All Phases)
- ✅ 50+ sources crawled (78% coverage)
- ✅ Tier 1: 100% complete
- ✅ Tier 2: 85%+ complete
- ✅ Total: ~15M words

## 🔄 Automated Scheduling (Future)

### Systemd Timer (Recommended)

Create `~/Projects/archon/systemd/archon-crawl-update.timer`:

```ini
[Unit]
Description=Weekly Archon Crawl Update

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
```

Install:
```bash
sudo cp systemd/archon-crawl-update.* /etc/systemd/system/
sudo systemctl enable archon-crawl-update.timer
sudo systemctl start archon-crawl-update.timer
```

### Cron Job (Simpler)

```cron
# Weekly Tier 1 updates (Sundays at 2 AM)
0 2 * * 0 cd /home/ljutzkanov/Projects/archon/scripts && python submit_crawl_jobs.py --mode stale --priority 1

# Bi-weekly Tier 2 updates (every other Sunday at 3 AM)
0 3 */14 * * cd /home/ljutzkanov/Projects/archon/scripts && python submit_crawl_jobs.py --mode stale --priority 2
```

## 🐛 Troubleshooting

### Archon backend not running
```bash
cd ~/Projects/archon
docker compose ps  # Check status
docker compose up -d  # Start if stopped
curl http://localhost:8181/api/knowledge-items  # Verify
```

### Import errors
```bash
# Ensure you're in the scripts directory
cd ~/Projects/archon/scripts

# Or use absolute imports
export PYTHONPATH=/home/ljutzkanov/Projects/archon:$PYTHONPATH
```

### Rate limiting errors (429)
Increase `crawl_delay` in `crawl_config.yaml` for the affected source.

### Validation shows incomplete crawls
```bash
# Check validation report
python submit_crawl_jobs.py --mode validate

# Re-crawl incomplete sources
python submit_crawl_jobs.py --mode incomplete
```

## 📝 Examples

### Example 1: Initial Setup (Crawl Tier 1)
```bash
# Step 1: Check what needs crawling
python submit_crawl_jobs.py --mode all --priority 1 --dry-run

# Step 2: Crawl all Priority 1 (new + incomplete)
python submit_crawl_jobs.py --mode all --priority 1

# Step 3: Validate results
python submit_crawl_jobs.py --mode validate --priority 1
```

### Example 2: Fix Odoo Re-Crawl
```bash
# Step 1: Check Odoo status
python completeness_validator.py --library "Odoo"

# Step 2: Re-crawl with rate limiting (automatic)
python submit_crawl_jobs.py --library "Odoo"

# Step 3: Verify word count improved
python completeness_validator.py --library "Odoo"
```

### Example 3: Azure Services Only
```bash
# Crawl all 6 Azure services
python submit_crawl_jobs.py --tag azure --batch-size 2

# Verify results
python crawl_diff_detector.py --export azure_diff.json
```

## 🎯 Success Metrics

Track progress with:
```bash
# Current coverage
python crawl_diff_detector.py

# Validation report
python completeness_validator.py --export validation.json

# Check specific priority tier
python crawl_diff_detector.py --priority 1 --actionable-only
```

## 🔗 Related Documentation

- **Archon Architecture**: `~/Projects/archon/PRPs/ai_docs/ARCHITECTURE.md`
- **Crawling Service**: `~/Projects/archon/python/src/server/services/crawling/`
- **MCP Tools**: `~/Projects/archon/python/src/mcp_server/features/rag/`
- **Libraries Catalog**: `/docs/libraries_for_crawling.md`

## 📞 Support

For issues or questions:
1. Check validation reports: `python submit_crawl_jobs.py --mode validate`
2. Review logs: `~/Projects/archon/logs/`
3. Check Archon backend logs: `docker compose logs archon-backend`
4. Verify MCP server: `curl http://localhost:8051/health`

---

**Version**: 1.0.0
**Last Updated**: 2025-12-21
**Maintainer**: Automated Crawling System for Archon Knowledge Base
