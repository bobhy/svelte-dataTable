import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('sort dialog should populate column options and handle multi-sort', async ({ page }) => {
    // 1. Setup with explicit columns
    const columns = [
        { name: 'id', title: 'ID', isSortable: true },
        { name: 'name', title: 'Name', isSortable: true },
        { name: 'age', title: 'Age', isSortable: true },
        { name: 'city', title: 'City', isSortable: false } // Not sortable
    ];

    await loadWithConfig(page, {
        config: { columns },
        rows: 10,
        cols: 4
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // 2. Open Sort Dialog
    const firstHeader = gridContainer.getByRole('button', { name: 'ID' });
    await firstHeader.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Sort Rows' })).toBeVisible();

    // 3. Verify Sort Inputs
    // We expect 3 "rows" of sort options (Sort by, Then by, Then by)
    // Structure: Row -> [Select Direction] "of" [Select Column]

    // Check first level
    const rows = dialog.locator('div.flex.items-center.gap-2');
    await expect(rows).toHaveCount(3);

    // Row 1: "Sort by"
    await expect(rows.nth(0)).toContainText('Sort by');
    const sort1Dir = rows.nth(0).locator('select').nth(0);
    const sort1Col = rows.nth(0).locator('select').nth(1);

    // Verify Available Columns
    // Should include ID, Name, Age. Should NOT include City.
    // Should include (None).
    const options = await sort1Col.locator('option').allInnerTexts();
    expect(options).toContain('(None)');
    expect(options).toContain('ID');
    expect(options).toContain('Name');
    expect(options).toContain('Age');
    expect(options).not.toContain('City');

    // 4. Configure Multi-Sort
    // Sort by Name Asc
    await sort1Col.selectOption('name');
    await sort1Dir.selectOption('asc');

    // Row 2: "Then by"
    await expect(rows.nth(1)).toContainText('Then by');
    const sort2Dir = rows.nth(1).locator('select').nth(0);
    const sort2Col = rows.nth(1).locator('select').nth(1);

    // Verify Name is NOT in second dropdown (already selected)
    const options2 = await sort2Col.locator('option').allInnerTexts();
    expect(options2).not.toContain('Name');
    expect(options2).toContain('Age');

    // Sort by Age Desc
    await sort2Col.selectOption('age');
    await sort2Dir.selectOption('desc');

    // 5. Apply
    await dialog.getByRole('button', { name: 'Apply Sort' }).click();
    await expect(dialog).toBeHidden();

    // 6. Verify Headers
    // Name header should have "1 ArrowUp"
    const nameHeader = gridContainer.locator('button', { hasText: 'Name' });
    await expect(nameHeader).toContainText('1');
    await expect(nameHeader.locator('svg.lucide-arrow-up')).toBeVisible();

    // Age header should have "2 ArrowDown"
    const ageHeader = gridContainer.locator('button', { hasText: 'Age' });
    await expect(ageHeader).toContainText('2');
    await expect(ageHeader.locator('svg.lucide-arrow-down')).toBeVisible();
});

