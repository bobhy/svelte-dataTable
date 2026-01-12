# Contributing to DataTable

## Development Guidelines

### Testing

> [!IMPORTANT]
> **Test Coverage Rule**
> Whenever you change code in `DataTable`, you must review both **unit tests** and **Playwright tests** to ensure the changed behavior is covered.
> - If the behavior is new, add a new test.
> - If the behavior changes, update existing tests.
> - Ensure all tests pass before completing the task.

### Running Tests
- **Unit Tests**: `npm run test` (Vitest)
- **E2E Tests**: `CI=true npx playwright test` (Playwright)
