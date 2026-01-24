# Test Execution Guide - Project Document Upload

**Quick reference for running and debugging tests**

## Quick Start

### Backend Tests

```bash
# Run all document upload tests
cd /home/ljutzkanov/Documents/Projects/archon
pytest python/tests/test_project_document_upload.py -v

# Expected output:
# =================== test session starts ====================
# collected 25 items
# test_project_document_upload.py::TestFileUploadEndpoint::test_upload_document_success PASSED
# test_project_document_upload.py::TestFileUploadEndpoint::test_upload_requires_authentication PASSED
# ...
# =================== 25 passed in 2.34s ====================
```

### Frontend E2E Tests

```bash
# Run E2E tests
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npx playwright test e2e/project-document-upload.spec.ts

# Expected output:
# Running 20 tests using 4 workers
# ✓  [chromium] › e2e/project-document-upload.spec.ts:12:3 › Project Document Upload › should upload file successfully (5.2s)
# ...
# 20 passed (42.1s)
```

## Prerequisites

### Backend Tests

```bash
# 1. Python environment
python --version  # Should be 3.12+

# 2. Install dependencies
cd /home/ljutzkanov/Documents/Projects/archon
pip install -r requirements.txt
# OR with uv:
uv pip install -r requirements.txt

# 3. Verify pytest
pytest --version
# pytest 8.3.4 or higher
```

### Frontend E2E Tests

```bash
# 1. Node.js
node --version  # Should be 18+
npm --version

# 2. Install dependencies
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm install

# 3. Install Playwright browsers
npx playwright install

# 4. Start services (in separate terminals)
# Terminal 1: Backend
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh

# Terminal 2: Frontend
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm run dev

# Wait for both to be ready
curl http://localhost:8181/health  # Backend
curl http://localhost:3738  # Frontend
```

## Detailed Execution

### Backend Test Options

```bash
# 1. Run all tests with verbose output
pytest python/tests/test_project_document_upload.py -v

# 2. Run specific test class
pytest python/tests/test_project_document_upload.py::TestFileUploadEndpoint -v

# 3. Run specific test method
pytest python/tests/test_project_document_upload.py::TestFileUploadEndpoint::test_upload_document_success -v

# 4. Run with output capture disabled (see print statements)
pytest python/tests/test_project_document_upload.py -v -s

# 5. Run with coverage
pytest python/tests/test_project_document_upload.py --cov=src.server.api_routes.projects_documents --cov-report=html

# 6. Run with detailed output
pytest python/tests/test_project_document_upload.py -vv

# 7. Stop on first failure
pytest python/tests/test_project_document_upload.py -x

# 8. Run in parallel (faster)
pytest python/tests/test_project_document_upload.py -n auto

# 9. Re-run only failed tests
pytest python/tests/test_project_document_upload.py --lf

# 10. Run tests matching pattern
pytest python/tests/test_project_document_upload.py -k "upload" -v
```

### Frontend E2E Test Options

```bash
# 1. Run all tests
npx playwright test e2e/project-document-upload.spec.ts

# 2. Run specific test suite
npx playwright test e2e/project-document-upload.spec.ts -g "Project Document Upload"

# 3. Run specific test
npx playwright test e2e/project-document-upload.spec.ts -g "should upload file successfully"

# 4. Run with UI (interactive mode)
npx playwright test e2e/project-document-upload.spec.ts --ui

# 5. Run headed (see browser)
npx playwright test e2e/project-document-upload.spec.ts --headed

# 6. Run in specific browser
npx playwright test e2e/project-document-upload.spec.ts --project=chromium

# 7. Debug mode (step through)
npx playwright test e2e/project-document-upload.spec.ts --debug

# 8. Generate HTML report
npx playwright test e2e/project-document-upload.spec.ts --reporter=html

# 9. Run with trace (for debugging failures)
npx playwright test e2e/project-document-upload.spec.ts --trace on

# 10. Run in parallel workers
npx playwright test e2e/project-document-upload.spec.ts --workers=4
```

## Coverage Reports

### Generate Backend Coverage

```bash
# 1. Run tests with coverage
pytest python/tests/test_project_document_upload.py \
  --cov=src.server.api_routes.projects_documents \
  --cov=src.server.utils.progress \
  --cov-report=html \
  --cov-report=term-missing

# 2. View report
# Open: htmlcov/index.html in browser
firefox htmlcov/index.html

# 3. Coverage summary in terminal
pytest python/tests/test_project_document_upload.py --cov --cov-report=term

# Expected output:
# ----------- coverage: platform linux, python 3.12.1 -----------
# Name                                          Stmts   Miss  Cover   Missing
# ---------------------------------------------------------------------------
# src/server/api_routes/projects_documents.py    245     35    86%   123-135, 245-258
# src/server/utils/progress/progress_tracker.py   89      5    94%   78-82
# ---------------------------------------------------------------------------
# TOTAL                                          334     40    88%
```

### Generate Frontend Coverage

```bash
# 1. Run E2E tests with coverage (if configured)
npx playwright test e2e/project-document-upload.spec.ts --reporter=html

# 2. View report
npx playwright show-report

# Opens: playwright-report/index.html
```

## Debugging Failures

### Backend Test Failures

**Common Issues:**

1. **Import errors:**
```bash
# Solution: Ensure Python path is correct
export PYTHONPATH=/home/ljutzkanov/Documents/Projects/archon/python:$PYTHONPATH
pytest python/tests/test_project_document_upload.py -v
```

