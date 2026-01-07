# Architecture & Best Practices Guide

> **Generated:** 2025-01-07
> **Purpose:** How to build - Architecture patterns, UI/UX principles, and best practices
> **Companion to:** DOCUMENTATION_SOURCES.md (What to build with)

This document provides architecture patterns, design principles, and best practices for building applications using the SportERP platform tech stack. It focuses on **how** to build effectively rather than **what** tools to use.

---

## Table of Contents

- [Quick Reference - Decision Trees](#quick-reference---decision-trees)
- [Architecture Patterns](#architecture-patterns)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [State Management Patterns](#state-management-patterns)
- [UI/UX Design Principles](#uiux-design-principles)
- [Testing Strategies](#testing-strategies)
- [Performance Optimization](#performance-optimization)
- [Security Best Practices](#security-best-practices)
- [Accessibility (WCAG)](#accessibility-wcag)
- [Project Structure Templates](#project-structure-templates)

---

## Quick Reference - Decision Trees

### When to Use Server vs Client Components (Next.js)

```
Need to...
├── Fetch data? → Server Component
├── Access backend resources? → Server Component
├── Keep sensitive info secure? → Server Component
├── Reduce client JS bundle? → Server Component
├── Add interactivity (onClick, onChange)? → Client Component
├── Use useState, useEffect? → Client Component
├── Use browser APIs? → Client Component
└── Use React Context? → Client Component
```

### State Management Decision Tree

```
What kind of state?
├── Server data (API responses)? → TanStack Query
├── URL state (filters, pagination)? → URL params (searchParams)
├── Form state? → React Hook Form
├── Global UI state (theme, sidebar)? → Zustand
├── Complex with many actions? → Zustand with slices
└── Component-local state? → useState
```

### Data Fetching Pattern Selection

```
Data characteristics?
├── Changes frequently (real-time)? → TanStack Query + short staleTime
├── User-specific data? → Server Component + no-store
├── Shared across users? → Static generation + revalidate
├── Large dataset with pagination? → TanStack Query infinite
└── Form submission? → useMutation + optimistic updates
```

---

## Architecture Patterns

### Layered Architecture (Recommended for All Projects)

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│    (React Components, Pages, API Routes)                │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│    (Use Cases, Business Logic, Services)                │
├─────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│    (Entities, Value Objects, Domain Events)             │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                    │
│    (Database, External APIs, File System)               │
└─────────────────────────────────────────────────────────┘
```

### FastAPI Service Architecture

```python
# Recommended project structure
project/
├── src/
│   ├── api/                    # API layer
│   │   ├── routes/             # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── users.py
│   │   │   └── projects.py
│   │   ├── dependencies.py     # Dependency injection
│   │   └── middleware.py       # Custom middleware
│   │
│   ├── services/               # Business logic layer
│   │   ├── __init__.py
│   │   ├── user_service.py
│   │   └── project_service.py
│   │
│   ├── models/                 # Domain models (Pydantic)
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── project.py
│   │
│   ├── repositories/           # Data access layer
│   │   ├── __init__.py
│   │   ├── base.py
│   │   └── user_repository.py
│   │
│   └── core/                   # Core utilities
│       ├── config.py           # Settings (pydantic-settings)
│       ├── security.py         # Auth utilities
│       └── exceptions.py       # Custom exceptions
│
├── tests/
├── pyproject.toml
└── README.md
```

### Dependency Injection Pattern (FastAPI)

```python
# dependencies.py - Centralized dependency definitions
from fastapi import Depends
from functools import lru_cache
from .core.config import Settings
from .repositories.user_repository import UserRepository
from .services.user_service import UserService

@lru_cache
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()

async def get_db_session():
    """Database session with proper cleanup"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

def get_user_repository(
    session = Depends(get_db_session)
) -> UserRepository:
    """Repository with injected session"""
    return UserRepository(session)

def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
    settings: Settings = Depends(get_settings)
) -> UserService:
    """Service with injected dependencies"""
    return UserService(repo, settings)

# Usage in route
@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service)
):
    return await service.get_user(user_id)
```

---

## Frontend Architecture

### Next.js App Router Patterns

#### Server Component Data Fetching

```typescript
// app/projects/page.tsx - Server Component (default)
import { ProjectList } from '@/components/projects/ProjectList';

async function getProjects() {
  const res = await fetch('https://api.example.com/projects', {
    // Cache strategies:
    cache: 'force-cache',        // Static (like getStaticProps)
    // cache: 'no-store',        // Dynamic (like getServerSideProps)
    // next: { revalidate: 60 }, // ISR - revalidate every 60s
  });
  return res.json();
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <main>
      <h1>Projects</h1>
      {/* Pass server data to client components */}
      <ProjectList initialData={projects} />
    </main>
  );
}
```

#### Client Component with TanStack Query

```typescript
// components/projects/ProjectList.tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProjectListProps {
  initialData: Project[];
}

export function ProjectList({ initialData }: ProjectListProps) {
  const queryClient = useQueryClient();

  // Query with server-provided initial data
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    initialData,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
  });

  // Mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onMutate: async (projectId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(['projects']);

      // Optimistically update
      queryClient.setQueryData(['projects'], (old: Project[]) =>
        old.filter(p => p.id !== projectId)
      );

      return { previous };
    },
    onError: (err, projectId, context) => {
      // Rollback on error
      queryClient.setQueryData(['projects'], context?.previous);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (/* render */);
}
```

### Component Architecture Patterns

#### Compound Component Pattern

```typescript
// components/ui/Card/index.tsx
import { createContext, useContext, ReactNode } from 'react';

interface CardContextValue {
  variant: 'default' | 'elevated' | 'outlined';
}

const CardContext = createContext<CardContextValue | null>(null);

function useCardContext() {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('Card components must be used within Card');
  }
  return context;
}

// Root component
export function Card({
  children,
  variant = 'default'
}: {
  children: ReactNode;
  variant?: CardContextValue['variant'];
}) {
  return (
    <CardContext.Provider value={{ variant }}>
      <div className={cardVariants({ variant })}>
        {children}
      </div>
    </CardContext.Provider>
  );
}

// Sub-components
Card.Header = function CardHeader({ children }: { children: ReactNode }) {
  return <div className="p-4 border-b">{children}</div>;
};

Card.Body = function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>;
};

Card.Footer = function CardFooter({ children }: { children: ReactNode }) {
  return <div className="p-4 border-t bg-muted">{children}</div>;
};

// Usage
<Card variant="elevated">
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

#### Render Props Pattern (for flexibility)

```typescript
// components/DataTable/DataTable.tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  renderRow?: (item: T, index: number) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  renderRow,
  renderEmpty = () => <EmptyState />,
  renderLoading = () => <Skeleton />,
}: DataTableProps<T>) {
  if (isLoading) return renderLoading();
  if (data.length === 0) return renderEmpty();

  return (
    <table>
      <thead>{/* column headers */}</thead>
      <tbody>
        {data.map((item, index) =>
          renderRow ? renderRow(item, index) : (
            <DefaultRow key={index} item={item} columns={columns} />
          )
        )}
      </tbody>
    </table>
  );
}
```

---

## Backend Architecture

### Pydantic Model Design

```python
# models/base.py - Base model with common configuration
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    model_config = ConfigDict(
        from_attributes=True,  # Enable ORM mode
        populate_by_name=True,  # Allow population by field name or alias
        str_strip_whitespace=True,  # Strip whitespace from strings
    )

class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""
    created_at: datetime
    updated_at: Optional[datetime] = None

# models/user.py - Domain models
from pydantic import EmailStr, Field
from .base import BaseSchema, TimestampMixin

class UserBase(BaseSchema):
    """Shared user properties"""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)

class UserCreate(UserBase):
    """Properties for user creation"""
    password: str = Field(..., min_length=8)

class UserUpdate(BaseSchema):
    """Properties for user update (all optional)"""
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class UserInDB(UserBase, TimestampMixin):
    """User as stored in database"""
    id: int
    hashed_password: str
    is_active: bool = True

class UserResponse(UserBase, TimestampMixin):
    """User response (excludes sensitive data)"""
    id: int
    is_active: bool
```

### Settings Management

```python
# core/config.py - Type-safe settings with pydantic-settings
from pydantic import Field, PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    """Application settings with environment variable support"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",  # Allows REDIS__HOST=localhost
        case_sensitive=False,
    )

    # Application
    app_name: str = "SportERP API"
    debug: bool = False
    environment: str = Field(default="development")

    # Database
    database_url: PostgresDsn
    database_pool_size: int = Field(default=5, ge=1, le=20)

    # Security
    secret_key: str = Field(..., min_length=32)
    access_token_expire_minutes: int = 30

    # External Services
    supabase_url: str
    supabase_key: str

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

@lru_cache
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()
```

### API Error Handling

```python
# core/exceptions.py
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Optional

class ErrorResponse(BaseModel):
    """Standardized error response"""
    error: str
    message: str
    details: Optional[Any] = None

class AppException(Exception):
    """Base application exception"""
    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        details: Any = None
    ):
        self.status_code = status_code
        self.error = error
        self.message = message
        self.details = details

class NotFoundError(AppException):
    def __init__(self, resource: str, id: Any):
        super().__init__(
            status_code=404,
            error="not_found",
            message=f"{resource} with id {id} not found"
        )

class ValidationError(AppException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(
            status_code=422,
            error="validation_error",
            message=message,
            details=details
        )

# Exception handler
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.error,
            message=exc.message,
            details=exc.details
        ).model_dump()
    )

# Register in main.py
app.add_exception_handler(AppException, app_exception_handler)
```

---

## State Management Patterns

### Zustand Store Design

```typescript
// store/useProjectStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived';
}

interface ProjectState {
  // State
  projects: Project[];
  selectedProjectId: string | null;
  filters: {
    status: 'all' | 'active' | 'archived';
    search: string;
  };

  // Computed (selectors defined separately)

  // Actions
  setProjects: (projects: Project[]) => void;
  selectProject: (id: string | null) => void;
  updateFilters: (filters: Partial<ProjectState['filters']>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      immer((set) => ({
        // Initial state
        projects: [],
        selectedProjectId: null,
        filters: {
          status: 'all',
          search: '',
        },

        // Actions with immer for immutable updates
        setProjects: (projects) =>
          set((state) => {
            state.projects = projects;
          }),

        selectProject: (id) =>
          set((state) => {
            state.selectedProjectId = id;
          }),

        updateFilters: (filters) =>
          set((state) => {
            Object.assign(state.filters, filters);
          }),

        updateProject: (id, updates) =>
          set((state) => {
            const project = state.projects.find(p => p.id === id);
            if (project) {
              Object.assign(project, updates);
            }
          }),
      })),
      {
        name: 'project-store', // localStorage key
        partialize: (state) => ({
          // Only persist these fields
          selectedProjectId: state.selectedProjectId,
          filters: state.filters,
        }),
      }
    ),
    { name: 'ProjectStore' } // DevTools name
  )
);

// Selectors (computed values) - defined outside store
export const useFilteredProjects = () =>
  useProjectStore((state) => {
    let filtered = state.projects;

    if (state.filters.status !== 'all') {
      filtered = filtered.filter(p => p.status === state.filters.status);
    }

    if (state.filters.search) {
      const search = state.filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search)
      );
    }

    return filtered;
  });

export const useSelectedProject = () =>
  useProjectStore((state) =>
    state.projects.find(p => p.id === state.selectedProjectId)
  );
```

### TanStack Query Patterns

```typescript
// hooks/useProjects.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery
} from '@tanstack/react-query';
import { projectApi } from '@/lib/api';

