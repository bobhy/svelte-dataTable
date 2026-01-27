---
description: Run Playwright tests for the DataTable component without hanging
---
Use this workflow to run Playwright tests and avoid the HTML reporter hang by using the `list` reporter.

1. Run all tests:
```bash
cd /home/bobhy/worktrees/dataTable
npx playwright test --reporter=list
```

2. Run a specific test file:
```bash
cd /home/bobhy/worktrees/dataTable
npx playwright test tests/datatable-crud.spec.ts --reporter=list
```

3. Run in headed mode (visible browser):
```bash
cd /home/bobhy/worktrees/dataTable
npx playwright test --headed --reporter=list
```
