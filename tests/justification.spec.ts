import { test, expect } from '@playwright/test';

test('datatable should respect column justification settings', async ({ page }) => {
    // Navigate to the test page with the justification scenario
    await page.goto('/?scenario=justification');

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible({ timeout: 15000 });

    // Wait for rows to render
    await expect(page.locator('[role="row"]').first()).toBeVisible();

    // The first 3 columns are configured as left, center, right.
    // We check the first row's cells.

    // Cell 0: Left
    // Note: The structure is roughly:
    // <div role="gridcell" class="... text-left ..."> ... </div>
    const cellLeft = page.locator('[role="row"]').first().locator('[role="gridcell"]').nth(0);
    await expect(cellLeft).toHaveClass(/text-left/);

    // Cell 1: Center
    const cellCenter = page.locator('[role="row"]').first().locator('[role="gridcell"]').nth(1);
    await expect(cellCenter).toHaveClass(/text-center/);

    // Cell 2: Right
    const cellRight = page.locator('[role="row"]').first().locator('[role="gridcell"]').nth(2);
    await expect(cellRight).toHaveClass(/text-right/);
});