// Query keys factory
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// Queries
export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectApi.getProjects(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectApi.getProject(id),
    enabled: !!id, // Only fetch if id exists
  });
}

// Infinite query for pagination
export function useProjectsInfinite(filters: ProjectFilters) {
  return useInfiniteQuery({
    queryKey: projectKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      projectApi.getProjects({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });
}

// Mutations
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: projectApi.createProject,
    onSuccess: (newProject) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

      // Optionally add to cache directly
      queryClient.setQueryData(
        projectKeys.detail(newProject.id),
        newProject
      );
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectData }) =>
      projectApi.updateProject(id, data),
    onMutate: async ({ id, data }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });

      const previous = queryClient.getQueryData(projectKeys.detail(id));

      queryClient.setQueryData(projectKeys.detail(id), (old: Project) => ({
        ...old,
        ...data,
      }));

      return { previous };
    },
    onError: (err, { id }, context) => {
      // Rollback
      queryClient.setQueryData(projectKeys.detail(id), context?.previous);
    },
    onSettled: (data, error, { id }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}
```

---

## UI/UX Design Principles

### Design System Structure

```
design-system/
├── tokens/                 # Design tokens
│   ├── colors.ts          # Color palette
│   ├── typography.ts      # Font sizes, weights, line heights
│   ├── spacing.ts         # Spacing scale
│   ├── shadows.ts         # Shadow definitions
│   └── index.ts           # Exported tokens
│
├── primitives/            # Low-level building blocks
│   ├── Box.tsx           # Layout primitive
│   ├── Text.tsx          # Typography primitive
│   ├── Flex.tsx          # Flexbox container
│   └── Grid.tsx          # Grid container
│
├── components/            # UI components (use Radix primitives)
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── index.ts
│   ├── Input/
│   ├── Select/
│   ├── Dialog/
│   └── ...
│
└── patterns/              # Composite patterns
    ├── FormField.tsx     # Label + Input + Error
    ├── DataTable.tsx     # Table with sorting/filtering
    └── PageLayout.tsx    # Standard page structure
