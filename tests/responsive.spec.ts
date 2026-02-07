import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('DataTable should fill parent and resize responsively', async ({ page }) => {
    // 1. Load the page with sufficient rows to potentially overflow if not virtualized correctly
    await loadWithConfig(page, {
        rows: 100,
        cols: 5
    });

    const gridContainer = page.locator('#grid-container');
    const dataTable = page.locator('.datatable-wrapper'); // Verify class name in DataTable.svelte
    // Wait for table to be visible
    await expect(gridContainer).toBeVisible();

    // Helper to check for scrollbars on the parent container
    const checkNoParentScrollbars = async () => {
        const scrollHeight = await gridContainer.evaluate((el) => el.scrollHeight);
        const clientHeight = await gridContainer.evaluate((el) => el.clientHeight);
        // Allow a small tolerance for potential sub-pixel rendering or border issues, 
        // but generally scrollHeight should equal clientHeight for no overflow
        expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
    };

    // Helper to check footer visibility
    // The footer in DataTable.svelte has class "border-t bg-muted/40 p-2 text-xs flex justify-between"
    // We can target it by text content "Rows:"
    const footer = page.getByText(/Rows: \d+/);

    // Initial State Check
    await expect(footer).toBeVisible();
    await checkNoParentScrollbars();

    // 2. Resize Parent Larger (via Viewport)
    console.log('Resizing parent larger...');
    await page.setViewportSize({ width: 1280, height: 1000 }); // Increase height

    // Wait for resize observer to fire and layout to settle
    await page.waitForTimeout(500);

    await expect(footer).toBeVisible();
    await checkNoParentScrollbars();

    // Check if the container actually resized
    const largerHeight = await gridContainer.evaluate((el) => el.clientHeight);
    expect(largerHeight).toBeGreaterThan(500); // Expect it to be reasonably large
    expect(largerHeight).toBeLessThan(1000); // Expect it to be constrained by viewport (1000px)


    // 3. Resize Parent Smaller (via Viewport)
    console.log('Resizing parent smaller...');
    await page.setViewportSize({ width: 1280, height: 500 }); // Decrease height

    // Wait for resize observer
    await page.waitForTimeout(500);

    await expect(footer).toBeVisible();

    // Verify the table is still usable (e.g. rows are visible)
    const rows = page.locator('[role="row"]');
    await expect(rows.first()).toBeVisible();
});
