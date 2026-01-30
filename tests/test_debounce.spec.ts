import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('should process queued navigation after fetch with HIGH latency', async ({ page }) => {
    page.on('console', msg => console.log('[Browser]:', msg.text()));

    // 1. Setup 500 rows with 500ms latency
    const rows = 500;
    await loadWithConfig(page, {
        rows: rows,
        cols: 5,
        latency: 500
    });

    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    // Wait for data to load
    await page.locator('[role="row"]').first().waitFor({ timeout: 5000 });

    // 2. Focus the grid
    await grid.click();

    console.log("Starting scroll descent with PageDown...");

    // Press PageDown rapidly.
    // 500 rows, ~20 rows/page => ~25 presses needed to traverse.
    // We'll press 150 times (approx 7-8 seconds) to cover initial fetch + scrolling.
    for (let i = 0; i < 150; i++) {
        await page.keyboard.press('PageDown');

        // Force focus every 10 iterations to prevent test harness focus loss
        if (i % 10 === 0) {
            await grid.focus();
        }

        // Fast tapping (10ms spacing) to simulate OS repeat "leaning"
        if (i % 2 === 0) await page.waitForTimeout(10);
    }

    console.log("Finished key presses.");

    // 4. Verify we are eventually at the end
    await page.waitForTimeout(10000); // Allow catch up

    const finalInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    console.log("Final Active Cell:", finalInfo);

    // We expect to reach the end (row 499)
    expect(finalInfo.dataRowIndex).toBeGreaterThan(480);
});
