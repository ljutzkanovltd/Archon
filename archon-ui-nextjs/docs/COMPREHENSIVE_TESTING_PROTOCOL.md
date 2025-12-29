# Archon UI Next.js - Comprehensive Testing Protocol

**Document Version**: 1.0.0
**Date**: 2025-12-23
**Based on**: Architectural Analysis + Archon Knowledge Base + Industry Best Practices
**Stack**: Next.js 15.5.6, React 18, TypeScript 5.8, TanStack Query, Zustand

---

## Executive Summary

This document provides a comprehensive testing methodology for the Archon UI Next.js application, combining:
- **Architectural Analysis** findings (67 files, 10,923 LOC analyzed)
- **Archon Knowledge Base** insights (Next.js, FastAPI, React testing patterns)
- **Industry Best Practices** (2025 standards)

**Critical Issues Found**:
1. ❌ Knowledge Base edit functionality not implemented
2. ❌ No error boundaries (app crashes on unhandled errors)
3. ⚠️ Inconsistent error handling (alerts vs state)
4. ⚠️ No automated tests currently implemented
5. ⚠️ No code splitting (performance impact)

**Quality Score**: B+ (87/100)

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [Testing Pyramid](#2-testing-pyramid)
3. [Unit Testing](#3-unit-testing)
4. [Integration Testing](#4-integration-testing)
5. [E2E Testing](#5-e2e-testing)
6. [Visual Regression Testing](#6-visual-regression-testing)
7. [Performance Testing](#7-performance-testing)
8. [Accessibility Testing](#8-accessibility-testing)
9. [Backend Integration Testing](#9-backend-integration-testing)
10. [Critical Bug Fixes](#10-critical-bug-fixes)
11. [CI/CD Integration](#11-cicd-integration)
12. [Coverage Targets](#12-coverage-targets)

---

## 1. Testing Strategy Overview

### 1.1 Recommended Tool Stack

Based on Archon KB research and Next.js 15 App Router requirements:

| Type | Tool | Reason |
|------|------|--------|
| **Unit/Integration** | Vitest + React Testing Library | 35-45% faster than Jest, native Vite integration, Next.js 15 optimized |
| **E2E** | Playwright | Multi-browser, free parallel execution, better async component support |
| **Visual Regression** | Chromatic + Percy | Chromatic for components, Percy for full pages |
| **Performance** | Lighthouse CI + Bundle Analyzer | Core Web Vitals tracking, bundle size monitoring |
| **Accessibility** | axe-core + Pa11y | WCAG 2.2 AA compliance, automated + manual testing |
| **API Mocking** | MSW (Mock Service Worker) | HTTP-level mocking, realistic network behavior |
| **Coverage** | Vitest Coverage (v8) | Built-in, fast, accurate |

### 1.2 Test Distribution (Test Pyramid)

```
     /\
    /E2E\       10% - Critical user flows (5-10 tests)
   /------\
  /Integr.\    20% - Component + Store + API (15-20 tests)
 /----------\
/   Unit     \ 70% - Functions, hooks, components (50+ tests)
--------------
```

**Total Target**: 75-90 automated tests

---

## 2. Testing Pyramid

### 2.1 Unit Tests (70% - ~50-60 tests)

**What to Test**:
- ✅ Utility functions (`lib/utils.ts`, `lib/apiClient.ts` transformations)
- ✅ Custom hooks (useDebounce, useBooleanState, useSmartPolling)
- ✅ Zustand store actions and selectors
- ✅ Individual component rendering and props
- ✅ Pure transformation functions

**What NOT to Test**:
- ❌ Async Server Components (use E2E instead per Archon KB)
- ❌ Complex user flows (use integration/E2E)
- ❌ Actual API endpoints (use mocks)

### 2.2 Integration Tests (20% - ~15-20 tests)

**What to Test**:
- ✅ Component + Store + API together
- ✅ TanStack Query hooks with data fetching
- ✅ Form submission flows (create/update)
- ✅ Filter combinations (search + type + tags)
- ✅ Modal/dialog interactions

### 2.3 E2E Tests (10% - ~5-10 tests)

**What to Test**:
- ✅ Complete user journeys (login → create project → add task)
- ✅ Async Server Components
- ✅ Multi-page workflows
- ✅ Real backend integration (test environment)
- ✅ Critical business flows

---

## 3. Unit Testing

### 3.1 Setup (Vitest)

**Installation**:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event vite-tsconfig-paths @vitest/coverage-v8
```

**Configuration** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'vitest.config.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Setup File** (`vitest.setup.ts`):
```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

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
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
```

### 3.2 Testing Patterns

#### A. Testing Utility Functions

**Example**: `lib/utils.ts` - `cn()` function
```typescript
// __tests__/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('should handle Tailwind merge conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
```

#### B. Testing Custom Hooks

**Example**: `hooks/useDebounce.ts`
```typescript
// __tests__/hooks/useDebounce.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500))
    expect(result.current).toBe('test')
  })

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated' })
    expect(result.current).toBe('initial') // Still old value

    vi.advanceTimersByTime(500)
    await waitFor(() => {
      expect(result.current).toBe('updated') // Now updated
    })
  })
})
```

#### C. Testing Zustand Stores

**Example**: `store/useProjectStore.ts`
```typescript
// __tests__/store/useProjectStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useProjectStore } from '@/store/useProjectStore'
import { projectsApi } from '@/lib/apiClient'

// Mock API
vi.mock('@/lib/apiClient', () => ({
  projectsApi: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}))

describe('useProjectStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useProjectStore.getState())
    act(() => {
      result.current.projects = []
      result.current.selectedProject = null
      result.current.error = null
    })
    vi.clearAllMocks()
  })

  it('should fetch projects successfully', async () => {
    const mockProjects = [
      { id: '1', title: 'Test Project', description: 'Test' },
    ]
    vi.mocked(projectsApi.getProjects).mockResolvedValue({
      projects: mockProjects,
      total: 1,
    })

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.fetchProjects()
    })

    expect(result.current.projects).toEqual(mockProjects)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle fetch errors', async () => {
    vi.mocked(projectsApi.getProjects).mockRejectedValue(
      new Error('Network error')
    )

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.fetchProjects()
    })

    expect(result.current.error).toBe('Failed to fetch projects')
    expect(result.current.isLoading).toBe(false)
  })

  it('should create project with optimistic update', async () => {
    const newProject = { title: 'New Project', description: 'New' }
    const createdProject = { id: '1', ...newProject }

    vi.mocked(projectsApi.createProject).mockResolvedValue(createdProject)

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.createProject(newProject)
    })

    expect(result.current.projects).toContainEqual(createdProject)
  })
})
```

#### D. Testing Components

**Example**: `components/KnowledgeBase/KnowledgeSourceCard.tsx`
```typescript
// __tests__/components/KnowledgeBase/KnowledgeSourceCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeSourceCard } from '@/components/KnowledgeBase'
import { KnowledgeSource } from '@/lib/types'

