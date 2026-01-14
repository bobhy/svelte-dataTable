import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('find notification appears when search term not found in input', async ({ page }) => {
    // Setup with isFindable=true
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // Get the find input
    const findInput = page.getByPlaceholder('Find...');
    await expect(findInput).toBeVisible();

    // Type a search term that doesn't exist
    await findInput.fill('ZZZZZ');

    // Wait a moment for the find operation to complete
    await page.waitForTimeout(200);

    // Check for the "not found" notification
    const notification = page.getByText('not found');
    await expect(notification).toBeVisible();

    // Verify the notification is positioned (has coordinates)
    const box = await notification.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);

    // Wait for it to disappear (should fade out after 1 second)
    await page.waitForTimeout(1200);
    await expect(notification).not.toBeVisible();
});

test('find notification appears when clicking next button with no matches', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Type a term that doesn't exist
    await findInput.fill('ZZZZZ');
    await page.waitForTimeout(200);

    // Clear any existing notification
    await page.waitForTimeout(1200);

    // Click the "Find Next" button
    const findNextBtn = page.locator('.find-next-btn');
    await expect(findNextBtn).toBeVisible();
    await findNextBtn.click();

    // Check for notification
    const notification = page.getByText('not found');
    await expect(notification).toBeVisible();

    // Verify it disappears
    await page.waitForTimeout(1200);
    await expect(notification).not.toBeVisible();
});

test('find notification appears when clicking previous button with no matches', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Type a term that doesn't exist
    await findInput.fill('NONEXISTENT');
    await page.waitForTimeout(200);

    // Clear any existing notification
    await page.waitForTimeout(1200);

    // Click the "Find Previous" button
    const findPrevBtn = page.locator('.find-prev-btn');
    await expect(findPrevBtn).toBeVisible();
    await findPrevBtn.click();

    // Check for notification
    const notification = page.getByText('not found');
    await expect(notification).toBeVisible();

    // Verify it disappears
    await page.waitForTimeout(1200);
    await expect(notification).not.toBeVisible();
});

test('find navigation works and notification appears at end of results', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Search for "R1" which should match R1, R10-R19 (11 total matches)
    await findInput.fill('R1');
    await page.waitForTimeout(300);

    const findNextBtn = page.locator('.find-next-btn');

    // Click next multiple times to reach the end of matches
    // We'll click 15 times which should exhaust all matches
    for (let i = 0; i < 15; i++) {
        await findNextBtn.click();
        await page.waitForTimeout(100);
    }

    // After exhausting matches, notification should appear
    const notification = page.getByText('not found');
    await expect(notification).toBeVisible();
});

test('find notification does not appear when match is found', async ({ page }) => {
    // Setup
    await loadWithConfig(page, {
        config: {
            isFilterable: false,
            isFindable: true
        },
        rows: 20,
        cols: 5
    });

    await expect(page.locator('#grid-container')).toBeVisible();

    const findInput = page.getByPlaceholder('Find...');

    // Search for "R5" which exists
    await findInput.fill('R5');
    await page.waitForTimeout(300);

    // Notification should NOT appear because a match was found
    const notification = page.getByText('not found');
    await expect(notification).not.toBeVisible();

    // Click next button - should find R15 next
    const findNextBtn = page.locator('.find-next-btn');
    await findNextBtn.click();
    await page.waitForTimeout(300);

    // Still should not show notification because R15 exists
    await expect(notification).not.toBeVisible();
});