2. **Mock errors:**
```bash
# Solution: Check conftest.py is being loaded
pytest python/tests/test_project_document_upload.py -v --co
# Should show conftest.py fixtures

# Run with debug output
pytest python/tests/test_project_document_upload.py -vv -s
```

3. **Async errors:**
```bash
# Solution: Check pytest-asyncio is installed
pip install pytest-asyncio

# Run with asyncio debug mode
pytest python/tests/test_project_document_upload.py -v --asyncio-mode=auto
```

### Frontend Test Failures

**Common Issues:**

1. **Services not running:**
```bash
# Check backend
curl http://localhost:8181/health

# Check frontend
curl http://localhost:3738

# Start if needed
./start-archon.sh
npm run dev
```

2. **Selector not found:**
```bash
# Run with headed mode to see UI
npx playwright test e2e/project-document-upload.spec.ts --headed

# Run with debug mode
npx playwright test e2e/project-document-upload.spec.ts --debug

# Use codegen to get correct selectors
npx playwright codegen http://localhost:3738/projects/f8311680-58a7-45e6-badf-de55d3d9cd24
```

3. **Timeout errors:**
```bash
# Increase timeout in playwright.config.ts
# Or use --timeout flag
npx playwright test e2e/project-document-upload.spec.ts --timeout=60000
```

4. **Flaky tests:**
```bash
# Run multiple times to identify
npx playwright test e2e/project-document-upload.spec.ts --repeat-each=3

# Run with trace for failed tests
npx playwright test e2e/project-document-upload.spec.ts --trace on-first-retry

# View trace
npx playwright show-trace trace.zip
```

## Interactive Debugging

### Backend (pytest)

```bash
# 1. Add breakpoint in test
import pdb; pdb.set_trace()

# 2. Run test with -s flag
pytest python/tests/test_project_document_upload.py::TestFileUploadEndpoint::test_upload_document_success -s

# 3. Debug commands:
# n - next line
# s - step into
# c - continue
# p variable - print variable
# l - list code
# q - quit
```

### Frontend (Playwright)

```bash
# 1. Run in debug mode
npx playwright test e2e/project-document-upload.spec.ts --debug

# 2. Use inspector:
# - Step through test
# - Inspect elements
# - View console logs
# - Take screenshots

# 3. Add page.pause() in test:
await page.pause();

# 4. Generate test code:
npx playwright codegen http://localhost:3738
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Document Upload

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      - name: Run tests
        run: |
          pytest python/tests/test_project_document_upload.py --cov --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Start services
        run: |
          ./start-archon.sh &
          cd archon-ui-nextjs && npm run dev &
          sleep 30
      - name: Run E2E tests
        run: |
          cd archon-ui-nextjs
          npx playwright test e2e/project-document-upload.spec.ts
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: archon-ui-nextjs/playwright-report/
```

## Test Results

### Expected Pass Rates

**Backend Tests:**
- Target: 100% pass rate
- Current: ⏳ Pending execution
- Acceptable: >95%

**Frontend Tests:**
- Target: 100% pass rate
- Current: ⏳ Pending execution
- Acceptable: >90% (some tests may be flaky in CI)

### Viewing Results

**Backend:**
```bash
# Terminal output shows pass/fail
pytest python/tests/test_project_document_upload.py -v

# HTML report
pytest python/tests/test_project_document_upload.py --html=report.html --self-contained-html
firefox report.html
```

**Frontend:**
```bash
# Terminal output
npx playwright test e2e/project-document-upload.spec.ts

# HTML report
npx playwright show-report

# Trace viewer (for failures)
npx playwright show-trace trace.zip
```

## Performance Benchmarks

**Backend Tests:**
- Total execution time: ~2-5 seconds
- Average per test: ~100-200ms
- Slowest test: ~500ms (integration scenarios)

**Frontend Tests:**
- Total execution time: ~30-60 seconds
- Average per test: ~3-5 seconds
- Slowest test: ~10 seconds (upload with progress)

## Next Steps

1. **Execute Tests:**
   ```bash
   # Backend
   pytest python/tests/test_project_document_upload.py -v

   # Frontend (ensure services running)
   npx playwright test e2e/project-document-upload.spec.ts
   ```

2. **Review Results:**
   - Check pass/fail rates
   - Review coverage reports
   - Identify failing tests

3. **Fix Failures:**
   - Debug failing tests
   - Update mocks if needed
   - Fix timing issues

4. **Document Results:**
   - Update PROJECT_DOCUMENT_UPLOAD_TESTS.md
   - Note any known issues
   - Record coverage metrics

5. **Mark Task Complete:**
   ```bash
   curl -X PUT "http://localhost:8181/api/tasks/0029f042-aa87-4302-b1c0-fbf84f5f6108" \
     -H "Content-Type: application/json" \
     -d '{"status": "review"}'
   ```

## Support

**Issues?**
- Check CLAUDE.md: `/home/ljutzkanov/Documents/Projects/archon/.claude/CLAUDE.md`
- Review test documentation: `PROJECT_DOCUMENT_UPLOAD_TESTS.md`
- Check existing tests for patterns
- Ask in team chat or open issue

**Test Not Working?**
1. Verify prerequisites
2. Check services are running
3. Review error messages
4. Run in debug mode
5. Check for recent code changes

## References

- **Test Files:**
  - `/python/tests/test_project_document_upload.py`
  - `/archon-ui-nextjs/e2e/project-document-upload.spec.ts`
- **Documentation:**
  - `PROJECT_DOCUMENT_UPLOAD_TESTS.md` - Comprehensive test docs
  - `CLAUDE.md` - Project setup guide
  - `TESTING_GUIDE.md` - General testing guidelines