const mockSource: KnowledgeSource = {
  source_id: '1',
  title: 'Test Source',
  summary: 'Test summary',
  knowledge_type: 'technical',
  tags: ['React', 'TypeScript'],
  documents_count: 10,
  code_examples_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

describe('KnowledgeSourceCard', () => {
  it('should render source information correctly', () => {
    render(<KnowledgeSourceCard source={mockSource} />)

    expect(screen.getByText('Test Source')).toBeInTheDocument()
    expect(screen.getByText('Test summary')).toBeInTheDocument()
    expect(screen.getByText('technical')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('should call onView when View button is clicked', async () => {
    const onView = vi.fn()
    const user = userEvent.setup()

    render(<KnowledgeSourceCard source={mockSource} onView={onView} />)

    const viewButton = screen.getByRole('button', { name: /view/i })
    await user.click(viewButton)

    expect(onView).toHaveBeenCalledWith(mockSource)
    expect(onView).toHaveBeenCalledTimes(1)
  })

  it('should apply technical top edge color class', () => {
    const { container } = render(<KnowledgeSourceCard source={mockSource} />)
    const card = container.firstChild as HTMLElement

    expect(card).toHaveClass('border-t-blue-500')
  })

  it('should apply business top edge color for business type', () => {
    const businessSource = { ...mockSource, knowledge_type: 'business' as const }
    const { container } = render(<KnowledgeSourceCard source={businessSource} />)
    const card = container.firstChild as HTMLElement

    expect(card).toHaveClass('border-t-purple-500')
  })

  it('should display counts correctly', () => {
    render(<KnowledgeSourceCard source={mockSource} />)

    expect(screen.getByText(/10 documents/i)).toBeInTheDocument()
    expect(screen.getByText(/5 examples/i)).toBeInTheDocument()
  })
})
```

---

## 4. Integration Testing

### 4.1 Testing Components + Store + API

**Pattern**: Wrap component with providers + mock API

**Example**: Projects list with filtering
```typescript
// __tests__/integration/ProjectsList.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectsPage from '@/app/projects/page'
import { projectsApi } from '@/lib/apiClient'

// Mock API
vi.mock('@/lib/apiClient')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('Projects List Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load and display projects', async () => {
    const mockProjects = [
      { id: '1', title: 'Project 1', description: 'Desc 1' },
      { id: '2', title: 'Project 2', description: 'Desc 2' },
    ]

    vi.mocked(projectsApi.getProjects).mockResolvedValue({
      projects: mockProjects,
      total: 2,
    })

    render(<ProjectsPage />, { wrapper: createWrapper() })

    // Loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument()
      expect(screen.getByText('Project 2')).toBeInTheDocument()
    })
  })

  it('should filter projects by search', async () => {
    const mockProjects = [
      { id: '1', title: 'React Project', description: 'React' },
      { id: '2', title: 'Vue Project', description: 'Vue' },
    ]

    vi.mocked(projectsApi.getProjects).mockResolvedValue({
      projects: mockProjects,
      total: 2,
    })

    const user = userEvent.setup()
    render(<ProjectsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('React Project')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'React')

    await waitFor(() => {
      expect(screen.getByText('React Project')).toBeInTheDocument()
      expect(screen.queryByText('Vue Project')).not.toBeInTheDocument()
    })
  })

  it('should handle API errors gracefully', async () => {
    vi.mocked(projectsApi.getProjects).mockRejectedValue(
      new Error('Network error')
    )

    render(<ProjectsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
})
```

### 4.2 Testing TanStack Query Hooks

**Pattern**: Use QueryClientProvider wrapper
```typescript
// __tests__/hooks/useProgressQueries.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProgressList } from '@/hooks/useProgressQueries'
import { progressApi } from '@/lib/apiClient'

vi.mock('@/lib/apiClient')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useProgressList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch progress operations', async () => {
    const mockProgress = [
      { id: '1', operation_id: 'op1', progress_percentage: 50 },
    ]

    vi.mocked(progressApi.getAll).mockResolvedValue(mockProgress)

    const { result } = renderHook(() => useProgressList(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(mockProgress)
    })
  })

  it('should handle empty progress list', async () => {
    vi.mocked(progressApi.getAll).mockResolvedValue([])

    const { result } = renderHook(() => useProgressList(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data).toEqual([])
      expect(result.current.isSuccess).toBe(true)
    })
  })
})
```

---

## 5. E2E Testing

### 5.1 Playwright Setup

**Installation**:
```bash
npm install -D @playwright/test
npx playwright install
```

**Configuration** (`playwright.config.ts`):
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
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### 5.2 E2E Test Examples

#### A. Critical User Flow - Project Creation
```typescript
// e2e/projects/create-project.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Project Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
  })

  test('should create a new project successfully', async ({ page }) => {
    // Click "New Project" button
    await page.click('button:has-text("New Project")')

    // Fill form
    await page.fill('input[name="title"]', 'Test E2E Project')
    await page.fill('textarea[name="description"]', 'E2E test description')

    // Submit
    await page.click('button[type="submit"]:has-text("Create Project")')

    // Verify success
    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9-]+/)
    await expect(page.locator('h1')).toContainText('Test E2E Project')
  })

  test('should show validation error for empty title', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await page.click('button[type="submit"]:has-text("Create Project")')

    await expect(page.locator('text=Title is required')).toBeVisible()
  })

  test('should navigate back on cancel', async ({ page }) => {
    await page.click('button:has-text("New Project")')
    await page.click('button:has-text("Cancel")')

    await expect(page).toHaveURL('/projects')
  })
})
```

#### B. Knowledge Base Search Flow
```typescript
// e2e/knowledge-base/search.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge-base')
  })

  test('should filter sources by search query', async ({ page }) => {
    // Type in search
    await page.fill('input[placeholder*="Search"]', 'React')

    // Wait for debounce (500ms)
    await page.waitForTimeout(600)

    // Verify filtered results
    const cards = page.locator('[data-testid="knowledge-source-card"]')
    await expect(cards.first()).toContainText('React')
  })

  test('should filter by knowledge type', async ({ page }) => {
    // Click "Technical" filter
    await page.click('button:has-text("Technical")')

    // Verify only technical sources shown
    const technicalBadges = page.locator('text=technical')
    await expect(technicalBadges).toHaveCount(await technicalBadges.count())
  })

  test('should combine multiple filters', async ({ page }) => {
    // Search
    await page.fill('input[placeholder*="Search"]', 'TypeScript')
    await page.waitForTimeout(600)

    // Type filter
    await page.click('button:has-text("Technical")')

    // Tag filter
    await page.click('button:has-text("Add Tag")')
    await page.fill('input[placeholder*="Add tag"]', 'JavaScript')
    await page.press('input[placeholder*="Add tag"]', 'Enter')

    // Verify combined filter results
    const results = page.locator('[data-testid="knowledge-source-card"]')
    const count = await results.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should show empty state when no results', async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', 'xyznonexistent123')
    await page.waitForTimeout(600)

    await expect(page.locator('text=No sources found')).toBeVisible()
  })
})
```

#### C. Async Server Component Testing
```typescript
// e2e/dashboard/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Dashboard (Async Server Component)', () => {
  test('should load dashboard with recent projects', async ({ page }) => {
    await page.goto('/')

    // Wait for async data to load
    await page.waitForLoadState('networkidle')

    // Verify recent projects section
    await expect(page.locator('h2:has-text("Recent Projects")')).toBeVisible()

    // Verify project cards rendered
    const projectCards = page.locator('[data-testid="project-card"]')
    const count = await projectCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should display progress tracking', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify progress section exists
    await expect(page.locator('text=Active Operations')).toBeVisible()
  })
})
```

### 5.3 Page Object Model (POM)

**Pattern**: Create reusable page objects
```typescript
// e2e/pages/ProjectsPage.ts
import { Page, Locator } from '@playwright/test'

