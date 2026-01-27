
import { test, expect } from '@playwright/test';

test.describe('DataTable CRUD', () => {
    test.beforeEach(async ({ page }) => {
        // Listen to console logs
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()} `));
        page.on('pageerror', exception => console.log(`[Browser Error]: ${exception} `));

        // Setup config injection before navigation
        await page.addInitScript(() => {
            (window as any).__TEST_CONFIG__ = {
                rows: 20,
                cols: 5,
                config: {
                    isEditable: true
                }
            };
        });

        // Go to test app
        await page.goto('/?test_app=true');
        await page.waitForSelector('#grid-container');
    });

    test('should open edit dialog on double click', async ({ page }) => {
        const firstRow = page.locator('[role="row"]').first();
        await expect(firstRow).toBeVisible();

        await firstRow.dblclick();

        await expect(page.locator('[role="dialog"]')).toBeVisible();
        await expect(page.getByText('Edit Row')).toBeVisible();

        // Check if inputs are populated (assuming default DS has "R0C0" etc)
        const input = page.locator('[role="dialog"] input').first();
        await expect(input).not.toBeEmpty();
    });

    test('should trigger update action', async ({ page }) => {
        let callParams: any = null;
        await page.exposeFunction('__onRowEdit', (action: string, row: any) => {
            callParams = { action, row };
            return true;
        });

        await page.locator('[role="row"]').first().dblclick();
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Change value
        // Note: Field names depend on TestGridDataSource columns "col0", "col1"...
        const input = page.locator('input#col0');
        await input.fill('UpdatedValue');

        await page.getByRole('button', { name: 'Save Changes' }).click();

        // Dialog should close
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();

        // Verify callback
        expect(callParams).not.toBeNull();
        expect(callParams.action).toBe('update');
        expect(callParams.row.col0).toBe('UpdatedValue');

        // Verify local update (table should show new value)
        await expect(page.locator('[role="row"]').first()).toContainText('UpdatedValue');
    });

    test('should trigger delete action', async ({ page }) => {
        let callParams: any = null;
        await page.exposeFunction('__onRowEdit', (action: string, row: any) => {
            callParams = { action, row };
            return true;
        });

        // Auto-accept confirmation dialogs
        page.on('dialog', dialog => dialog.accept());

        await page.locator('[role="row"]').first().dblclick();

        await page.getByRole('button', { name: 'Delete' }).click();

        await expect(page.locator('[role="dialog"]')).not.toBeVisible();

        expect(callParams).not.toBeNull();
        expect(callParams.action).toBe('delete');

        // Verify row is removed (or count decreases)
        // With 20 rows initially
        // Ideally we check key column content
    });

    test('should trigger create action (Save as New)', async ({ page }) => {
        let callParams: any = null;
        await page.exposeFunction('__onRowEdit', (action: string, row: any) => {
            callParams = { action, row };
            return true;
        });

        await page.locator('[role="row"]').first().dblclick();

        const input = page.locator('input#col0');
        await input.fill('NewRowValue');

        await page.getByRole('button', { name: 'Save as New' }).click();

        await expect(page.locator('[role="dialog"]')).not.toBeVisible();

        expect(callParams).not.toBeNull();
        expect(callParams.action).toBe('create');
        expect(callParams.row.col0).toBe('NewRowValue');

        // Verify new row is at the top
        await expect(page.locator('[role="row"]').first()).toContainText('NewRowValue');
    });
});
