import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('datatable should respect column justification settings', async ({ page }) => {
    // Explicit columns with justification
    const columns = [
        { name: 'left', title: 'Left', justify: 'left' },
        { name: 'center', title: 'Center', justify: 'center' },
        { name: 'right', title: 'Right', justify: 'right' }
    ];

    await loadWithConfig(page, {
        config: { columns },
        rows: 5,
        cols: 3
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible({ timeout: 15000 });

    // Wait for rows to render
    await expect(page.locator('[role="row"]').first()).toBeVisible();

    // Check cells in first row
    const firstRow = page.locator('[role="row"]').first();

    // Cell 0: Left
    const cellLeft = firstRow.locator('[role="gridcell"]').nth(0);
    await expect(cellLeft).toHaveClass(/text-left/);
    await expect(cellLeft).toHaveClass(/justify-start/);

    // Cell 1: Center
    const cellCenter = firstRow.locator('[role="gridcell"]').nth(1);
    await expect(cellCenter).toHaveClass(/text-center/);
    await expect(cellCenter).toHaveClass(/justify-center/);

    // Cell 2: Right
    const cellRight = firstRow.locator('[role="gridcell"]').nth(2);
    await expect(cellRight).toHaveClass(/text-right/);
    await expect(cellRight).toHaveClass(/justify-end/);
});