export class ProjectsPage {
  readonly page: Page
  readonly newProjectButton: Locator
  readonly searchInput: Locator
  readonly projectCards: Locator

  constructor(page: Page) {
    this.page = page
    this.newProjectButton = page.locator('button:has-text("New Project")')
    this.searchInput = page.locator('input[placeholder*="Search"]')
    this.projectCards = page.locator('[data-testid="project-card"]')
  }

  async goto() {
    await this.page.goto('/projects')
  }

  async createProject(title: string, description: string) {
    await this.newProjectButton.click()
    await this.page.fill('input[name="title"]', title)
    await this.page.fill('textarea[name="description"]', description)
    await this.page.click('button[type="submit"]')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(600) // Debounce
  }

  async getProjectCount() {
    return await this.projectCards.count()
  }
}

// Usage in test:
test('should create project via POM', async ({ page }) => {
  const projectsPage = new ProjectsPage(page)
  await projectsPage.goto()
  await projectsPage.createProject('POM Test', 'POM Description')
  expect(page.url()).toContain('/projects/')
})
```

---

## 6. Visual Regression Testing

### 6.1 Chromatic Setup (Component Visual Testing)

**Installation**:
```bash
npm install -D chromatic
```

**Storybook Stories**:
```typescript
// src/components/KnowledgeBase/KnowledgeSourceCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { KnowledgeSourceCard } from './KnowledgeSourceCard'

