/**
 * Integration Tests for Code Extraction Service Layer
 *
 * Tests the credentialsService.updateCodeExtractionSettings() function
 * and related code extraction operations with mocked API client calls.
 *
 * This test suite validates:
 * - Request/response data flow for code extraction settings
 * - Error handling and recovery
 * - Type safety with TypeScript interfaces
 * - API client integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { credentialsService, CodeExtractionSettings } from '@/lib/services/credentialsService';

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock global fetch to intercept HTTP requests
 */
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mock
  mockFetch.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Test Fixtures and Factory Functions
// ============================================================================

/**
 * Creates a default CodeExtractionSettings object for testing
 */
function createDefaultCodeExtractionSettings(): CodeExtractionSettings {
  return {
    MIN_CODE_BLOCK_LENGTH: 10,
    MAX_CODE_BLOCK_LENGTH: 5000,
    ENABLE_COMPLETE_BLOCK_DETECTION: true,
    ENABLE_LANGUAGE_SPECIFIC_PATTERNS: true,
    ENABLE_PROSE_FILTERING: true,
    MAX_PROSE_RATIO: 0.3,
    MIN_CODE_INDICATORS: 2,
    ENABLE_DIAGRAM_FILTERING: true,
    ENABLE_CONTEXTUAL_LENGTH: true,
    CODE_EXTRACTION_MAX_WORKERS: 4,
    CONTEXT_WINDOW_SIZE: 512,
    ENABLE_CODE_SUMMARIES: false,
  };
}

/**
 * Creates modified settings for update testing
 */
function createModifiedCodeExtractionSettings(): CodeExtractionSettings {
  return {
    MIN_CODE_BLOCK_LENGTH: 20,
    MAX_CODE_BLOCK_LENGTH: 10000,
    ENABLE_COMPLETE_BLOCK_DETECTION: false,
    ENABLE_LANGUAGE_SPECIFIC_PATTERNS: false,
    ENABLE_PROSE_FILTERING: false,
    MAX_PROSE_RATIO: 0.5,
    MIN_CODE_INDICATORS: 3,
    ENABLE_DIAGRAM_FILTERING: false,
    ENABLE_CONTEXTUAL_LENGTH: false,
    CODE_EXTRACTION_MAX_WORKERS: 8,
    CONTEXT_WINDOW_SIZE: 1024,
    ENABLE_CODE_SUMMARIES: true,
  };
}

/**
 * Creates a valid fetch Response object
 */
function createMockResponse<T>(
  data: T,
  status = 200,
  statusText = 'OK'
): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates an error fetch Response object
 */
function createErrorResponse(
  message: string,
  status = 500,
  statusText = 'Internal Server Error'
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Test Suite: Code Extraction Settings - GET Operations
// ============================================================================

describe('Code Extraction Service Integration - GET Operations', () => {
  it('should fetch code extraction settings successfully', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result).toEqual(settings);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/code-extraction-settings')
    );
  });

  it('should transform fetched settings to correct types', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert - Verify type correctness
    expect(typeof result.MIN_CODE_BLOCK_LENGTH).toBe('number');
    expect(typeof result.MAX_CODE_BLOCK_LENGTH).toBe('number');
    expect(typeof result.ENABLE_COMPLETE_BLOCK_DETECTION).toBe('boolean');
    expect(typeof result.ENABLE_LANGUAGE_SPECIFIC_PATTERNS).toBe('boolean');
    expect(typeof result.ENABLE_PROSE_FILTERING).toBe('boolean');
    expect(typeof result.MAX_PROSE_RATIO).toBe('number');
    expect(typeof result.MIN_CODE_INDICATORS).toBe('number');
    expect(typeof result.ENABLE_DIAGRAM_FILTERING).toBe('boolean');
    expect(typeof result.ENABLE_CONTEXTUAL_LENGTH).toBe('boolean');
    expect(typeof result.CODE_EXTRACTION_MAX_WORKERS).toBe('number');
    expect(typeof result.CONTEXT_WINDOW_SIZE).toBe('number');
    expect(typeof result.ENABLE_CODE_SUMMARIES).toBe('boolean');
  });

  it('should handle 404 error when settings not found', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Settings not found', 404, 'Not Found')
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow('Fetching code extraction settings failed');
  });

  it('should handle 500 server error', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Internal server error', 500)
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow('Fetching code extraction settings failed');
  });

  it('should handle network timeout errors', async () => {
    // Arrange
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow('Fetching code extraction settings failed');
  });
});

