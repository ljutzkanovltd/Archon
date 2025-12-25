# Comprehensive Testing Methodologies for Next.js 15 App Router Applications

**Stack:**
- Next.js 15.5.6 (App Router)
- React 18.3.1
- TypeScript 5.8.3
- TanStack Query 5.90.12
- Zustand 5.0.5
- Tailwind CSS 4.1.1

**Research Date:** 2025-12-23
**Status:** Production-Ready Guide

---

## Executive Summary

This guide provides a complete testing strategy for Next.js 15 App Router applications with modern state management. Key recommendation: **Vitest + React Testing Library + Playwright + Chromatic** forms the optimal testing stack for 2025, offering the best balance of performance, developer experience, and comprehensive coverage.

---

## 1. Unit Testing

### 1.1 Recommended Framework: Vitest

**Winner:** Vitest (over Jest)

**Rationale:**
- Native Vite integration for 35-45% faster execution
- Built-in TypeScript support
- Jest-compatible API (easy migration)
- Modern ESM/TS support out of the box
- Better performance with parallel execution
- Active development and Next.js 15 compatibility

**When to Use Jest Instead:**
- Legacy codebases with deep Jest plugin integrations
- CommonJS-heavy projects
- Extensive custom Jest reporters that can't be replaced

### 1.2 Setup Instructions

**Installation:**
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

**Configuration (`vitest.config.mts`):**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
```

**Setup File (`test/setup.ts`):**
```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### 1.3 Server Components Limitation

**Critical:** Async Server Components are NOT supported by Vitest (or Jest).

**Workaround:**
- Use E2E tests for async Server Components
- Test synchronous Server Components normally
- Extract testable logic into separate functions

**Example:**
```typescript
// ❌ Cannot unit test directly
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}

// ✅ Extract logic for testing
export async function getData() {
  return await fetchData()
}

export default async function Page() {
  const data = await getData()
  return <div>{data}</div>
}

// Test the extracted function
test('getData fetches correct data', async () => {
  const result = await getData()
  expect(result).toBeDefined()
})
```

### 1.4 Component Testing Best Practices

**React Testing Library Principles:**
- Test user behavior, not implementation details
- Query by accessible roles/labels
- Avoid testing internal state
- Use user-event for interactions

**Example Test:**
```typescript
import { expect, test, describe } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button Component', () => {
  test('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  test('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledOnce()
  })

  test('applies disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

---

## 2. Integration Testing

### 2.1 Testing TanStack Query Integration

**Setup Test Wrapper:**
```typescript
// test/utils/query-wrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: Infinity, // Keep data in cache
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}
```

**Testing Queries:**
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { createQueryWrapper } from '@/test/utils/query-wrapper'
import { useProjectQuery } from '@/hooks/useProjectQuery'
import nock from 'nock'

describe('useProjectQuery', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  test('fetches project data successfully', async () => {
    // Mock API response
    nock('http://localhost:8181')
      .get('/api/projects/123')
      .reply(200, {
        id: '123',
        name: 'Test Project',
        status: 'active',
      })

    const { result } = renderHook(() => useProjectQuery('123'), {
      wrapper: createQueryWrapper(),
    })

    // Initial state
    expect(result.current.isLoading).toBe(true)

    // Wait for success
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      id: '123',
      name: 'Test Project',
      status: 'active',
    })
  })

  test('handles query errors', async () => {
    nock('http://localhost:8181')
      .get('/api/projects/123')
      .reply(500, { message: 'Server error' })

    const { result } = renderHook(() => useProjectQuery('123'), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()
  })
})
```

**Testing Mutations:**
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { createQueryWrapper } from '@/test/utils/query-wrapper'
import { useCreateProject } from '@/hooks/useCreateProject'
import nock from 'nock'