const meta: Meta<typeof KnowledgeSourceCard> = {
  title: 'KnowledgeBase/KnowledgeSourceCard',
  component: KnowledgeSourceCard,
  parameters: {
    layout: 'padded',
    chromatic: { viewports: [320, 768, 1024, 1440] },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const mockSource = {
  source_id: '1',
  title: 'React Hooks Guide',
  summary: 'Comprehensive guide to React Hooks',
  knowledge_type: 'technical' as const,
  tags: ['React', 'JavaScript'],
  documents_count: 12,
  code_examples_count: 8,
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-12-20T14:22:00Z',
}

export const Default: Story = {
  args: {
    source: mockSource,
  },
}

export const Technical: Story = {
  args: {
    source: { ...mockSource, knowledge_type: 'technical' },
  },
}

export const Business: Story = {
  args: {
    source: { ...mockSource, knowledge_type: 'business' },
  },
}

export const HoverState: Story = {
  args: {
    source: mockSource,
  },
  parameters: {
    pseudo: { hover: true },
  },
}

export const DarkMode: Story = {
  args: {
    source: mockSource,
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
}
```

**Run Chromatic**:
```bash
npx chromatic --project-token=<your-token>
```

### 6.2 Percy Setup (Full Page Visual Testing)

**Installation**:
```bash
npm install -D @percy/cli @percy/playwright
```

**Percy Snapshots in Playwright**:
```typescript
// e2e/visual/pages.spec.ts
import { test } from '@playwright/test'
import percySnapshot from '@percy/playwright'

test.describe('Visual Regression - Pages', () => {
  test('Knowledge Base page visual snapshot', async ({ page }) => {
    await page.goto('/knowledge-base')
    await page.waitForLoadState('networkidle')

    await percySnapshot(page, 'Knowledge Base - Grid View')

    // Switch to table view
    await page.click('[aria-label="Table view"]')
    await percySnapshot(page, 'Knowledge Base - Table View')
  })

  test('Projects page responsive snapshots', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')

    // Desktop
    await percySnapshot(page, 'Projects - Desktop', {
      widths: [1280],
    })

    // Tablet
    await percySnapshot(page, 'Projects - Tablet', {
      widths: [768],
    })

    // Mobile
    await percySnapshot(page, 'Projects - Mobile', {
      widths: [375],
    })
  })

  test('Dashboard dark mode snapshot', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await percySnapshot(page, 'Dashboard - Dark Mode')
  })
})
```

---

## 7. Performance Testing

### 7.1 Bundle Analysis

**Setup**:
```bash
npm install -D @next/bundle-analyzer
```

**Configuration** (`next.config.js`):
```javascript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // ... rest of config
})
```

**Run Analysis**:
```bash
ANALYZE=true npm run build
```

**Budget Thresholds**:
```json
{
  "budgets": [
    {
      "path": "/_next/static/**",
      "maxSize": "200kb",
      "warning": "150kb"
    },
    {
      "path": "/page",
      "maxSize": "100kb",
      "warning": "75kb"
    }
  ]
}
```

### 7.2 Lighthouse CI

**Installation**:
```bash
npm install -D @lhci/cli
```

**Configuration** (`.lighthouserc.json`):
```json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run start",
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/projects",
        "http://localhost:3000/knowledge-base"
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

**Run Lighthouse**:
```bash
lhci autorun
```

### 7.3 Performance Testing with Playwright

