
import { test, expect } from '@playwright/test';

test.describe('DataTable Reproduction: Create Overwrite', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(msg.text()));
        // Setup config injection with 20 rows
        await page.addInitScript(() => {
            (window as any).__TEST_CONFIG__ = {
                rows: 5,
                cols: 2,
                config: {
                    isEditable: true
                }
            };
        });

        await page.goto('/?test_app=true');
        await page.waitForSelector('#grid-container');
    });

    test('should shift existing rows down when adding a new row', async ({ page }) => {
        const rows = page.locator('[role="row"]');

        // 1. Capture Initial State
        // Expected: R0C0, R1C0, R2C0 ...
        await expect(rows).toHaveCount(5);
        const row0 = rows.nth(0);
        const row1 = rows.nth(1);

        await expect(row0).toContainText('R0C0');
        await expect(row1).toContainText('R1C0');

        console.log('Verified Initial State: Row 0 = R0C0, Row 1 = R1C0');

        // 2. Mock creation success
        await page.exposeFunction('__onRowEdit', (action: string, row: any) => {
            return true;
        });

        // 3. Perform "Save as New" on Row 0
        await row0.dblclick();
        const input = page.locator('input#col0');
        await input.fill('NEW_ROW');
        await page.getByRole('button', { name: 'Save as New' }).click();

        // 4. Verify Result
        // We expect 6 rows.
        // Row 0 should be "NEW_ROW".
        // Row 1 should be "R0C0" (The old Row 0, shifted down).
        // Debug: Log all rows
        const count = await rows.count();
        console.log(`Row count: ${count}`);
        for (let i = 0; i < count; i++) {
            console.log(`Row ${i}: ${await rows.nth(i).innerText()}`);
        }


        // Wait for reactivity (Virtualizer update might be async/debounced)
        await page.waitForTimeout(2000);

        await expect(rows).toHaveCount(6);

        const newRow0 = rows.nth(0);
        const newRow1 = rows.nth(1);

        console.log('Checking Row 0...');
        await expect(newRow0).toContainText('NEW_ROW');

        console.log('Checking Row 1 (Should be old R0C0)...');
        // This is the CRITICAL assertion.
        // If bug exists, Row 1 might be R1C0 (swallowing R0C0), or something else.
        await expect(newRow1).toContainText('R0C0');
    });
});
