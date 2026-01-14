import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('find highlights the specific cell containing the match', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Search for "C2" which should be found in column C2
    await findInput.fill('C2');
    await page.waitForTimeout(300);

    // Get the active cell info via the exposed API
    const activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });

    // Should have found it in row 0, column col2
    expect(activeCellInfo).not.toBeNull();
    expect(activeCellInfo.dataColumnName).toBe('col2');

    // The cell should have the focused styling (bg-primary/20 ring-1)
    // Find the cell at the active position
    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    // Check that some cell has the focused styling
    const focusedCell = page.locator('[role="gridcell"].bg-primary\\/20');
    await expect(focusedCell).toBeVisible();
});

test('find highlights different columns for different matches', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // First search for "C1" which should be in column C1
    await findInput.fill('C1');
    await page.waitForTimeout(300);

    let activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });

    expect(activeCellInfo.dataColumnName).toBe('col1');

    // Now search for "C3" which should be in column C3
    await findInput.fill('C3');
    await page.waitForTimeout(300);

    activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });

    expect(activeCellInfo.dataColumnName).toBe('col3');
});

test('find sets active row and column correctly', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Search for "R10C4" which should be at row 10, column C4
    await findInput.fill('R10C4');
    await page.waitForTimeout(300);

    const activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });

    expect(activeCellInfo).not.toBeNull();
    expect(activeCellInfo.dataRowIndex).toBe(10);
    expect(activeCellInfo.dataColumnName).toBe('col4');
});