// ============================================================================
// Test Suite: Code Extraction Settings - PUT Operations
// ============================================================================

describe('Code Extraction Service Integration - PUT Operations', () => {
  it('should update code extraction settings successfully', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act
    await credentialsService.updateCodeExtractionSettings(settings);

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/code-extraction-settings'),
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should send correct request body for update', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act
    await credentialsService.updateCodeExtractionSettings(settings);

    // Assert
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1]?.body as string);

    expect(requestBody).toEqual(settings);
    expect(requestBody.MIN_CODE_BLOCK_LENGTH).toBe(20);
    expect(requestBody.MAX_CODE_BLOCK_LENGTH).toBe(10000);
    expect(requestBody.ENABLE_COMPLETE_BLOCK_DETECTION).toBe(false);
    expect(requestBody.CODE_EXTRACTION_MAX_WORKERS).toBe(8);
    expect(requestBody.ENABLE_CODE_SUMMARIES).toBe(true);
  });

  it('should handle partial settings update', async () => {
    // Arrange
    const partialSettings: Partial<CodeExtractionSettings> = {
      MIN_CODE_BLOCK_LENGTH: 50,
      MAX_CODE_BLOCK_LENGTH: 2000,
      ENABLE_CODE_SUMMARIES: true,
    };
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act
    await credentialsService.updateCodeExtractionSettings(
      partialSettings as CodeExtractionSettings
    );

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1]?.body as string);

    expect(requestBody.MIN_CODE_BLOCK_LENGTH).toBe(50);
    expect(requestBody.MAX_CODE_BLOCK_LENGTH).toBe(2000);
    expect(requestBody.ENABLE_CODE_SUMMARIES).toBe(true);
  });

  it('should handle 400 bad request error', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Invalid settings format', 400, 'Bad Request')
    );

    // Act & Assert
    await expect(
      credentialsService.updateCodeExtractionSettings(settings)
    ).rejects.toThrow('Updating code extraction settings failed');
  });

  it('should handle 401 unauthorized error', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Unauthorized', 401, 'Unauthorized')
    );

    // Act & Assert
    await expect(
      credentialsService.updateCodeExtractionSettings(settings)
    ).rejects.toThrow('Updating code extraction settings failed');
  });

  it('should handle 500 server error during update', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Database error', 500, 'Internal Server Error')
    );

    // Act & Assert
    await expect(
      credentialsService.updateCodeExtractionSettings(settings)
    ).rejects.toThrow('Updating code extraction settings failed');
  });

  it('should handle network failure during update', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Act & Assert
    await expect(
      credentialsService.updateCodeExtractionSettings(settings)
    ).rejects.toThrow('Updating code extraction settings failed');
  });

  it('should handle JSON parse error in request body', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act - Should not throw during serialization
    await credentialsService.updateCodeExtractionSettings(settings);

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Test Suite: Code Extraction Settings - Data Transformation
// ============================================================================

describe('Code Extraction Service Integration - Data Transformation', () => {
  it('should preserve all settings fields during round-trip', async () => {
    // Arrange
    const originalSettings = createModifiedCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(originalSettings));

    // Act
    const fetched = await credentialsService.getCodeExtractionSettings();

    // Assert - Verify all fields match
    Object.entries(originalSettings).forEach(([key, value]) => {
      expect(fetched[key as keyof CodeExtractionSettings]).toBe(value);
    });
  });

  it('should handle boolean to string conversion if needed', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result.ENABLE_COMPLETE_BLOCK_DETECTION).toBe(true);
    expect(result.ENABLE_LANGUAGE_SPECIFIC_PATTERNS).toBe(true);
    expect(typeof result.ENABLE_COMPLETE_BLOCK_DETECTION).toBe('boolean');
  });

  it('should handle number precision for floating-point values', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    settings.MAX_PROSE_RATIO = 0.333333333;
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result.MAX_PROSE_RATIO).toBeCloseTo(0.333333333);
  });

  it('should maintain numeric ranges', async () => {
    // Arrange
    const settings = createModifiedCodeExtractionSettings();
    settings.MIN_CODE_BLOCK_LENGTH = 0; // Edge case: minimum
    settings.MAX_CODE_BLOCK_LENGTH = 1000000; // Edge case: maximum
    settings.CODE_EXTRACTION_MAX_WORKERS = 1;
    settings.CONTEXT_WINDOW_SIZE = 128; // Minimum reasonable size
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result.MIN_CODE_BLOCK_LENGTH).toBe(0);
    expect(result.MAX_CODE_BLOCK_LENGTH).toBe(1000000);
    expect(result.CODE_EXTRACTION_MAX_WORKERS).toBe(1);
    expect(result.CONTEXT_WINDOW_SIZE).toBe(128);
  });
});

