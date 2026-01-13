import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('toolbar filter should appear and filter data', async ({ page }) => {
    // 1. Setup with isFilterable=true
    await loadWithConfig(page, {
        config: {
            isFilterable: true,
            isFindable: false
        },
        rows: 20,
        cols: 5
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // 2. Check for Filter Input
    const filterInput = page.getByPlaceholder('Filter...');
    await expect(filterInput).toBeVisible();

    // 3. Verify Search Functionality
    // Initial rows: 0 to 19.
    // Content is R0C0, R1C0, etc.
    // Searching for "R1" should show R1C0..R1C4, R10..R19.
    // Searching for "R10" should show R10..R10*

    // Type "R5" -> Should match Row 5.
    await filterInput.fill('R5');

    // Wait for update (debounce/fetch)
    await page.waitForTimeout(500);

    // Expect Row 5 to be visible
    await expect(page.getByText('R5C0')).toBeVisible();

    // Expect Row 2 to be HIDDEN (content R2C0)
    await expect(page.getByText('R2C0')).toBeHidden();

    // Verify Find input not present
    const findInput = page.getByPlaceholder('Find...');
    await expect(findInput).not.toBeVisible();
});

test('toolbar find should appear when configured', async ({ page }) => {
    // 1. Setup with isFindable=true
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    // 2. Check for Find Input
    const findInput = page.getByPlaceholder('Find...');
    await expect(findInput).toBeVisible();

    // Verify Filter input not present
    const filterInput = page.getByPlaceholder('Filter...');
    await expect(filterInput).not.toBeVisible();
});
