import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { mcpHandlers } from './mocks/handlers';

// Setup MSW server
export const server = setupServer(...mcpHandlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Close server after all tests
afterAll(() => server.close());

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock fetch globally
global.fetch = vi.fn();

// Mock react-icons
vi.mock('react-icons/hi', () => ({
  HiExclamationCircle: () => null,
  HiBug: () => null,
  // DataTable SortIndicator icons
  HiChevronUp: () => null,
  HiChevronDown: () => null,
  HiX: () => null,
  // DataTable DraggableColumn icons
  HiOutlineDotsVertical: () => null,
  // DataTable RowActions icons
  HiDotsHorizontal: () => null,
  HiDotsVertical: () => null,
  // ViewModeToggle icons
  HiViewList: () => null,
  HiViewGrid: () => null,
  HiViewColumns: () => null,
  // Search/Filter icons
  HiSearch: () => null,
  HiFilter: () => null,
  HiRefresh: () => null,
  // Navigation icons
  HiChevronLeft: () => null,
  HiChevronRight: () => null,
  HiChevronDoubleLeft: () => null,
  HiChevronDoubleRight: () => null,
  // General icons
  HiPlus: () => null,
  HiMinus: () => null,
  HiTrash: () => null,
  HiPencil: () => null,
  HiEye: () => null,
  HiDownload: () => null,
  HiUpload: () => null,
  HiCog: () => null,
  HiMenu: () => null,
  HiMenuAlt2: () => null,
  HiCheck: () => null,
  HiArchive: () => null,
  // Additional icons that might be needed
  HiOutlineX: () => null,
  HiOutlineSearch: () => null,
  HiOutlineFilter: () => null,
  HiOutlineRefresh: () => null,
  // MCP component icons
  HiChartBar: () => null,
  HiZoomIn: () => null,
  HiZoomOut: () => null,
  HiTrendingUp: () => null,
  HiTrendingDown: () => null,
  HiInformationCircle: () => null,
}));

beforeAll(() => {
  // Setup global test environment
});

afterAll(() => {
  // Cleanup global test environment
});
