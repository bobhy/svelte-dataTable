import { test, expect } from '@playwright/test';

test('sort dialog should populate column options', async ({ page }) => {
    // Navigate to default view
    await page.goto('/');

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible({ timeout: 15000 });

    // Find a header and click it. "ID" is usually the first column in test data.
    // The header button triggers the dialog.
    // The header button triggers the dialog.
    // Selector: find the first button inside the header area (top of grid).
    // Note: The grid container contains the header.
    const firstHeader = gridContainer.locator('button').first();
    await firstHeader.click();

    // Check for Dialog title
    await expect(page.getByRole('heading', { name: 'Sort Rows' })).toBeVisible();

    // Check the "Sort by" dropdown (the first select element for column)
    // The dialog structure has a select for Direction and a select for Column.
    // The text check "of" is in between.

    // We can look for the select that contains options.
    // Ideally we find the select that follows "of".
    // Or just find all selects and checks their options. The direction select has "Ascending"/"Descending".

    // Let's find the select that SHOULD have columns.
    // It should have options other than just "Ascending", "Descending", "(None)".

    // We expect "ID", "Name", "Age" etc from TestGridDataSource.
    // TestGridDataSource columns: id, name0, name1 ...

    const dialog = page.getByRole('dialog');
    const columnSelects = dialog.locator('select').filter({ hasText: /None/ }); // Column selects have (None) option.

    // Wait for the select to be visible
    await expect(columnSelects.first()).toBeVisible();

    // Get text content of the select (options)
    const content = await columnSelects.first().textContent();

    // Expect it to contain "ID" (or "id")
    expect(content).toContain('ID');
});