```typescript
// e2e/performance/load-times.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Metrics', () => {
  test('Knowledge Base should load within 2 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/knowledge-base')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(2000)
    console.log(`Knowledge Base load time: ${loadTime}ms`)
  })

  test('should measure Core Web Vitals', async ({ page }) => {
    await page.goto('/knowledge-base')

    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          resolve(entries.map((entry) => ({
            name: entry.name,
            value: entry.startTime,
          })))
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
      })
    })

    console.log('Web Vitals:', metrics)
  })
})
```

---

## 8. Accessibility Testing

### 8.1 axe-core Integration

**Installation**:
```bash
npm install -D @axe-core/playwright
```

**Setup**:
```typescript
// e2e/accessibility/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test('Knowledge Base page should have no accessibility violations', async ({ page }) => {
    await page.goto('/knowledge-base')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('Projects page should be keyboard navigable', async ({ page }) => {
    await page.goto('/projects')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    const firstFocusable = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT']).toContain(firstFocusable)

    // Verify skip links
    await page.keyboard.press('Tab')
    const skipLink = await page.evaluate(() => document.activeElement?.textContent)
    expect(skipLink).toContain('Skip to main content')
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/knowledge-base')

    // Check search input has label
    const searchInput = page.locator('input[placeholder*="Search"]')
    const ariaLabel = await searchInput.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()

    // Check buttons have accessible names
    const buttons = page.locator('button')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const name = await button.textContent() || await button.getAttribute('aria-label')
      expect(name).toBeTruthy()
    }
  })
})
```

### 8.2 Keyboard Navigation Testing

```typescript
// e2e/accessibility/keyboard-nav.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test('should navigate Knowledge Base with keyboard only', async ({ page }) => {
    await page.goto('/knowledge-base')

    // Focus search input
    await page.keyboard.press('Tab')
    await expect(page.locator('input[placeholder*="Search"]')).toBeFocused()

    // Navigate to filters
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Activate filter with Enter
    await page.keyboard.press('Enter')

    // Navigate cards with Arrow keys (if grid)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')

    // Activate card with Enter/Space
    await page.keyboard.press('Enter')
  })

  test('should trap focus in modal', async ({ page }) => {
    await page.goto('/projects')
    await page.click('button:has-text("New Project")')

    // Modal should be open
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Tab through modal elements
    await page.keyboard.press('Tab') // Title input
    await page.keyboard.press('Tab') // Description textarea
    await page.keyboard.press('Tab') // Create button
    await page.keyboard.press('Tab') // Cancel button
    await page.keyboard.press('Tab') // Should cycle back to title

    // Verify focus trapped
    await expect(page.locator('input[name="title"]')).toBeFocused()

    // Escape should close modal
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })
})
```

---

## 9. Backend Integration Testing

### 9.1 FastAPI Mock with MSW

**Installation**:
```bash
npm install -D msw
```

**Setup** (`mocks/handlers.ts`):
```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Projects
  http.get('http://localhost:8181/api/projects', () => {
    return HttpResponse.json({
      projects: [
        { id: '1', title: 'Mock Project 1', description: 'Mock' },
        { id: '2', title: 'Mock Project 2', description: 'Mock' },
      ],
      total: 2,
    })
  }),

  http.post('http://localhost:8181/api/projects', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'new-id',
      ...body,
      created_at: new Date().toISOString(),
    })
  }),

  // Knowledge Base
  http.get('http://localhost:8181/api/rag/sources', () => {
    return HttpResponse.json([
      {
        source_id: '1',
        title: 'Mock Source',
        knowledge_type: 'technical',
        tags: ['Mock'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  // Error scenarios
  http.get('http://localhost:8181/api/projects/error', () => {
    return HttpResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }),
]
```

**Setup in Tests** (`vitest.setup.ts`):
```typescript
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 9.2 FastAPI Dependency Override Pattern (from Archon KB)

For backend testing:
```python
# tests/test_projects.py
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user

client = TestClient(app)

async def override_get_current_user():
    return {"user_id": "test-user", "email": "test@example.com"}

app.dependency_overrides[get_current_user] = override_get_current_user