describe('useCreateProject', () => {
  test('creates project successfully', async () => {
    const newProject = { name: 'New Project', description: 'Test' }

    nock('http://localhost:8181')
      .post('/api/projects', newProject)
      .reply(201, { id: '456', ...newProject })

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createQueryWrapper(),
    })

    result.current.mutate(newProject)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ id: '456' })
  })
})
```

**Testing Infinite Queries:**
```typescript
test('fetches paginated data', async () => {
  nock('http://localhost:8181')
    .get('/api/tasks')
    .query(true) // Match any query params
    .reply((uri) => {
      const url = new URL(`http://localhost:8181${uri}`)
      const page = parseInt(url.searchParams.get('page') || '1')

      return [200, {
        tasks: Array.from({ length: 10 }, (_, i) => ({
          id: `task-${page}-${i}`,
          title: `Task ${page}-${i}`,
        })),
        nextPage: page < 3 ? page + 1 : null,
      }]
    })
    .persist() // Allow multiple calls

  const { result } = renderHook(() => useTasksInfiniteQuery(), {
    wrapper: createQueryWrapper(),
  })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.pages).toHaveLength(1)

  // Fetch next page
  result.current.fetchNextPage()
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
})
```

**Recommended Mocking Approach:**
Use **Mock Service Worker (MSW)** for more robust API mocking:

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/projects/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Mock Project',
      status: 'active',
    })
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: crypto.randomUUID(),
      ...body,
    }, { status: 201 })
  }),
]

// test/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

// test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 2.2 Testing Zustand Stores

**Store Reset Pattern:**

Create a mock module to reset stores between tests:

```typescript
// test/mocks/zustand.ts
import { act } from '@testing-library/react'
import type * as ZustandExportedTypes from 'zustand'

export * from 'zustand'

const { create: actualCreate } =
  await vi.importActual<typeof ZustandExportedTypes>('zustand')

export const storeResetFns = new Set<() => void>()

const createUncurried = <T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  const store = actualCreate(stateCreator)
  const initialState = store.getInitialState()
  storeResetFns.add(() => {
    store.setState(initialState, true)
  })
  return store
}

export const create = (<T>(
  stateCreator: ZustandExportedTypes.StateCreator<T>,
) => {
  return typeof stateCreator === 'function'
    ? createUncurried(stateCreator)
    : createUncurried
}) as typeof ZustandExportedTypes.create

// Reset all stores after each test
afterEach(() => {
  act(() => {
    storeResetFns.forEach((resetFn) => {
      resetFn()
    })
  })
})
```

**Configure Vitest to use the mock:**
```typescript
// vitest.config.mts
export default defineConfig({
  test: {
    alias: {
      zustand: new URL('./test/mocks/zustand.ts', import.meta.url).pathname,
    },
  },
})
```

**Testing Store Actions:**
```typescript
import { renderHook, act } from '@testing-library/react'
import { useProjectStore } from '@/stores/projectStore'

describe('projectStore', () => {
  test('initializes with default state', () => {
    const { result } = renderHook(() => useProjectStore())

    expect(result.current.projects).toEqual([])
    expect(result.current.selectedProject).toBeNull()
  })

  test('adds project', () => {
    const { result } = renderHook(() => useProjectStore())

    act(() => {
      result.current.addProject({
        id: '1',
        name: 'Test Project',
        status: 'active',
      })
    })

    expect(result.current.projects).toHaveLength(1)
    expect(result.current.projects[0].name).toBe('Test Project')
  })

  test('selects project', () => {
    const { result } = renderHook(() => useProjectStore())

    act(() => {
      result.current.addProject({ id: '1', name: 'Project 1' })
      result.current.selectProject('1')
    })

    expect(result.current.selectedProject).toBe('1')
  })

  test('removes project', () => {
    const { result } = renderHook(() => useProjectStore())

    act(() => {
      result.current.addProject({ id: '1', name: 'Project 1' })
      result.current.removeProject('1')
    })

    expect(result.current.projects).toHaveLength(0)
  })
})
```

**Testing Computed Values:**
```typescript
test('computes active projects count', () => {
  const { result } = renderHook(() => useProjectStore())

  act(() => {
    result.current.addProject({ id: '1', status: 'active' })
    result.current.addProject({ id: '2', status: 'completed' })
    result.current.addProject({ id: '3', status: 'active' })
  })

  expect(result.current.activeProjectsCount).toBe(2)
})
```

**Testing Async Store Actions:**
```typescript
test('fetches projects from API', async () => {
  nock('http://localhost:8181')
    .get('/api/projects')
    .reply(200, [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ])

  const { result } = renderHook(() => useProjectStore())

  await act(async () => {
    await result.current.fetchProjects()
  })

  expect(result.current.projects).toHaveLength(2)
  expect(result.current.isLoading).toBe(false)
})
```

### 2.3 Testing Component + Store Integration

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectList } from '@/components/ProjectList'
import { useProjectStore } from '@/stores/projectStore'

describe('ProjectList with Store', () => {
  test('displays projects from store', () => {
    // Setup store state
    const { result } = renderHook(() => useProjectStore())
    act(() => {
      result.current.addProject({ id: '1', name: 'Project 1' })
      result.current.addProject({ id: '2', name: 'Project 2' })
    })

    render(<ProjectList />)

    expect(screen.getByText('Project 1')).toBeInTheDocument()
    expect(screen.getByText('Project 2')).toBeInTheDocument()
  })

  test('updates store when project is selected', async () => {
    const { result } = renderHook(() => useProjectStore())
    const user = userEvent.setup()

    act(() => {
      result.current.addProject({ id: '1', name: 'Project 1' })
    })

    render(<ProjectList />)

    await user.click(screen.getByText('Project 1'))

    expect(result.current.selectedProject).toBe('1')
  })
})
```

