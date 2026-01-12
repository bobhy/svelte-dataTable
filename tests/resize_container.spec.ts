import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('datatable reacts to container resize', async ({ page }) => {
    page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));
    await page.setViewportSize({ width: 1280, height: 1200 });

    // 1. Setup Test Scenario
    // We can use the default settings (50 rows, 5 cols) as we only care about vertical resizing rendering
    console.log('Navigating to test page...');
    await loadWithConfig(page, {
        rows: 50,
        cols: 5
    });

    // Wait for the grid container to be visible
    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // Force initial height to 600px to match test assumptions
    await page.evaluate(() => {
        const el = document.getElementById('grid-container');
        if (el) el.style.height = '600px';
    });
    // Wait for resize observer
    await page.waitForTimeout(200);

    // The grid container initially has style="width: 800px; height: 600px;"
    // Row height is forced to 50px in App.svelte styles.
    // 600px height - ~50px header = 550px body.
    // 550 / 50 = 11 visible rows.
    // Plus overscan (default 5). So roughly 16 rows expected.

    // Helper to get rendered row count
    const getRenderedRowCount = async () => {
        return await page.locator('[role="row"]').count();
    };

    // Initial check
    let initialCount = await getRenderedRowCount();
    console.log(`Initial rendered rows (600px height): ${initialCount}`);

    // We expect at least the visible amount
    expect(initialCount).toBeGreaterThanOrEqual(11);
    expect(initialCount).toBeLessThan(40); // Sanity upper bound

    // 2. Shrink the container
    // New height: 300px.
    // Header ~50px. Body ~250px.
    // Visible rows: 250 / 50 = 5 rows.
    // Expected rendered: 5 + overscan(5) = ~10.

    console.log('Resizing container to 300px...');
    await page.evaluate(() => {
        const el = document.getElementById('grid-container');
        if (el) el.style.height = '300px';
    });

    // Wait for ResizeObserver and Reactivity (give it a moment)
    await page.waitForTimeout(500);

    let shrunkCount = await getRenderedRowCount();
    console.log(`Rendered rows after shrink (300px height): ${shrunkCount}`);

    // Verify it decreased
    expect(shrunkCount).toBeLessThan(initialCount);
    expect(shrunkCount).toBeGreaterThanOrEqual(5);

    // 3. Expand the container
    // New height: 900px.
    // Header ~50px. Body ~850px.
    // Visible rows: 850 / 50 = 17 rows.
    // Expected rendered: 17 + overscan(5) = ~22.

    console.log('Resizing container to 900px...');
    await page.evaluate(() => {
        const el = document.getElementById('grid-container');
        if (el) el.style.height = '900px';
    });

    await page.waitForTimeout(500);

    let expandedCount = await getRenderedRowCount();
    console.log(`Rendered rows after expand (900px height): ${expandedCount}`);

    // Verify it increased
    expect(expandedCount).toBeGreaterThan(shrunkCount);
    expect(expandedCount).toBeGreaterThan(initialCount); // Should be more than the 600px version too
    expect(expandedCount).toBeGreaterThanOrEqual(17);
});