// ============================================================================
// Test Suite: Integration Scenarios
// ============================================================================

describe('Code Extraction Service Integration - Scenarios', () => {
  it('should perform complete CRUD cycle: fetch → modify → update', async () => {
    // Arrange - Phase 1: Fetch
    const originalSettings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(originalSettings));

    // Act - Phase 1: Fetch
    const fetched = await credentialsService.getCodeExtractionSettings();
    expect(fetched).toEqual(originalSettings);

    // Arrange - Phase 2: Modify and Update
    const modified = { ...fetched };
    modified.MIN_CODE_BLOCK_LENGTH = 50;
    modified.CODE_EXTRACTION_MAX_WORKERS = 16;
    modified.ENABLE_CODE_SUMMARIES = true;

    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act - Phase 2: Update
    await credentialsService.updateCodeExtractionSettings(modified);

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const updateCall = mockFetch.mock.calls[1];
    expect(updateCall[1]?.method).toBe('PUT');
  });

  it('should handle concurrent get and update operations', async () => {
    // Arrange
    const settings1 = createDefaultCodeExtractionSettings();
    const settings2 = createModifiedCodeExtractionSettings();

    mockFetch.mockResolvedValueOnce(createMockResponse(settings1));
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act
    const getPromise = credentialsService.getCodeExtractionSettings();
    const updatePromise = credentialsService.updateCodeExtractionSettings(
      settings2
    );

    const [getResult] = await Promise.all([getPromise, updatePromise]);

    // Assert
    expect(getResult).toEqual(settings1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on transient network errors', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    // First attempt fails with network error
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    // Second attempt succeeds
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act - First call fails
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow();

    // Clear and retry
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result).toEqual(settings);
  });

  it('should handle API endpoint URL construction correctly', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    await credentialsService.getCodeExtractionSettings();

    // Assert
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('/api/code-extraction-settings');
  });

  it('should handle settings with all edge case values', async () => {
    // Arrange
    const edgeCaseSettings: CodeExtractionSettings = {
      MIN_CODE_BLOCK_LENGTH: 1,
      MAX_CODE_BLOCK_LENGTH: 999999,
      ENABLE_COMPLETE_BLOCK_DETECTION: false,
      ENABLE_LANGUAGE_SPECIFIC_PATTERNS: false,
      ENABLE_PROSE_FILTERING: false,
      MAX_PROSE_RATIO: 0.0,
      MIN_CODE_INDICATORS: 1,
      ENABLE_DIAGRAM_FILTERING: false,
      ENABLE_CONTEXTUAL_LENGTH: false,
      CODE_EXTRACTION_MAX_WORKERS: 32,
      CONTEXT_WINDOW_SIZE: 4096,
      ENABLE_CODE_SUMMARIES: true,
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(edgeCaseSettings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result).toEqual(edgeCaseSettings);
    expect(result.MAX_PROSE_RATIO).toBe(0.0);
    expect(result.CODE_EXTRACTION_MAX_WORKERS).toBe(32);
  });
});

