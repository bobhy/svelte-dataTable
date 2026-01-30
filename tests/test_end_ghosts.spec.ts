import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('should render data correctly at the END of the list', async ({ page }) => {
    // 1. Setup
    const rows = 500;
    await loadWithConfig(page, {
        rows: rows,
        cols: 5,
        latency: 100
    });

    const grid = page.locator('[role="grid"]');

    // Listen for browser console messages
    page.on('console', msg => {
        if (msg.text().includes('[Fetch]') || msg.text().includes('[DataSource]')) {
            console.log(`[Browser]: ${msg.text()}`);
        }
    });

    await expect(grid).toBeVisible();
    await page.locator('[role="row"]').first().waitFor({ timeout: 5000 });
    await grid.focus();

    console.log("Scrolling to end...");

    // 2. Scroll to the very bottom using PageDown to trigger fetches
    const targetRow = rows - 1;
    let stuckCount = 0;

    // We expect to reach the end in roughly 30 steps (500/20 = 25 pages)
    // But we allow more iterations to account for fetch delays.
    const maxLoops = 100;

    for (let i = 0; i < maxLoops; i++) {
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(200); // Give time for fetch and render

        // Check where we are
        const active = await page.evaluate(() => (window as any).getDataTableActiveCell());
        // console.log(`[Scroll Loop ${i}] Active: ${active?.dataRowIndex}`);

        if (active && active.dataRowIndex >= targetRow) {
            console.log("Reached target row!");
            break;
        }

        // If we get stuck at same index for too long, maybe break?
        // But let's trust maxLoops.
        if (active && active.dataRowIndex >= 499) break;
    }

    // Safety wait at end
    await page.waitForTimeout(2000);

    // 3. Verify the LAST row exists and has content
    const lastRowIndex = rows - 1;
    const lastRow = page.locator(`[data-index="${lastRowIndex}"]`);

    // Scroll quite a bit to ensure virtualizer renders it
    await lastRow.scrollIntoViewIfNeeded();

    await expect(lastRow).toBeVisible();

    // Check text content
    const text = await lastRow.innerText();
    const html = await lastRow.innerHTML();
    console.log(`Last Row Text: "${text}"`);
    console.log(`Last Row HTML: "${html}"`);

    // Should contain "R499C0"
    await expect(lastRow).toContainText(`R${lastRowIndex}C0`);

    // Check for "..." which would indicate a placeholder
    const isPlaceholder = text.includes("...");
    expect(isPlaceholder).toBe(false);
});
