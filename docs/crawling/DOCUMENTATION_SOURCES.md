# Documentation Sources for Archon Knowledge Base

> **Generated:** 2025-01-07
> **Projects Analyzed:** archon, football-platform, sporterp-apps
> **Total Libraries:** 100+

This document provides crawling-friendly documentation URLs for all libraries used across the SportERP platform projects. Sources are organized by crawling priority to maximize efficiency.

---

## Table of Contents

- [Quick Start - Immediate Crawl](#quick-start---immediate-crawl)
- [Tier 1: llms.txt Sources](#tier-1-llmstxt-sources-highest-priority)
- [Tier 2: Sitemap-Based Crawling](#tier-2-sitemap-based-crawling)
- [Tier 3: Context7 Pre-Indexed](#tier-3-context7-pre-indexed)
- [Tier 4: GitHub README Sources](#tier-4-github-readme-sources)
- [Tier 5: Additional Libraries](#tier-5-additional-libraries)
- [Appendix: Full Library Matrix](#appendix-full-library-matrix)

---

## Quick Start - Immediate Crawl

**Copy these URLs directly to Archon for immediate crawling:**

```
https://supabase.com/llms.txt
https://zod.dev/llms.txt
https://platform.openai.com/docs/llms-full.txt
https://docs.stripe.com/llms.txt
https://ai.pydantic.dev/llms-full.txt
```

---

## Tier 1: llms.txt Sources (Highest Priority)

These sources provide LLM-optimized documentation that is ideal for knowledge base ingestion.

| Library | llms.txt URL | Full Version | Notes |
|---------|--------------|--------------|-------|
| **Supabase** | https://supabase.com/llms.txt | [Language-specific](https://supabase.com/llms/) | Master index + `/llms/js.txt`, `/llms/python.txt`, etc. |
| **Zod** | https://zod.dev/llms.txt | - | Hierarchical navigation with anchor IDs |
| **OpenAI** | https://platform.openai.com/docs/llms.txt | https://platform.openai.com/docs/llms-full.txt | Complete API documentation |
| **Stripe** | https://docs.stripe.com/llms.txt | - | All products: Payments, Billing, Connect |
| **Pydantic AI** | https://ai.pydantic.dev/llms.txt | https://ai.pydantic.dev/llms-full.txt | Agent framework documentation |
| **Pydantic** | https://docs.pydantic.dev/llms.txt | https://docs.pydantic.dev/llms-full.txt | Data validation library |

### Supabase Language-Specific Files

```
https://supabase.com/llms/js.txt          # JavaScript/TypeScript
https://supabase.com/llms/python.txt      # Python
https://supabase.com/llms/dart.txt        # Dart/Flutter
https://supabase.com/llms/swift.txt       # Swift/iOS
https://supabase.com/llms/kotlin.txt      # Kotlin/Android
https://supabase.com/llms/csharp.txt      # C#/.NET
```

---

## Tier 2: Sitemap-Based Crawling

These major frameworks provide comprehensive sitemaps for structured crawling.

| Library | Documentation URL | Sitemap URL | Est. Pages |
|---------|-------------------|-------------|------------|
| **FastAPI** | https://fastapi.tiangolo.com/ | https://fastapi.tiangolo.com/sitemap.xml | ~165 |
| **Next.js** | https://nextjs.org/docs | https://nextjs.org/sitemap.xml | ~1,000+ |
| **React** | https://react.dev/ | https://react.dev/sitemap.xml | ~300 |
| **Tailwind CSS** | https://tailwindcss.com/docs | https://tailwindcss.com/sitemap.xml | ~200 |
| **Odoo 16** | https://www.odoo.com/documentation/16.0/ | https://www.odoo.com/sitemap.xml | ~500+ |
| **Playwright** | https://playwright.dev/docs | https://playwright.dev/sitemap.xml | ~200 |
| **Vitest** | https://vitest.dev/ | https://vitest.dev/sitemap.xml | ~100 |

### Sitemap Crawling Commands

```bash
# Example: Crawl FastAPI docs via Archon
curl -X POST http://localhost:8181/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{"url": "https://fastapi.tiangolo.com/sitemap.xml", "crawl_type": "sitemap"}'
```

---

## Tier 3: Context7 Pre-Indexed

These libraries are already indexed in Context7 and can be queried via MCP. Use for quick lookups and verification.

### Core Frameworks

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| FastAPI | `/websites/fastapi_tiangolo` | 12,067 | 94.6 | All projects |
| Next.js App Router | `/websites/nextjs_app` | 2,664 | 92.5 | archon, sporterp-apps |
| React | `/websites/react_dev` | 4,359 | 74.5 | All projects |
| Tailwind CSS v3 | `/websites/v3_tailwindcss` | 2,691 | 85.9 | All projects |
| SQLAlchemy 2.0 | `/websites/sqlalchemy_en_20_orm` | 2,697 | 93.5 | All projects |

### State Management & Forms

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| TanStack Query | `/websites/tanstack_query` | 2,156 | 89.9 | archon, football-platform |
| Zustand | `/pmndrs/zustand` | 771 | 87.5 | All projects |
| React Hook Form | `/react-hook-form/documentation` | 344 | 89.9 | football-platform, sporterp-apps |
| Zod | `/websites/zod_dev` | 112,267 | 80.7 | All projects |

### UI Components

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| Radix UI | `/websites/radix-ui-primitives` | 628 | 82.3 | archon, football-platform |
| Flowbite | `/websites/flowbite` | 2,130 | 95.0 | archon, sporterp-apps |
| Framer Motion | `/websites/motion-dev-docs` | 1,486 | 85.5 | All projects |
| @dnd-kit | `/websites/next_dndkit` | 385 | 87.6 | archon |
| Lucide Icons | `/websites/lucide_dev_guide_packages` | 163 | 72.2 | All projects |

### AI/ML & Processing

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| OpenAI API | `/websites/platform_openai` | 9,418 | 69.1 | archon |
| Pydantic | `/websites/pydantic_dev` | 2,805 | 94.4 | All projects |
| Pydantic AI | `/llmstxt/ai_pydantic_dev_llms-full_txt` | 12,972 | 67.8 | archon |
| crawl4ai | `/unclecode/crawl4ai` | 5,189 | 93.3 | archon |
| Sentence Transformers | `/websites/sbert_net` | 6,901 | 88.4 | archon |
| Ultralytics YOLO | `/websites/ultralytics` | 33,520 | 83.0 | football-platform |
| Roboflow | `/websites/roboflow` | 1,363 | 69.8 | football-platform |
| OpenCV | `/websites/opencv_5_x` | 36,836 | 85.3 | football-platform |

### Testing

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| Playwright | `/websites/playwright_dev` | 6,155 | 81.7 | archon |
| Playwright Python | `/websites/playwright_dev_python` | ~2,000 | 80.0 | archon |
| Vitest | `/websites/main_vitest_dev` | 1,295 | 94.0 | archon |
| pytest | `/websites/pytest_en_stable` | 2,982 | 86.7 | All projects |

### Document Processing

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| jsPDF | `/parallax/jspdf` | 1,551 | 93.0 | sporterp-apps |
| react-pdf | `/wojtekmaj/react-pdf` | 171 | 76.3 | sporterp-apps |
| Quill.js | `/slab/quill` | 328 | 89.2 | sporterp-apps |

### Computer Vision

| Library | Context7 ID | Snippets | Score | Used In |
|---------|-------------|----------|-------|---------|
| MMPose | `/websites/mmpose_readthedocs_io_en` | 2,189 | 70.7 | football-platform |
| ByteTrack | `/foundationvision/bytetrack` | 63 | - | football-platform |

### Context7 Query Example

```python
# Via MCP tool
result = context7.resolve_library_id(
    query="FastAPI dependency injection",
    libraryName="FastAPI"
)
# Returns: /websites/fastapi_tiangolo

docs = context7.query_docs(
    libraryId="/websites/fastapi_tiangolo",
    query="dependency injection"
)
```

---

## Tier 4: GitHub README Sources

Single-page crawls for specialized libraries without official documentation sites.

| Library | GitHub URL | Raw README | Purpose |
|---------|------------|------------|---------|
| **pgvector** | https://github.com/pgvector/pgvector | [README.md](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md) | Vector search extension |
| **ByteTrack** | https://github.com/ifzhang/ByteTrack | [README.md](https://raw.githubusercontent.com/ifzhang/ByteTrack/main/README.md) | Object tracking |
| **LAP** | https://github.com/gatagat/lap | [README.md](https://raw.githubusercontent.com/gatagat/lap/master/README.md) | Linear assignment |
| **Supervision** | https://github.com/roboflow/supervision | [README.md](https://raw.githubusercontent.com/roboflow/supervision/main/README.md) | CV utilities |
| **MCP Protocol** | https://github.com/modelcontextprotocol/specification | [README.md](https://raw.githubusercontent.com/modelcontextprotocol/specification/main/README.md) | MCP specification |

### Crawl Raw README URLs

```
https://raw.githubusercontent.com/pgvector/pgvector/master/README.md
https://raw.githubusercontent.com/ifzhang/ByteTrack/main/README.md
https://raw.githubusercontent.com/gatagat/lap/master/README.md
https://raw.githubusercontent.com/roboflow/supervision/main/README.md
```

---

## Tier 5: Additional Libraries

### Backend (Python)

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| Uvicorn | https://www.uvicorn.org/ | Sitemap | All projects |
| httpx | https://www.python-httpx.org/ | Sitemap | archon |
| asyncpg | https://magicstack.github.io/asyncpg/current/ | Direct | archon |
| python-jose | https://python-jose.readthedocs.io/en/latest/ | ReadTheDocs | All projects |
| Logfire | https://logfire.pydantic.dev/docs/ | Sitemap | archon |
| passlib | https://passlib.readthedocs.io/en/stable/ | ReadTheDocs | sporterp-apps |
| python-multipart | https://andrew-d.github.io/python-multipart/ | Direct | All projects |
| aiofiles | https://github.com/Tinche/aiofiles | GitHub | All projects |

### Frontend (JavaScript/TypeScript)

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| Axios | https://axios-http.com/docs/intro | Direct | All projects |
| date-fns | https://date-fns.org/docs/Getting-Started | Direct | archon |
| dayjs | https://day.js.org/docs/en/installation/installation | Direct | sporterp-apps |
| Recharts | https://recharts.org/en-US/api | Direct | sporterp-apps, football-platform |
| react-icons | https://react-icons.github.io/react-icons/ | GitHub | All projects |
| clsx | https://github.com/lukeed/clsx | GitHub | All projects |
| tailwind-merge | https://github.com/dcastil/tailwind-merge | GitHub | All projects |
| nanoid | https://github.com/ai/nanoid | GitHub | archon |

### Payments & Auth

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| @stripe/stripe-js | https://docs.stripe.com/js | llms.txt | sporterp-apps |
| @stripe/react-stripe-js | https://docs.stripe.com/stripe-js/react | llms.txt | sporterp-apps |
| @react-oauth/google | https://www.npmjs.com/package/@react-oauth/google | npm | sporterp-apps, football-platform |
| python-jose | https://python-jose.readthedocs.io/en/latest/ | ReadTheDocs | All projects |
| bcrypt | https://github.com/pyca/bcrypt | GitHub | sporterp-apps |

### Odoo/ERP Stack

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| Odoo 16 | https://www.odoo.com/documentation/16.0/ | Sitemap | sporterp-apps |
| Werkzeug | https://werkzeug.palletsprojects.com/en/3.0.x/ | Sitemap | sporterp-apps |
| Jinja2 | https://jinja.palletsprojects.com/en/3.1.x/ | Sitemap | sporterp-apps |
| Babel | https://babel.pocoo.org/en/latest/ | ReadTheDocs | sporterp-apps |
| lxml | https://lxml.de/index.html | Direct | sporterp-apps |
| Pillow | https://pillow.readthedocs.io/en/stable/ | ReadTheDocs | sporterp-apps, football-platform |
| reportlab | https://docs.reportlab.com/ | Direct | sporterp-apps |

### Computer Vision & Video

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| OpenCV-Python | https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html | Sitemap | football-platform |
| Ultralytics | https://docs.ultralytics.com/ | Sitemap | football-platform |
| Roboflow | https://docs.roboflow.com/ | Direct | football-platform |
| yt-dlp | https://github.com/yt-dlp/yt-dlp | GitHub | football-platform |
| PyAV | https://pyav.basswood-io.com/docs/stable/ | Direct | football-platform |
| scikit-learn | https://scikit-learn.org/stable/documentation.html | Sitemap | football-platform |
| NumPy | https://numpy.org/doc/stable/ | Sitemap | football-platform |

### Testing & QA

| Library | Documentation URL | Crawl Method | Used In |
|---------|-------------------|--------------|---------|
| pytest | https://docs.pytest.org/en/stable/ | Sitemap | All projects |
| pytest-asyncio | https://pytest-asyncio.readthedocs.io/en/latest/ | ReadTheDocs | All projects |
| pytest-cov | https://pytest-cov.readthedocs.io/en/latest/ | ReadTheDocs | All projects |
| Faker | https://faker.readthedocs.io/en/master/ | ReadTheDocs | football-platform |
| @testing-library/react | https://testing-library.com/docs/react-testing-library/intro | Direct | archon |
| MSW | https://mswjs.io/docs | Direct | archon |

---

## Appendix: Full Library Matrix

### Project Coverage Summary

| Category | archon | football-platform | sporterp-apps |
|----------|--------|-------------------|---------------|
| Backend Framework | FastAPI | FastAPI | FastAPI + Odoo |
| Frontend Framework | Next.js 15, React 18 | Next.js 14/16, React 18 | Next.js 15, React 19 |
| State Management | Zustand, TanStack Query | Zustand, TanStack Query | Zustand, Redux |
| UI Components | Radix UI, Flowbite | Radix UI | Flowbite |
| Database | Supabase, pgvector | SQLite | PostgreSQL |
| AI/ML | OpenAI, crawl4ai, sentence-transformers | Ultralytics, OpenCV, Roboflow | - |
| Payments | - | - | Stripe |
| Testing | Playwright, Vitest, pytest | pytest | - |

### Crawling Priority Order

1. **llms.txt sources** (5 libraries) - Instant, optimized for LLMs
2. **Major frameworks via sitemap** (7 libraries) - Comprehensive coverage
3. **Context7 reference** (40+ libraries) - Already indexed, use for verification
4. **GitHub READMEs** (5 libraries) - Single page, specialized tools
5. **Additional libraries** (50+ libraries) - As needed basis

### Estimated Total Pages

| Tier | Sources | Est. Pages | Priority |
|------|---------|------------|----------|
| Tier 1 | 5 llms.txt | ~500 | Immediate |
| Tier 2 | 7 sitemaps | ~2,500 | High |
| Tier 3 | 40+ Context7 | N/A (pre-indexed) | Reference |
| Tier 4 | 5 GitHub | ~50 | Medium |
| Tier 5 | 50+ misc | ~1,000 | Low |

**Total Estimated Coverage**: ~4,050 documentation pages

---

## Usage Notes

### Adding Sources to Archon

```bash
# Via CLI
curl -X POST http://localhost:8181/api/v1/sources \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://supabase.com/llms.txt",
    "name": "Supabase Documentation",
    "crawl_type": "llms_txt"
  }'

# Via Dashboard
# Navigate to http://localhost:3737/knowledge-base
# Click "Add Source" and paste the llms.txt URL
```

### Context7 Integration

Context7 is already available via MCP and doesn't require crawling. Query directly:

```python
# In Claude Code / MCP client
sources = context7.resolve_library_id(query="...", libraryName="...")
docs = context7.query_docs(libraryId=sources['id'], query="...")
```

---

**Last Updated:** 2025-01-07
**Maintainer:** SportERP Team