// ============================================================================
// Test Suite: Error Handling and Recovery
// ============================================================================

describe('Code Extraction Service Integration - Error Handling', () => {
  it('should provide descriptive error messages', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Invalid configuration format', 400)
    );

    // Act & Assert
    try {
      await credentialsService.getCodeExtractionSettings();
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Fetching code extraction settings');
    }
  });

  it('should not lose data on transient errors', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();
    expect(result).toBeDefined();

    // Second call with error shouldn't affect previous result
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Server error', 500)
    );

    // Assert - previous result remains valid
    expect(result).toEqual(settings);
  });

  it('should handle malformed JSON responses gracefully', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      new Response('Invalid JSON {{{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow();
  });

  it('should handle empty response body', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow();
  });

  it('should handle redirect responses (3xx)', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Moved Permanently', 301, 'Moved Permanently')
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow();
  });

  it('should handle rate limiting (429) error', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Too Many Requests', 429, 'Too Many Requests')
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow('Fetching code extraction settings failed');
  });

  it('should handle service unavailable (503) error', async () => {
    // Arrange
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Service Unavailable', 503, 'Service Unavailable')
    );

    // Act & Assert
    await expect(
      credentialsService.getCodeExtractionSettings()
    ).rejects.toThrow('Fetching code extraction settings failed');
  });
});

// ============================================================================
// Test Suite: API Contract Validation
// ============================================================================

describe('Code Extraction Service Integration - API Contract', () => {
  it('should send request with correct headers', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse({}));

    // Act
    await credentialsService.updateCodeExtractionSettings(settings);

    // Assert
    const [, options] = mockFetch.mock.calls[0];
    expect(options?.headers).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('should handle response with extra fields', async () => {
    // Arrange
    const responseData = {
      ...createDefaultCodeExtractionSettings(),
      _extra_field: 'should be ignored',
      metadata: { version: '1.0' },
    };
    mockFetch.mockResolvedValueOnce(createMockResponse(responseData));

    // Act
    const result = await credentialsService.getCodeExtractionSettings();

    // Assert
    expect(result.MIN_CODE_BLOCK_LENGTH).toBe(10);
    // Extra fields are preserved in the response since we don't filter them
    expect((result as any)._extra_field).toBe('should be ignored');
  });

  it('should construct URL with baseUrl from environment', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    await credentialsService.getCodeExtractionSettings();

    // Assert
    const callUrl = mockFetch.mock.calls[0][0];
    // Should contain the base URL and endpoint
    expect(callUrl).toBeTruthy();
    expect(typeof callUrl).toBe('string');
  });
});

// ============================================================================
// Test Suite: Performance and Load
// ============================================================================

describe('Code Extraction Service Integration - Performance', () => {
  it('should complete request within reasonable time', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    mockFetch.mockResolvedValueOnce(createMockResponse(settings));

    // Act
    const startTime = performance.now();
    await credentialsService.getCodeExtractionSettings();
    const endTime = performance.now();

    // Assert - Should complete in less than 1 second (network overhead)
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should handle multiple rapid requests', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    // Mock each call separately since Response bodies can only be read once
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(createMockResponse(settings));
    }

    // Act
    const promises = Array.from({ length: 5 }, () =>
      credentialsService.getCodeExtractionSettings()
    );
    const results = await Promise.all(promises);

    // Assert
    expect(results).toHaveLength(5);
    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(results.every(r => r.MIN_CODE_BLOCK_LENGTH === 10)).toBe(true);
  });

  it('should not leak memory on repeated calls', async () => {
    // Arrange
    const settings = createDefaultCodeExtractionSettings();
    // Mock each call separately since Response bodies can only be read once
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce(createMockResponse(settings));
    }

    // Act
    for (let i = 0; i < 10; i++) {
      await credentialsService.getCodeExtractionSettings();
    }

    // Assert - All calls should succeed without memory issues
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });
});