def test_create_project():
    response = client.post(
        "/api/projects",
        json={"title": "Test Project", "description": "Test"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Test Project"

# Reset after tests
app.dependency_overrides = {}
```

---

## 10. Critical Bug Fixes

### 10.1 Knowledge Base Edit Functionality

**Issue**: Edit not implemented (TODO on line 159 of `/app/knowledge-base/page.tsx`)

**Fix Implementation**:

**Step 1**: Add update method to API client
```typescript
// src/lib/apiClient.ts
export const knowledgeBaseApi = {
  // ... existing methods

  // ADD THIS:
  updateSource: async (sourceId: string, data: Partial<KnowledgeSource>) => {
    const response = await axiosInstance.put(`/api/rag/sources/${sourceId}`, data)
    return response.data
  },
}
```

**Step 2**: Create Edit Modal Component
```typescript
// src/components/KnowledgeBase/EditSourceModal.tsx
"use client";

import { useState, useEffect } from "react";
import { KnowledgeSource } from "@/lib/types";
import { CustomModal } from "@/components/common";
import ButtonComponent from "@/components/ButtonComponent";
import { ButtonVariant, ButtonType } from "@/lib/types";

interface EditSourceModalProps {
  source: KnowledgeSource | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (sourceId: string, data: Partial<KnowledgeSource>) => Promise<void>;
}

export function EditSourceModal({
  source,
  isOpen,
  onClose,
  onSave,
}: EditSourceModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    knowledge_type: "technical" as const,
    level: "intermediate" as const,
    tags: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source) {
      setFormData({
        title: source.title || "",
        summary: source.summary || "",
        knowledge_type: source.knowledge_type || "technical",
        level: source.level || "intermediate",
        tags: source.tags || [],
      });
    }
  }, [source]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(source.source_id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update source");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagAdd = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  if (!source) return null;

  return (
    <CustomModal
      open={isOpen}
      close={onClose}
      title="Edit Knowledge Source"
      description="Update source metadata"
      size="MEDIUM"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Summary
          </label>
          <textarea
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Knowledge Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Knowledge Type
          </label>
          <select
            value={formData.knowledge_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                knowledge_type: e.target.value as "technical" | "business",
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="technical">Technical</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Level
          </label>
          <select
            value={formData.level}
            onChange={(e) =>
              setFormData({
                ...formData,
                level: e.target.value as "basic" | "intermediate" | "advanced",
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm dark:bg-gray-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleTagRemove(tag)}
                  className="text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add tag and press Enter"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleTagAdd(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4">
          <ButtonComponent
            name="Cancel"
            variant={ButtonVariant.GHOST}
            type={ButtonType.BUTTON}
            onClick={onClose}
            disabled={isSubmitting}
          />
          <ButtonComponent
            name={isSubmitting ? "Saving..." : "Save Changes"}
            variant={ButtonVariant.PRIMARY}
            type={ButtonType.SUBMIT}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
        </div>
      </form>
    </CustomModal>
  );
}
```

**Step 3**: Update Knowledge Base Page
```typescript
// src/app/knowledge-base/page.tsx
// Add to imports:
import { EditSourceModal } from "@/components/KnowledgeBase/EditSourceModal";
import { knowledgeBaseApi } from "@/lib/apiClient";

// Add state:
const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

// Replace handleEditSource:
const handleEditSource = (source: KnowledgeSource) => {
  setEditingSource(source);
  setIsEditModalOpen(true);
};

// Add save handler:
const handleSaveEdit = async (sourceId: string, data: Partial<KnowledgeSource>) => {
  try {
    await knowledgeBaseApi.updateSource(sourceId, data);

    // Update local state
    setSources((prev) =>
      prev.map((s) => (s.source_id === sourceId ? { ...s, ...data } : s))
    );

    // Show success message (replace with toast in production)
    alert("Source updated successfully!");
  } catch (error) {
    console.error("Failed to update source:", error);
    throw error;
  }
};

// Add to JSX before return:
<EditSourceModal
  source={editingSource}
  isOpen={isEditModalOpen}
  onClose={() => {
    setIsEditModalOpen(false);
    setEditingSource(null);
  }}
  onSave={handleSaveEdit}
/>
```

**Step 4**: Export new component
```typescript
// src/components/KnowledgeBase/index.ts
export { EditSourceModal } from "./EditSourceModal";
```

**Test**:
```typescript
// __tests__/components/KnowledgeBase/EditSourceModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditSourceModal } from '@/components/KnowledgeBase/EditSourceModal'

const mockSource = {
  source_id: '1',
  title: 'Test Source',
  summary: 'Test summary',
  knowledge_type: 'technical' as const,
  level: 'intermediate' as const,
  tags: ['React', 'TypeScript'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

describe('EditSourceModal', () => {
  it('should pre-populate form with source data', () => {
    render(
      <EditSourceModal
        source={mockSource}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('Test Source')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test summary')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('should call onSave with updated data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <EditSourceModal
        source={mockSource}
        isOpen={true}
        onClose={vi.fn()}
        onSave={onSave}
      />
    )

    const titleInput = screen.getByDisplayValue('Test Source')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Title')

    const submitButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('1', expect.objectContaining({
        title: 'Updated Title',
      }))
    })
  })

  it('should allow adding and removing tags', async () => {
    const user = userEvent.setup()

    render(
      <EditSourceModal
        source={mockSource}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    // Add tag
    const tagInput = screen.getByPlaceholderText(/add tag/i)
    await user.type(tagInput, 'Next.js{Enter}')

    expect(screen.getByText('Next.js')).toBeInTheDocument()

    // Remove tag
    const removeButtons = screen.getAllByText('×')
    await user.click(removeButtons[0]) // Remove first tag

    await waitFor(() => {
      expect(screen.queryByText('React')).not.toBeInTheDocument()
    })
  })
})
```

### 10.2 Add Error Boundary

**Create Error Boundary Component**:
```typescript
// src/components/ErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import ButtonComponent from "./ButtonComponent";
import { ButtonVariant } from "@/lib/types";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Send to error tracking service (Sentry, etc.)
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-600 dark:text-red-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="text-left mb-6">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Error Details
                </summary>
                <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <ButtonComponent
                name="Try Again"
                variant={ButtonVariant.PRIMARY}
                onClick={this.handleReset}
              />
              <ButtonComponent
                name="Go to Dashboard"
                variant={ButtonVariant.GHOST}
                onClick={() => (window.location.href = "/")}
              />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Wrap App in Layout**:
```typescript
// src/app/layout.tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {/* ... existing providers */}
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

### 10.3 Replace alert() with Toast System

**Install react-hot-toast**:
```bash
npm install react-hot-toast
```

**Create Toast Provider**:
```typescript
// src/providers/ToastProvider.tsx
"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#363636",
          color: "#fff",
        },
        success: {
          iconTheme: {
            primary: "#10B981",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#EF4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
```

**Create useToast Hook**:
```typescript
// src/hooks/useToast.ts
import toast from "react-hot-toast";

export const useToast = () => {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    loading: (message: string) => toast.loading(message),
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string;
        error: string;
      }
    ) => toast.promise(promise, messages),
  };
};
```

**Replace alert() Usage**:
```typescript
// Before (knowledge-base/page.tsx):
alert("Source deleted successfully!");

// After:
const { success, error } = useToast();
success("Source deleted successfully!");
```

---

## 11. CI/CD Integration

### 11.1 GitHub Actions Workflow

**Create** (`.github/workflows/test.yml`):
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      backend:
        image: archon-backend:latest
        ports:
          - 8181:8181

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun

  visual-regression:
    name: Visual Regression (Percy)
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build Storybook
        run: npm run build-storybook

      - name: Run Percy
        run: npx percy storybook ./storybook-static
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}

  bundle-size:
    name: Bundle Size Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Check bundle size
        run: |
          ANALYZE=true npm run build
          npx bundlewatch
```

### 11.2 Pre-commit Hooks (Husky + lint-staged)

**Install**:
```bash
npm install -D husky lint-staged
npx husky install
```

**Setup** (`package.json`):
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  },
  "scripts": {
    "prepare": "husky install"
  }
}
```

**Pre-commit Hook** (`.husky/pre-commit`):
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

---

## 12. Coverage Targets

### 12.1 Recommended Thresholds (2025 Standards)

| Category | Lines | Functions | Statements | Branches |
|----------|-------|-----------|------------|----------|
| **Overall** | 80-90% | 80-90% | 80-90% | 75-85% |
| **Critical Paths** | 95-100% | 95-100% | 95-100% | 90-100% |
| **Utilities** | 90-100% | 90-100% | 90-100% | 85-95% |
| **UI Components** | 70-85% | 70-85% | 70-85% | 65-80% |
| **Stores** | 90-95% | 90-95% | 90-95% | 85-90% |

### 12.2 Critical Paths to Test (95-100% coverage)

1. **Authentication Flow**
   - Login/logout
   - Token refresh
   - Protected routes

2. **Project CRUD**
   - Create project
   - Update project
   - Delete project
   - Archive/unarchive

3. **Task Management**
   - Create task
   - Update task status
   - Delete task
   - Task history tracking

4. **Knowledge Base**
   - Add source
   - Edit source (newly implemented)
   - Delete source
   - Recrawl source
   - Search/filter

5. **Data Persistence**
   - Zustand store actions
   - API client methods
   - Local storage operations

### 12.3 Exclude from Coverage

```javascript
// vitest.config.ts
coverage: {
  exclude: [
    'node_modules/',
    'vitest.config.ts',
    '**/*.d.ts',
    '**/*.config.*',
    '**/mockData/**',
    '**/__tests__/**',
    '**/e2e/**',
    '**/*.stories.tsx',
    'src/app/**/layout.tsx', // Next.js generated
    'src/app/**/loading.tsx',
    'src/app/**/error.tsx',
  ],
}
```

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- ✅ Set up Vitest + React Testing Library
- ✅ Create test utilities and wrappers
- ✅ Implement Knowledge Base edit functionality
- ✅ Add Error Boundary component
- ✅ Replace alert() with toast system
- ✅ Write first 10 unit tests (utilities, hooks)

### Phase 2: Component Testing (Week 2)
- Write tests for all Knowledge Base components
- Write tests for Project components
- Write tests for Task components
- Target: 40+ component tests

### Phase 3: Integration & E2E (Week 3)
- Set up Playwright
- Write 15-20 integration tests
- Write 5-10 E2E tests for critical flows
- Set up MSW for API mocking

### Phase 4: Visual & Performance (Week 4)
- Set up Chromatic + Percy
- Create Storybook stories for all components
- Configure Lighthouse CI
- Set up bundle analyzer

### Phase 5: CI/CD & Polish (Week 5)
- Create GitHub Actions workflows
- Set up pre-commit hooks
- Configure coverage reporting
- Documentation and training

---

## 14. Success Metrics

### 14.1 Quality Gates

**All PRs must pass**:
- ✅ Unit test coverage ≥ 80%
- ✅ All E2E tests passing
- ✅ Lighthouse score ≥ 90
- ✅ No accessibility violations
- ✅ Bundle size within budget
- ✅ Type check passing
- ✅ Linter passing
- ✅ No console errors in E2E tests

### 14.2 Performance Metrics

- **FCP** (First Contentful Paint): < 1.8s
- **LCP** (Largest Contentful Paint): < 2.5s
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTI** (Time to Interactive): < 3.8s
- **TBT** (Total Blocking Time): < 300ms

### 14.3 Accessibility Scores

- **axe-core violations**: 0
- **WCAG 2.2 AA compliance**: 95%+
- **Keyboard navigation**: 100% functional
- **Screen reader support**: Full coverage

---

## 15. Testing Best Practices

### 15.1 General Principles

1. **Test behavior, not implementation** - Test what users see and do
2. **Arrange, Act, Assert (AAA)** - Structure tests consistently
3. **One assertion per test** - Keep tests focused
4. **Descriptive test names** - Should read like sentences
5. **Mock external dependencies** - Tests should be isolated
6. **Avoid brittle selectors** - Use role queries, not classnames
7. **Test accessibility** - Include ARIA labels, keyboard nav
8. **Keep tests fast** - Unit tests < 50ms, E2E < 30s

### 15.2 Common Pitfalls to Avoid

❌ **Don't test implementation details**
```typescript
// Bad - testing internal state
expect(component.state.count).toBe(1)

// Good - testing user-visible output
expect(screen.getByText('Count: 1')).toBeInTheDocument()
```

❌ **Don't use fragile selectors**
```typescript
// Bad - classnames can change
screen.getByClassName('button-primary')

// Good - semantic queries
screen.getByRole('button', { name: /submit/i })
```

❌ **Don't forget to clean up**
```typescript
// Bad - leaking mocks
vi.mock('@/lib/api')

// Good - reset after each test
afterEach(() => {
  vi.clearAllMocks()
})
```

❌ **Don't skip error cases**
```typescript
// Test both happy path AND error scenarios
it('should handle API errors gracefully', async () => {
  vi.mocked(api.fetch).mockRejectedValue(new Error('Network error'))
  // ... test error handling
})
```

### 15.3 Testing Checklist

Before shipping a feature, ensure:
- [ ] Unit tests for all logic/utilities
- [ ] Component tests for UI elements
- [ ] Integration test for full feature flow
- [ ] E2E test for critical user path
- [ ] Accessibility test (axe-core)
- [ ] Visual regression snapshot
- [ ] Performance benchmark
- [ ] Error boundary test
- [ ] Loading state test
- [ ] Empty state test

---

## 16. Resources

### 16.1 Documentation

- [Vitest Official Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Chromatic](https://www.chromatic.com/docs)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [axe-core](https://github.com/dequelabs/axe-core)
- [MSW](https://mswjs.io/)

### 16.2 Internal Archon KB References

- Next.js Testing Guide: `https://nextjs.org/docs/app/guides/testing.md`
- Vitest Setup: `https://nextjs.org/docs/app/guides/testing/vitest.md`
- FastAPI Testing: `https://fastapi.tiangolo.com/advanced/testing-dependencies/`

### 16.3 Example Repositories

- [with-vitest](https://github.com/vercel/next.js/tree/canary/examples/with-vitest)
- [with-playwright](https://github.com/vercel/next.js/tree/canary/examples/with-playwright)

---

## 17. Summary & Action Items

### 17.1 Immediate Actions (P0 - This Week)

1. **✅ Implement KB Edit** - Create EditSourceModal, wire up API
2. **✅ Add Error Boundary** - Wrap app, test crash scenarios
3. **✅ Replace alert()** - Install react-hot-toast, migrate all alerts
4. **Set up Vitest** - Install, configure, create first 5 tests
5. **Fix broken tests** - Ensure `npm run test` passes

### 17.2 Short-term Actions (P1 - Next 2 Weeks)

6. Write 40+ component tests (KB, Projects, Tasks)
7. Set up Playwright E2E testing
8. Create GitHub Actions CI/CD workflow
9. Implement MSW for API mocking
10. Add pre-commit hooks (Husky + lint-staged)

### 17.3 Medium-term Actions (P2 - Next Month)

11. Set up Chromatic visual regression
12. Configure Lighthouse CI
13. Achieve 80% code coverage
14. Create comprehensive Storybook
15. Document testing guidelines for team

---

**Document Maintained By**: Claude Code
**Last Updated**: 2025-12-23
**Version**: 1.0.0
**Next Review**: 2025-01-23

---

**This testing protocol provides a complete, actionable framework for implementing comprehensive testing across the Archon UI Next.js application, combining architectural analysis, Archon knowledge base insights, and 2025 industry best practices.**
