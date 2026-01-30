import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('should render data (not placeholders) during moderate scrolling', async ({ page }) => {
    // 1. Setup moderate latency
    await loadWithConfig(page, {
        rows: 500,
        cols: 5,
        latency: 50
    });

    const grid = page.locator('[role="grid"]');
    await expect(grid).toBeVisible();
    await page.locator('[role="row"]').first().waitFor({ timeout: 5000 });
    await grid.focus();

    console.log("Starting descent...");

    // 2. Press ArrowDown
    const steps = 200;
    for (let i = 0; i < steps; i++) {
        await page.keyboard.press('ArrowDown', { delay: 10 });

        if (i % 50 === 0) {
            const activeText = await page.evaluate(() => {
                const active = (window as any).getDataTableActiveCell();
                if (!active) return "No Active";
                const row = document.querySelector(`[data-index="${active.dataRowIndex}"]`);
                if (!row) return "Row Not Rendered";
                return row.textContent;
            });
            // console.log(`[Loop ${i}] Active Row Text: "${activeText}"`);
        }
    }

    // Final check
    const finalActive = await page.evaluate(() => (window as any).getDataTableActiveCell());
    console.log("Final Active:", finalActive);

    // Ensure we have data at the end
    const lastRow = page.locator(`[data-index="${finalActive.dataRowIndex}"]`);
    // Assertion: Should contain "RXC0" where X is row index
    await expect(lastRow).toContainText(`R${finalActive.dataRowIndex}C0`);
});