---

## 3. End-to-End (E2E) Testing

### 3.1 Recommended Framework: Playwright

**Winner:** Playwright (over Cypress)

**Rationale:**
- Native multi-browser support (Chromium, Firefox, WebKit)
- 35-45% faster parallel execution
- Free parallel testing (Cypress requires paid Dashboard)
- Better multi-tab/window support
- Mobile emulation out of the box
- Better for complex workflows (OAuth, multi-role)
- Active Microsoft backing

**When to Use Cypress:**
- Rapid prototyping with excellent DX
- Chrome-only testing is acceptable
- Time-travel debugging is critical
- Team prefers simpler, more interactive experience

### 3.2 Playwright Setup

**Installation:**
```bash
npm init playwright@latest
```

**Configuration (`playwright.config.ts`):**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['github'], // For GitHub Actions
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 3.3 E2E Testing Patterns

**Page Object Model:**
```typescript
// e2e/pages/ProjectsPage.ts
import { Page, Locator } from '@playwright/test'

export class ProjectsPage {
  readonly page: Page
  readonly createButton: Locator
  readonly projectList: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.createButton = page.getByRole('button', { name: /create project/i })
    this.projectList = page.getByTestId('project-list')
    this.searchInput = page.getByPlaceholder(/search projects/i)
  }

  async goto() {
    await this.page.goto('/projects')
  }

  async createProject(name: string, description: string) {
    await this.createButton.click()
    await this.page.getByLabel(/project name/i).fill(name)
    await this.page.getByLabel(/description/i).fill(description)
    await this.page.getByRole('button', { name: /save/i }).click()
  }

  async searchProjects(query: string) {
    await this.searchInput.fill(query)
    await this.searchInput.press('Enter')
  }

  async getProjectByName(name: string) {
    return this.page.getByRole('article').filter({ hasText: name })
  }
}
```

**Test File:**
```typescript
// e2e/projects.spec.ts
import { test, expect } from '@playwright/test'
import { ProjectsPage } from './pages/ProjectsPage'

test.describe('Projects Management', () => {
  let projectsPage: ProjectsPage

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    await projectsPage.goto()
  })

  test('creates a new project', async ({ page }) => {
    await projectsPage.createProject(
      'Test Project',
      'This is a test project'
    )

    await expect(page.getByText('Project created successfully')).toBeVisible()

    const project = await projectsPage.getProjectByName('Test Project')
    await expect(project).toBeVisible()
  })

  test('searches projects', async ({ page }) => {
    await projectsPage.searchProjects('Authentication')

    await expect(projectsPage.projectList).toContainText('Authentication')
  })

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/projects', (route) =>
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      })
    )

    await projectsPage.goto()

    await expect(page.getByText(/error loading projects/i)).toBeVisible()
  })
})
```

**Testing Async Server Components (E2E):**
```typescript
test('loads and displays async server component data', async ({ page }) => {
  await page.goto('/dashboard')

  // Wait for async data to load
  await expect(page.getByTestId('user-stats')).toBeVisible()

  // Verify data rendering
  await expect(page.getByText(/total projects:/i)).toBeVisible()
  await expect(page.getByText(/42/)).toBeVisible()
})
```

