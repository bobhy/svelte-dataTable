import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('should scroll to bottom using ArrowDown with HIGH latency', async ({ page }) => {
    page.on('console', msg => console.log('[Browser]:', msg.text()));

    // 1. Setup 1000 rows with 300ms latency (simulating slow backend)
    const rows = 1000;
    await loadWithConfig(page, {
        rows: rows,
        cols: 5,
        latency: 300
    });

    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    // Wait for data to load
    await page.locator('[role="row"]').first().waitFor({ timeout: 10000 });

    // 2. Focus the grid (Click row 0 specifically as user described "click in top row")
    await page.locator('[role="row"]').first().click();

    console.log("Starting scroll descent with ArrowDown...");

    // Press ArrowDown rapidly.
    // 1000 rows.
    // "Leaning": 10ms interval.
    // We expect to go past the first page (row 20).
    const targetRow = 100; // Let's try to get to row 100 first to prove we crossed the boundary

    for (let i = 0; i < targetRow + 50; i++) {
        await page.keyboard.press('ArrowDown');

        // Force focus occasionally
        if (i % 20 === 0) {
            await grid.focus();
            const active = await page.evaluate(() => (window as any).getDataTableActiveCell());
            console.log(`[Loop ${i}] Active: ${active.dataRowIndex}`);
        }

        // Fast tapping (10ms spacing)
        if (i % 2 === 0) await page.waitForTimeout(10);
    }

    console.log("Finished key presses.");

    // 4. Verify we are deep in the list
    await page.waitForTimeout(2000); // Allow catch up

    const finalInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    console.log("Final Active Cell:", finalInfo);

    // If stalled at row ~18, this will fail
    expect(finalInfo.dataRowIndex).toBeGreaterThan(80);
});
