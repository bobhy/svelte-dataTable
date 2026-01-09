import { test, expect } from '@playwright/test';

test('header should show sort indicators', async ({ page }) => {
    await page.goto('/');

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // Open sort dialog from first header (ID)
    const firstHeader = gridContainer.locator('button').first();
    await firstHeader.click();

    // Configure sort: ID Descending
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const selects = dialog.locator('select');
    // 0: Direction (Asc/Desc), 1: Column (None/ID/...)

    // Set Direction to Descending
    await selects.nth(0).selectOption('desc');
    // Set Column to ID (value "id" or similar based on test data)
    // TestGridDataSource used in App.svelte has columns keys: 'id', 'name0', etc.
    // The option value is likely 'id'.
    await selects.nth(1).selectOption({ label: 'ID' });

    // Click Apply
    await dialog.getByRole('button', { name: 'Apply Sort' }).click();

    // Expect dialog to close
    await expect(dialog).toBeHidden();

    // Check Header for indicator
    // We expect "1" and an SVG arrow.
    // The text content of the button should contain "ID" and "1".
    await expect(firstHeader).toContainText('1');

    // Check for arrow icon (SVG)
    const svg = firstHeader.locator('svg');
    await expect(svg).toBeVisible();
});
