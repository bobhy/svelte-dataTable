# DataTable and Testing Best Practices

## Playwright Testing
- **Non-Interactive Mode**: When running Playwright tests in a non-interactive environment (or to avoid the HTML report server hanging), use the `CI=true` environment variable.
  Example: `CI=true npx playwright test`
- **Port Conflicts**: Ensure ports (like 5173 for Vite) are clear before running tests if you encounter EADDRINUSE errors.

## DataTable Implementation
- **Infinite Scroll Signal**: The `hasMore` logic depends on the data source returning fewer rows than requested. If `fetched < requested`, the table assumes end-of-data.
- **Sparse Data Arrays**: When implementing data fetching for virtualized tables, avoid `Array.prototype.push`. Use direct index assignment to safely handle sparse updates and non-contiguous fetches:
  ```typescript
  // Sparse-safe update pattern
  if (data.length < startRow + newRawRows.length) {
      data.length = startRow + newRawRows.length;
  }
  for (let i = 0; i < newRawRows.length; i++) {
      data[startRow + i] = newRawRows[i];
  }
  ```
