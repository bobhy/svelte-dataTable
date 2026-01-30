import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('should scroll past page boundary with ISOLATED key presses and latency', async ({ page }) => {
    page.on('console', msg => console.log('[Browser]:', msg.text()));

    // 1. Setup 50 rows with 200ms latency
    const rows = 50;
    await loadWithConfig(page, {
        rows: rows,
        cols: 5,
        latency: 200 // Reduced from 500ms
    });

    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();

    // Wait for data to load
    await page.locator('[role="row"]').first().waitFor({ timeout: 5000 });

    // 2. Focus the grid
    await page.locator('[role="row"]').first().click();

    console.log("Starting slow stepping descent...");

    // Step specifically past the first page boundary (usually ~20 rows)
    // We'll go to row 28 to prove we crossed it.
    for (let i = 0; i < 28; i++) {
        // Press and wait - simulating "Isolated" keypress
        await page.keyboard.press('ArrowDown');

        // Wait longer than latency to ensure fetch *could* complete and settle
        await page.waitForTimeout(250);

        // Log active cell to verify movement
        const active = await page.evaluate(() => {
            const el = document.activeElement;
            const tag = el ? el.tagName : 'null';
            const role = el ? el.getAttribute('role') : 'null';
            console.log(`[Focus] ${tag} role=${role}`);
            return (window as any).getDataTableActiveCell();
        });
        console.log(`[Step ${i}] Index: ${active.dataRowIndex}`);

        // Expect progress
        // Note: The stall reportedly happens at the bottom of the first page (e.g. index 18 or 19)
        // If i matches active index, we are good. If i > active index, we stalled.
        if (i > active.dataRowIndex) {
            console.log("STALLED!");
        }
    }

    const finalInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    console.log("Final Active Cell:", finalInfo);

    // Should have reached near 29
    expect(finalInfo.dataRowIndex).toBeGreaterThan(25);
});