```

### Tailwind CSS Design System Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    // Override defaults for consistency
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },

    extend: {
      // Brand colors
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        // Semantic colors
        success: {
          light: '#dcfce7',
          DEFAULT: '#22c55e',
          dark: '#15803d',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
        error: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#b91c1c',
        },
      },

      // Typography scale
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading-1': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-2': ['1.875rem', { lineHeight: '1.25' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'caption': ['0.75rem', { lineHeight: '1.4' }],
      },

      // Spacing additions
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      // Animation
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
```

### Component Variants with CVA

```typescript
// components/ui/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500',
        ghost: 'hover:bg-gray-100 focus-visible:ring-gray-500',
        destructive: 'bg-error text-white hover:bg-error-dark focus-visible:ring-error',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  isLoading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
```

---

## Testing Strategies

### Testing Pyramid

```
           ╱╲
          ╱  ╲           E2E Tests (Playwright)
         ╱────╲          - Critical user journeys
        ╱      ╲         - 10-20% of tests
       ╱────────╲
      ╱          ╲       Integration Tests
     ╱────────────╲      - API routes, hooks
    ╱              ╲     - 20-30% of tests
   ╱────────────────╲
  ╱                  ╲   Unit Tests (Vitest)
 ╱────────────────────╲  - Components, utilities
╱                      ╲ - 50-70% of tests
```

