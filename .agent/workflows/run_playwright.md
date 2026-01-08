---
description: Run Playwright tests for the DataTable component
---
1. Navigate to the `dataTable` workspace: `cd /home/bobhy/worktrees/dataTable`
2. Install Chromium (if not already installed) or ensure environment is ready.
3. Run the tests using the chromium project:
   ```bash
   npx playwright test --project=chromium --reporter=list
   ```
   You can append a specific test file path to run only that test, e.g.:
   ```bash
   npx playwright test tests/reproduce_resize_error.spec.ts --project=chromium --reporter=list
   ```
// turbo