**Testing Multi-Step Flows:**
```typescript
test('completes task workflow', async ({ page }) => {
  // Navigate to tasks
  await page.goto('/tasks')

  // Create task
  await page.getByRole('button', { name: /new task/i }).click()
  await page.getByLabel(/title/i).fill('Implement feature')
  await page.getByLabel(/status/i).selectOption('todo')
  await page.getByRole('button', { name: /save/i }).click()

  // Verify creation
  await expect(page.getByText('Implement feature')).toBeVisible()

  // Update status
  await page.getByText('Implement feature').click()
  await page.getByLabel(/status/i).selectOption('doing')
  await page.getByRole('button', { name: /update/i }).click()

  // Verify update
  await expect(page.getByTestId('task-status')).toHaveText('doing')
})
```

**API Testing with Playwright:**
```typescript
test('API endpoint returns correct data', async ({ request }) => {
  const response = await request.get('/api/projects')

  expect(response.ok()).toBeTruthy()
  expect(response.status()).toBe(200)

  const data = await response.json()
  expect(data).toHaveProperty('projects')
  expect(Array.isArray(data.projects)).toBeTruthy()
})
```

---

## 4. Visual Regression Testing

### 4.1 Recommended Tool: Chromatic (for Design Systems) + Percy (for Full Pages)

**Dual Strategy:**
- **Chromatic** for component libraries and design systems
- **Percy** for full-page visual testing

### 4.2 Chromatic Setup

**Installation:**
```bash
npm install --save-dev chromatic
```

**Integration with Storybook:**
```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@chromatic-com/storybook',
  ],
  framework: '@storybook/nextjs',
}

export default config
```

**CI/CD Integration:**
```yaml
# .github/workflows/chromatic.yml
name: Chromatic

on: push

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Publish to Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          autoAcceptChanges: 'main'
```

### 4.3 Percy Setup

**Installation:**
```bash
npm install --save-dev @percy/cli @percy/playwright
```

**Playwright Integration:**
```typescript
// e2e/visual.spec.ts
import { test } from '@playwright/test'
import percySnapshot from '@percy/playwright'

test.describe('Visual Regression', () => {
  test('homepage renders correctly', async ({ page }) => {
    await page.goto('/')
    await percySnapshot(page, 'Homepage')
  })

  test('project dashboard renders correctly', async ({ page }) => {
    await page.goto('/projects')
    await percySnapshot(page, 'Projects Dashboard')
  })

  test('responsive mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await percySnapshot(page, 'Homepage - Mobile')
  })
})
```

**CI/CD Integration:**
```yaml
# .github/workflows/percy.yml
name: Percy Visual Tests

on: [pull_request]

jobs:
  percy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Run Percy tests
        run: npx percy exec -- npm run test:e2e
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

### 4.4 Visual Testing Best Practices

**Snapshot Strategy:**
- Component level: Use Chromatic with Storybook
- Page level: Use Percy with Playwright
- Critical flows: Snapshot at each step
- Responsive: Test at multiple viewports (mobile, tablet, desktop)

**Dealing with Dynamic Content:**
```typescript
// Freeze time for consistent snapshots
test('snapshot with dynamic content', async ({ page }) => {
  await page.addInitScript(() => {
    Date.now = () => new Date('2025-01-01').getTime()
  })

  await page.goto('/dashboard')
  await percySnapshot(page, 'Dashboard with frozen time')
})

// Hide dynamic elements
await percySnapshot(page, 'Dashboard', {
  percyCSS: `
    .timestamp { visibility: hidden; }
    .random-id { visibility: hidden; }
  `,
})
```

---

## 5. Performance Testing

### 5.1 Bundle Size Analysis

**Setup @next/bundle-analyzer:**
```bash
npm install --save-dev @next/bundle-analyzer
```

**Configuration (`next.config.ts`):**
```typescript
import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  // Your config
}

export default withBundleAnalyzer(nextConfig)
```

**Usage:**
```bash
ANALYZE=true npm run build
```

**CI Integration:**
```yaml
name: Bundle Size Check

on: pull_request

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci

      - name: Build and analyze
        run: ANALYZE=true npm run build

      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

**Size Limit Configuration:**
```json
// .size-limit.json
[
  {
    "name": "Client Bundle",
    "path": ".next/static/chunks/**/*.js",
    "limit": "200 KB"
  },
  {
    "name": "First Load JS",
    "path": ".next/static/**/*.js",
    "limit": "150 KB"
  }
]
```