### Unit Testing Patterns (Vitest)

```typescript
// components/Button/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  // Rendering tests
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('applies variant classes', () => {
      render(<Button variant="destructive">Delete</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-error');
    });
  });

  // Interaction tests
  describe('interactions', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click</Button>);
      await user.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick} disabled>Click</Button>);
      await user.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // Loading state tests
  describe('loading state', () => {
    it('shows spinner when loading', () => {
      render(<Button isLoading>Submit</Button>);
      expect(screen.getByRole('button')).toContainElement(
        screen.getByTestId('spinner')
      );
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Submit</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
```

### E2E Testing Patterns (Playwright)

```typescript
// e2e/page-objects/ProjectPage.ts
import { Page, Locator, expect } from '@playwright/test';

export class ProjectPage {
  readonly page: Page;
  readonly projectList: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly projectCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectList = page.getByTestId('project-list');
    this.createButton = page.getByRole('button', { name: /create project/i });
    this.searchInput = page.getByPlaceholder(/search projects/i);
    this.projectCards = page.getByTestId('project-card');
  }

  async goto() {
    await this.page.goto('/projects');
    await expect(this.projectList).toBeVisible();
  }

  async searchProjects(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce and results
    await this.page.waitForResponse(
      resp => resp.url().includes('/api/projects') && resp.status() === 200
    );
  }

  async createProject(name: string, description: string) {
    await this.createButton.click();

    // Fill form in modal
    await this.page.getByLabel(/project name/i).fill(name);
    await this.page.getByLabel(/description/i).fill(description);
    await this.page.getByRole('button', { name: /save/i }).click();

    // Wait for success
    await expect(this.page.getByText(/project created/i)).toBeVisible();
  }

  async getProjectCount(): Promise<number> {
    return this.projectCards.count();
  }
}

// e2e/projects.spec.ts
import { test, expect } from '@playwright/test';
import { ProjectPage } from './page-objects/ProjectPage';

test.describe('Projects', () => {
  let projectPage: ProjectPage;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    await projectPage.goto();
  });

  test('should display project list', async () => {
    const count = await projectPage.getProjectCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter projects by search', async () => {
    const initialCount = await projectPage.getProjectCount();

    await projectPage.searchProjects('specific-term');

    const filteredCount = await projectPage.getProjectCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should create a new project', async ({ page }) => {
    await projectPage.createProject(
      'Test Project',
      'A test project description'
    );

    // Verify project appears in list
    await expect(page.getByText('Test Project')).toBeVisible();
  });
});
```

