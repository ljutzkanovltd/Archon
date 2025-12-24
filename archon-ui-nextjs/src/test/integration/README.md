# Integration Tests - Quick Reference

This directory contains integration tests for the Archon UI service layer.

## Quick Start

### Run All Integration Tests
```bash
npm test -- src/test/integration
```

### Run Specific Test File
```bash
npm test -- src/test/integration/code-extraction.test.ts
```

### Run with Coverage Report
```bash
npm test -- --coverage src/test/integration
```

### Run in Watch Mode
```bash
npm test -- --watch src/test/integration
```

## Available Test Suites

### 1. Code Extraction Service Tests
**File**: `code-extraction.test.ts`
**Status**: ✓ 35 tests passing

Tests the code extraction settings service layer, including:
- GET operations for fetching settings
- PUT operations for updating settings
- Error handling for various HTTP status codes
- Data transformation and type safety
- Performance and concurrent operations
- API contract validation

**Key Functions Tested**:
- `credentialsService.getCodeExtractionSettings()`
- `credentialsService.updateCodeExtractionSettings(settings)`

**Documentation**: See `CODE_EXTRACTION_TESTS.md` for detailed information

## Test Coverage

| Test Suite | File | Tests | Status |
|-----------|------|-------|--------|
| Code Extraction | code-extraction.test.ts | 35 | ✓ Passing |

## Common Test Commands

### Run with Specific Pattern
```bash
npm test -- --grep "should fetch code extraction"
```

### Run Only Failed Tests
```bash
npm test -- --changed
```

### Show Verbose Output
```bash
npm test -- --reporter=verbose src/test/integration
```

### Run with UI Dashboard
```bash
npm test -- --ui src/test/integration
```

## Test Structure

All integration tests follow the Arrange-Act-Assert (AAA) pattern:

```typescript
it('should do something', async () => {
  // Arrange - Set up test data and mocks
  const data = createTestData();
  mockFetch.mockResolvedValueOnce(createMockResponse(data));

  // Act - Execute the function under test
  const result = await serviceFunction(data);

  // Assert - Verify the results
  expect(result).toEqual(expectedValue);
});
```

## Mocking Strategy

Integration tests use:
- **Global Fetch Mock**: Intercepts HTTP requests
- **Factory Functions**: Create test data consistently
- **Response Objects**: Use standard Fetch API Response interface

Example:
```typescript
// Mock a successful response
mockFetch.mockResolvedValueOnce(
  createMockResponse(expectedData, 200, 'OK')
);

// Mock an error response
mockFetch.mockResolvedValueOnce(
  createErrorResponse('Not found', 404, 'Not Found')
);
```

## Writing New Integration Tests

### Template
```typescript
describe('Service Name Integration - Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something specific', async () => {
    // Arrange
    const testData = createTestData();
    mockFetch.mockResolvedValueOnce(createMockResponse(testData));

    // Act
    const result = await serviceFunction();

    // Assert
    expect(result).toEqual(testData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

### Best Practices
- One assertion focus per test (or logically grouped assertions)
- Clear, descriptive test names starting with "should"
- Use factory functions for test data
- Mock at the fetch level for isolation
- Clean up mocks in afterEach/beforeEach
- Test both success and error paths

## Debugging Tests

### Show Console Output
```bash
npm test -- --reporter=verbose src/test/integration
```

### Run Single Test
```bash
npm test -- --grep "specific test name" src/test/integration
```

### Inspect Mock Calls
Add to your test:
```typescript
console.log('Mock calls:', mockFetch.mock.calls);
console.log('Last call:', mockFetch.mock.calls[mockFetch.mock.calls.length - 1]);
```

### Increase Timeout
```typescript
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

## File Organization

```
src/test/integration/
├── code-extraction.test.ts          # Code extraction service tests
├── CODE_EXTRACTION_TESTS.md         # Detailed test documentation
├── README.md                        # This file
└── [future test files...]
```

## Related Documentation

- **Test Setup**: `src/test/setup.ts` - Global test configuration
- **Test Utils**: `src/test/test-utils.tsx` - Helper functions and mocks
- **Service**: `src/lib/services/credentialsService.ts` - Service under test
- **API Client**: `src/lib/apiClient.ts` - HTTP client being mocked

## Test Maintenance

### When to Update Tests
- API endpoint paths change
- Request/response format changes
- New fields are added to interfaces
- Error handling logic changes
- Performance thresholds change

### Checklist Before Committing
- [ ] All tests pass locally
- [ ] No test interdependencies
- [ ] Mocks are properly isolated
- [ ] Error cases are covered
- [ ] Test names are descriptive
- [ ] No hardcoded values that could be properties

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to develop/main
- Pre-push hooks (if configured)

### CI Command
```bash
npm test -- --run src/test/integration
```

## Troubleshooting

### Tests Timeout
- Increase timeout in test or vitest config
- Check for unresolved promises
- Verify mock setup is correct

### Mock Not Working
- Ensure mock is set up before act phase
- Use `mockResolvedValueOnce` for single calls
- Use `mockResolvedValue` for multiple calls (careful with Responses)

### Type Errors
- Ensure all imports are correct
- Verify interface definitions match implementation
- Check TypeScript strict mode is enabled

## Questions?

For more details on specific test suites, see:
- `CODE_EXTRACTION_TESTS.md` - Code extraction integration tests

For general testing patterns, see:
- `docs/testing-patterns.md` - Project testing guidelines
