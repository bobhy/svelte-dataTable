# Contributing to DataTable

## Development Guidelines

### Testing

> [!IMPORTANT]
> **Test Coverage Rule**
> Whenever you change code in `DataTable`, you must review both **unit tests** and **Playwright tests** to ensure the changed behavior is covered.
> - If the behavior is new, add a new test.
> - If the behavior changes, update existing tests.
> - Ensure all tests pass before completing the task.

### Available Tests & Checks

| Command | Description |
|---------|-------------|
| `npx vitest run` | Run all Vitest unit/integration tests (single run) |
| `npx vitest` | Run Vitest tests in watch mode (interactive) |
| `npx svelte-check --tsconfig ./tsconfig.json` | TypeScript & Svelte type checking<br>2 errors about excessively deep instantiation are "normal", might be result of using zod. |
| `npx playwright test` | Run all Playwright E2E tests |
| `npx playwright test tests/<file>.spec.ts` | Run a specific Playwright test file |
| `npm run build` | Build the project (verifies compilation) |

### Recommended Workflow

1. **Before committing**: Run `npx vitest run` and `npx svelte-check` to catch errors early.
2. **For UI changes**: Run `npx playwright test` to verify E2E functionality.
3. **For development**: Use `npx vitest` (watch mode) for rapid feedback.