### 5.2 Lighthouse CI

**Installation:**
```bash
npm install --save-dev @lhci/cli
```

**Configuration (`lighthouserc.json`):**
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/projects",
        "http://localhost:3000/tasks"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**CI Integration:**
```yaml
name: Lighthouse CI

on: pull_request

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### 5.3 Core Web Vitals Monitoring

**Real User Monitoring Setup:**
```typescript
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
```

**Custom Web Vitals Reporting:**
```typescript
// app/_lib/vitals.ts
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals'

export function reportWebVitals() {
  onCLS(sendToAnalytics)
  onFID(sendToAnalytics)
  onFCP(sendToAnalytics)
  onLCP(sendToAnalytics)
  onTTFB(sendToAnalytics)
}

function sendToAnalytics(metric: any) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
  })

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body)
  } else {
    fetch('/api/analytics', { body, method: 'POST', keepalive: true })
  }
}
```

---

## 6. Accessibility Testing

### 6.1 Automated Testing with axe-core

**Installation:**
```bash
npm install --save-dev @axe-core/playwright axe-core
```

**Playwright Integration:**
```typescript
// e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test('homepage has no accessibility violations', async ({ page }) => {
    await page.goto('/')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('project form is accessible', async ({ page }) => {
    await page.goto('/projects/new')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#project-form') // Scan specific region
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/')

    // Test tab order
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('href', '/projects')

    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('href', '/tasks')
  })
})
```

**Vitest Integration:**
```typescript
// test/utils/axe.ts
import { axe, toHaveNoViolations } from 'jest-axe'
import { expect } from 'vitest'

expect.extend(toHaveNoViolations)

export { axe }

// In tests:
import { render } from '@testing-library/react'
import { axe } from '@/test/utils/axe'
import { Button } from '@/components/ui/Button'

