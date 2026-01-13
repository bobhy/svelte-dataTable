import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('filter should support pagination', async ({ page }) => {
    // 1. Setup 100 rows.
    // Content is R0C0...R99C0
    // Search "C0" matches ALL rows (100 matches).
    const rows = 100;
    await loadWithConfig(page, {
        config: {
            isFilterable: true
        },
        rows: rows,
        cols: 5
    });

    const filterInput = page.getByPlaceholder('Filter...');
    await expect(filterInput).toBeVisible();

    // 2. Type "C0" - This is in every cell of column 0.
    // So all 100 rows should match.
    await filterInput.fill('C0');
    // Wait for debounce/fetch
    await page.waitForTimeout(500);

    // 3. Verify first page
    await expect(page.getByText('R0C0')).toBeVisible();
    await expect(page.getByText('R5C0')).toBeVisible(); // Check a few rows are visible

    // 4. Verify we don't see the end yet
    await expect(page.getByText('R99C0')).not.toBeVisible();

    // 5. Scroll to bottom
    const grid = page.locator('[role="grid"]');

    // Check initial row count (rendered)
    const initialRows = await page.locator('[role="row"]').count();
    console.log("Initial rows:", initialRows);

    // We scroll deeply.
    await page.evaluate(() => {
        const el = document.querySelector('[role="grid"]');
        if (el) el.scrollTop = el.scrollHeight;
    });

    // Wait for fetch
    await page.waitForTimeout(2000);

    // 6. Verify more rows are loaded
    const userRows = await page.locator('[role="row"]').count();
    console.log("Rows after scroll:", userRows);

    expect(userRows).toBeGreaterThan(initialRows);
});
