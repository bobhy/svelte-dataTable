import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('header should show sort indicators', async ({ page }) => {
    // Explicit config with ID and Name
    const columns = [
        { name: 'id', title: 'ID', isSortable: true },
        { name: 'name', title: 'Name', isSortable: true }
    ];

    await loadWithConfig(page, {
        config: { columns }
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible();

    // Open sort dialog from first header (ID)
    const firstHeader = gridContainer.getByRole('button', { name: 'ID' });
    await firstHeader.click();

    // Configure sort: ID Descending
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Row 1
    const row1 = dialog.locator('div.flex.items-center.gap-2').nth(0);
    const dirSelect = row1.locator('select').nth(0);
    const colSelect = row1.locator('select').nth(1);

    // Set Direction to Descending
    await dirSelect.selectOption('desc');
    // Set Column to ID
    await colSelect.selectOption('id');

    // Click Apply
    await dialog.getByRole('button', { name: 'Apply Sort' }).click();

    // Expect dialog to close
    await expect(dialog).toBeHidden();

    // Check Header for indicator
    // We expect "1" and an SVG arrow.
    await expect(firstHeader).toContainText('1');

    // Check for arrow icon (SVG)
    const svg = firstHeader.locator('svg.lucide-arrow-down');
    await expect(svg).toBeVisible();
});