test('Button has no accessibility violations', async () => {
  const { container } = render(<Button>Click me</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### 6.2 CI/CD Integration

```yaml
# .github/workflows/accessibility.yml
name: Accessibility Tests

on: [pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build

      - name: Run accessibility tests
        run: npm run test:a11y

      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-violations
          path: test-results/a11y/
```

### 6.3 Manual Testing Checklist

**Screen Reader Testing:**
- NVDA (Windows - Free)
- JAWS (Windows - Paid)
- VoiceOver (macOS/iOS - Built-in)
- TalkBack (Android - Built-in)

**Keyboard Navigation:**
- Tab through all interactive elements
- Shift+Tab for reverse navigation
- Enter/Space to activate buttons/links
- Arrow keys for dropdowns/tabs
- Escape to close modals

**WCAG 2.2 AA Checklist:**
- [ ] Color contrast ratio ≥ 4.5:1 (text)
- [ ] Color contrast ratio ≥ 3:1 (UI components)
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Meaningful alt text for images
- [ ] Form labels properly associated
- [ ] Error messages clearly identify issues
- [ ] Responsive to 200% zoom
- [ ] No flashing content (seizure risk)

---

## 7. CI/CD Integration

### 7.1 Comprehensive GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unit
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  visual-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          autoAcceptChanges: 'main'

  accessibility-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Run accessibility tests
        run: npm run test:a11y

      - name: Upload results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-violations
          path: test-results/a11y/

  performance-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}

  code-quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Format check
        run: npm run format:check
```

### 7.2 Pre-commit Hooks

**Setup Husky + lint-staged:**
```bash
npm install --save-dev husky lint-staged
npx husky init
```

**Configuration (`.husky/pre-commit`):**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**lint-staged Configuration (`package.json`):**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}
```

---

## 8. Coverage Targets & Metrics

### 8.1 Recommended Coverage Thresholds

Based on industry best practices and 2025 standards:

**Overall Coverage: 80-90%**
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

**Critical Path Coverage: 95-100%**
- Authentication flows
- Payment processing
- Data mutations
- Security-sensitive operations

**Lower Priority Coverage: 60-70%**
- UI presentation components
- Static content pages
- Configuration files

### 8.2 Coverage Configuration

```typescript
// vitest.config.mts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Global thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },

      // Per-file thresholds
      perFile: true,

      // Exclude patterns
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types/**',
        '**/__mocks__/**',
        '**/e2e/**',
        '.next/',
        'coverage/',
      ],

      // Include only source files
      include: ['src/**/*.{ts,tsx}'],
    },
  },
})
```

### 8.3 Coverage Monitoring

**CI Integration:**
```yaml
- name: Check coverage thresholds
  run: npm run test:coverage -- --coverage.thresholds.autoUpdate=false

- name: Comment coverage on PR
  uses: romeovs/lcov-reporter-action@v0.3.1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    lcov-file: ./coverage/lcov.info
```

**Coverage Trends:**
```bash
# Use Codecov for trend analysis
- uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: unit
    fail_ci_if_error: true
```

---

## 9. Testing Strategy Summary

### 9.1 Test Pyramid

```
         /\
        /  \  E2E (10%)
       /----\
      /      \  Integration (20%)
     /--------\
    /          \  Unit (70%)
   /____________\
```

**Distribution:**
- **Unit Tests (70%)**: Fast, isolated, numerous
- **Integration Tests (20%)**: Medium speed, combined components
- **E2E Tests (10%)**: Slow, full user flows, critical paths only

### 9.2 What to Test at Each Level

**Unit Tests:**
- Pure functions
- React components (rendering, props, events)
- Custom hooks
- Zustand store actions
- Utility functions
- Business logic

**Integration Tests:**
- Components + TanStack Query
- Components + Zustand stores
- API client functions
- Form submissions with validation
- Multi-component interactions

**E2E Tests:**
- Complete user workflows
- Authentication flows
- CRUD operations
- Critical business processes
- Async Server Components
- Multi-page navigation

### 9.3 Quick Reference Matrix

| Test Type | Tool | Speed | Confidence | Maintenance | Use For |
|-----------|------|-------|------------|-------------|---------|
| **Unit** | Vitest + RTL | ⚡⚡⚡ | ⭐⭐ | Low | Components, hooks, utils |
| **Integration** | Vitest + RTL + MSW | ⚡⚡ | ⭐⭐⭐ | Medium | API integration, stores |
| **E2E** | Playwright | ⚡ | ⭐⭐⭐⭐ | High | User flows, async SC |
| **Visual** | Chromatic/Percy | ⚡⚡ | ⭐⭐⭐ | Low | UI consistency |
| **Performance** | Lighthouse CI | ⚡ | ⭐⭐⭐ | Low | Core Web Vitals |
| **A11y** | axe-core | ⚡⚡ | ⭐⭐⭐⭐ | Low | WCAG compliance |

---

## 10. Testing Tools Installation Checklist

**Complete installation script:**
```bash
# Unit & Integration Testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths @testing-library/jest-dom

# API Mocking
npm install -D msw

# E2E Testing
npm install -D @playwright/test

# Visual Regression
npm install -D chromatic @percy/cli @percy/playwright

# Accessibility
npm install -D @axe-core/playwright axe-core jest-axe

# Performance
npm install -D @next/bundle-analyzer @lhci/cli size-limit @size-limit/file

# Code Quality
npm install -D husky lint-staged

# Initialize
npx playwright install
npx husky init
```

**Package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.config.integration.mts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:a11y": "playwright test --grep @a11y",
    "test:visual": "percy exec -- playwright test",
    "test:lighthouse": "lhci autorun",
    "test:all": "npm run test:coverage && npm run test:e2e && npm run test:a11y",
    "analyze": "ANALYZE=true npm run build"
  }
}
```

---

## 11. Best Practices Summary

### Testing Best Practices

1. **Test user behavior, not implementation** - Focus on what users see/do
2. **Keep tests simple and focused** - One assertion per test when possible
3. **Use meaningful test names** - Describe the scenario and expected outcome
4. **Avoid testing library internals** - Test public APIs only
5. **Mock external dependencies** - Use MSW for API calls
6. **Reset state between tests** - Ensure test isolation
7. **Prefer integration over unit** - More confidence, less brittleness
8. **Use data-testid sparingly** - Prefer semantic queries (role, label, text)
9. **Run tests locally before pushing** - Use pre-commit hooks
10. **Keep tests close to source** - Colocate or use __tests__ folders

### Performance Best Practices

1. **Run tests in parallel** - Vitest and Playwright support this natively
2. **Use test.only for development** - Focus on current work
3. **Skip slow tests in watch mode** - Use @slow tag
4. **Optimize test fixtures** - Reuse setup when safe
5. **Use shallow rendering when appropriate** - But prefer full rendering for integration

### CI/CD Best Practices

1. **Run fastest tests first** - Fail fast on linting/type errors
2. **Cache dependencies** - Use GitHub Actions cache
3. **Parallelize jobs** - Run unit, e2e, visual tests concurrently
4. **Set appropriate timeouts** - Prevent hanging CI jobs
5. **Store artifacts** - Keep test reports for debugging
6. **Monitor test flakiness** - Track and fix flaky tests
7. **Block merges on test failures** - Enforce quality gates

---

## 12. Common Pitfalls & Solutions

### Problem: Tests timeout waiting for API responses
**Solution:** Use MSW or mock TanStack Query with fixed data

### Problem: Zustand state persists between tests
**Solution:** Implement the mock pattern from section 2.2

### Problem: Can't test async Server Components
**Solution:** Use E2E tests (Playwright) instead of unit tests

### Problem: Visual regression tests have too many false positives
**Solution:**
- Freeze dynamic content (dates, IDs)
- Use percyCSS to hide elements
- Set appropriate threshold for changes

### Problem: Flaky E2E tests in CI
**Solution:**
- Use explicit waits (waitFor, waitForLoadState)
- Increase retries in CI (2-3)
- Run in headed mode locally to debug
- Use test.step() for better error messages

### Problem: Coverage is low but feels adequate
**Solution:**
- Focus on critical paths first (80% of value)
- Don't chase 100% coverage
- Prioritize integration tests over unit
- Use coverage reports to find untested branches

---

## 13. Additional Resources

**Official Documentation:**
- [Next.js Testing Guide](https://nextjs.org/docs/app/guides/testing)
- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [React Testing Library](https://testing-library.com/react)
- [TanStack Query Testing](https://tanstack.com/query/latest/docs/react/guides/testing)
- [Zustand Testing](https://zustand.docs.pmnd.rs/guides/testing)

**Tools & Services:**
- [Chromatic](https://www.chromatic.com)
- [Percy](https://percy.io)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Codecov](https://codecov.io)
- [Mock Service Worker (MSW)](https://mswjs.io)

**Community Resources:**
- [Kent C. Dodds - Testing JavaScript](https://testingjavascript.com)
- [Epic React - Testing Patterns](https://epicreact.dev)

---

## Appendix: Sample Project Structure

```
project-root/
├── src/
│   ├── app/
│   │   ├── __tests__/              # App-level tests
│   │   └── ...
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx     # Colocated unit tests
│   │   │   └── Button.stories.tsx  # Storybook stories
│   │   └── ...
│   ├── hooks/
│   │   ├── useProjectQuery.ts
│   │   └── useProjectQuery.test.ts
│   ├── stores/
│   │   ├── projectStore.ts
│   │   └── projectStore.test.ts
│   └── lib/
│       ├── api.ts
│       └── api.test.ts
├── test/
│   ├── setup.ts                    # Test setup
│   ├── mocks/
│   │   ├── zustand.ts              # Zustand mock
│   │   ├── handlers.ts             # MSW handlers
│   │   └── server.ts               # MSW server
│   └── utils/
│       ├── query-wrapper.tsx       # TanStack Query wrapper
│       └── test-utils.tsx          # Custom render functions
├── e2e/
│   ├── pages/                      # Page Object Models
│   │   └── ProjectsPage.ts
│   ├── projects.spec.ts            # E2E tests
│   ├── accessibility.spec.ts       # A11y tests
│   └── visual.spec.ts              # Visual regression tests
├── .github/
│   └── workflows/
│       ├── test.yml                # Main CI workflow
│       ├── chromatic.yml           # Visual tests
│       └── accessibility.yml       # A11y tests
├── vitest.config.mts               # Vitest config
├── playwright.config.ts            # Playwright config
├── lighthouserc.json               # Lighthouse config
└── .size-limit.json                # Bundle size limits
```

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** Archon Knowledge Base
**Status:** Production-Ready

This guide should be reviewed quarterly and updated as tools/best practices evolve.