### API Testing (pytest)

```python
# tests/api/test_projects.py
import pytest
from httpx import AsyncClient
from fastapi import status

@pytest.fixture
async def client(app):
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
async def auth_headers(client, test_user):
    """Get auth headers for authenticated requests"""
    response = await client.post("/auth/login", json={
        "email": test_user.email,
        "password": "testpassword"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

class TestProjectsAPI:
    """Tests for /api/projects endpoints"""

    async def test_list_projects(self, client, auth_headers, sample_projects):
        response = await client.get("/api/projects", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["items"]) == len(sample_projects)
        assert "total" in data

    async def test_create_project(self, client, auth_headers):
        project_data = {
            "name": "New Project",
            "description": "Test description"
        }

        response = await client.post(
            "/api/projects",
            json=project_data,
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == project_data["name"]
        assert "id" in data

    async def test_create_project_validation_error(self, client, auth_headers):
        response = await client.post(
            "/api/projects",
            json={"name": ""},  # Invalid: empty name
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_get_project_not_found(self, client, auth_headers):
        response = await client.get(
            "/api/projects/nonexistent-id",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
```

---

## Performance Optimization

### React Performance Patterns

```typescript
// 1. Memoization for expensive computations
import { useMemo, useCallback, memo } from 'react';

function ProjectList({ projects, onSelect }: Props) {
  // Memoize expensive filtering/sorting
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [projects]);

  // Memoize callbacks passed to children
  const handleSelect = useCallback((id: string) => {
    onSelect(id);
  }, [onSelect]);

  return (
    <ul>
      {sortedProjects.map(project => (
        <ProjectItem
          key={project.id}
          project={project}
          onSelect={handleSelect}
        />
      ))}
    </ul>
  );
}

// 2. Memo for pure components
const ProjectItem = memo(function ProjectItem({
  project,
  onSelect
}: ItemProps) {
  return (
    <li onClick={() => onSelect(project.id)}>
      {project.name}
    </li>
  );
});

// 3. Virtual lists for large datasets
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated row height
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### FastAPI Performance

```python
# 1. Async database operations
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# 2. Caching with Redis
from functools import wraps
import redis.asyncio as redis

redis_client = redis.from_url("redis://localhost")

def cached(ttl: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"

            # Try cache first
            cached_value = await redis_client.get(key)
            if cached_value:
                return json.loads(cached_value)

            # Execute and cache
            result = await func(*args, **kwargs)
            await redis_client.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

@cached(ttl=60)
async def get_project_stats(project_id: str) -> dict:
    # Expensive computation
    ...

# 3. Background tasks
from fastapi import BackgroundTasks

@router.post("/projects")
async def create_project(
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
    service: ProjectService = Depends(get_project_service)
):
    project = await service.create(data)

    # Non-blocking follow-up tasks
    background_tasks.add_task(send_notification, project.owner_id)
    background_tasks.add_task(update_analytics, "project_created")

    return project
```

---

## Security Best Practices

### Authentication Pattern

```python
# security/auth.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await user_service.get_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user
```

### Input Validation

```typescript
// lib/validations/project.ts
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Name can only contain letters, numbers, spaces, and hyphens'),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  isPublic: z.boolean().default(false),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Usage with React Hook Form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function CreateProjectForm() {
  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      isPublic: false,
    },
  });

  const onSubmit = async (data: CreateProjectInput) => {
    // Data is validated and typed
    await createProject(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Accessibility (WCAG)

### Key Accessibility Principles

```typescript
// 1. Semantic HTML
// BAD
<div onClick={handleClick}>Click me</div>

// GOOD
<button onClick={handleClick}>Click me</button>

// 2. ARIA labels when needed
<button aria-label="Close dialog" onClick={onClose}>
  <XIcon aria-hidden="true" />
</button>

// 3. Focus management
function Dialog({ isOpen, onClose, children }: DialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus first focusable element
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title">Dialog Title</h2>
      {children}
      <button ref={closeButtonRef} onClick={onClose}>
        Close
      </button>
    </div>
  );
}

// 4. Keyboard navigation
function Menu({ items }: MenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        items[activeIndex].onSelect();
        break;
    }
  };

  return (
    <ul role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          aria-selected={index === activeIndex}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// 5. Color contrast and visual indicators
// Tailwind classes for accessible focus states
const focusClasses = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

// Never rely on color alone
<span className="text-error">
  <AlertIcon aria-hidden="true" />
  Error: {message}
</span>
```

### Accessibility Checklist

```markdown
## Per-Component Checklist

- [ ] Uses semantic HTML elements
- [ ] Has visible focus indicators
- [ ] Supports keyboard navigation
- [ ] Has appropriate ARIA attributes
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Interactive elements are at least 44x44px touch targets
- [ ] Form inputs have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Loading states are communicated
- [ ] Animations respect prefers-reduced-motion
```

---

## Project Structure Templates

### Next.js App Router Structure

```
app/
├── (auth)/                    # Route group (no URL impact)
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (dashboard)/               # Protected routes group
│   ├── layout.tsx            # Shared dashboard layout
│   ├── projects/
│   │   ├── page.tsx          # /projects
│   │   ├── [id]/
│   │   │   ├── page.tsx      # /projects/[id]
│   │   │   └── edit/
│   │   │       └── page.tsx  # /projects/[id]/edit
│   │   └── new/
│   │       └── page.tsx      # /projects/new
│   └── settings/
│       └── page.tsx
├── api/                       # API routes
│   ├── projects/
│   │   ├── route.ts          # GET, POST /api/projects
│   │   └── [id]/
│   │       └── route.ts      # GET, PUT, DELETE /api/projects/[id]
│   └── auth/
│       └── [...nextauth]/
│           └── route.ts
├── layout.tsx                 # Root layout
├── page.tsx                   # Home page
├── loading.tsx                # Root loading UI
├── error.tsx                  # Root error UI
└── not-found.tsx             # 404 page

src/
├── components/
│   ├── ui/                   # Design system components
│   ├── features/             # Feature-specific components
│   │   ├── projects/
│   │   └── tasks/
│   └── layouts/              # Layout components
├── hooks/                    # Custom hooks
├── lib/                      # Utilities and configurations
│   ├── api.ts               # API client
│   ├── utils.ts             # Helper functions
│   └── validations/         # Zod schemas
├── store/                    # Zustand stores
├── types/                    # TypeScript types
└── styles/                   # Global styles
```

---

## Context7 Reference IDs

Quick reference for querying architecture documentation:

| Topic | Context7 ID | Snippets |
|-------|-------------|----------|
| React Patterns | `/websites/react_dev` | 4,359 |
| Next.js App Router | `/websites/nextjs_app` | 2,664 |
| FastAPI | `/websites/fastapi_tiangolo` | 12,067 |
| Tailwind CSS | `/websites/v3_tailwindcss` | 2,691 |
| Radix UI Themes | `/websites/radix-ui_themes` | 447 |
| shadcn/ui | `/llmstxt/ui_shadcn_llms_txt` | 775 |
| Zustand | `/pmndrs/zustand` | 771 |
| TanStack Query | `/websites/tanstack_query` | 2,156 |
| Playwright | `/websites/playwright_dev` | 6,155 |
| Vitest | `/websites/main_vitest_dev` | 1,295 |
| Pydantic | `/websites/pydantic_dev` | 2,805 |
| WCAG 2.2 | `/websites/w3_tr_wcag22` | 7 |
| Python Packaging | `/pypa/packaging.python.org` | 506 |

---

## Additional Resources to Crawl

| Resource | URL | Type | Focus |
|----------|-----|------|-------|
| Patterns.dev | https://www.patterns.dev/ | Sitemap | React/JS patterns |
| Testing Library | https://testing-library.com/docs/ | Direct | Testing patterns |
| Web.dev | https://web.dev/patterns/ | Direct | Web patterns |
| A11y Project | https://www.a11yproject.com/ | Direct | Accessibility |
| Refactoring.Guru | https://refactoring.guru/design-patterns | Direct | Design patterns |

---

**Last Updated:** 2025-01-07
**Maintainer:** SportERP Team
**Companion Document:** [DOCUMENTATION_SOURCES.md](./DOCUMENTATION_SOURCES.md)
