import { test, expect } from '@playwright/test';

// Common test setup
const loadTestApp = async (page: any, useContainer: boolean) => {
    // Navigate with query params to configure the app
    await page.goto(`/?test_app=true&scenario=layout-test&useContainer=${useContainer}&rows=50&cols=5`);
};

test.describe('DataTable Layout Container', () => {

    test('should fail layout without container in bad parent', async ({ page }) => {
        await loadTestApp(page, false); // No container

        const gridContainer = page.locator('#grid-container-raw');
        const dataTable = page.locator('.datatable-wrapper');

        // Verify the raw container exists
        await expect(gridContainer).toBeVisible({ timeout: 2000 });

        // In the "bad parent" scenario (flex-1 h-full, no relative),
        // an absolute inset-0 child will look for the nearest relative ancestor.
        // If none is found, it sizes to the viewport (or body).

        // We want to verify it is NOT correctly contained. 
        // A correct containment means the table is inside the #bad-parent.
        // If it escapes, its dimensions might be huge or 0 if collapsed.

        // Actually, if it's absolute without relative parent, it overlays.
        // Let's check if the DataTable bounding box matches the #bad-parent bounding box.

        const parentBox = await page.locator('#bad-parent').boundingBox();
        const tableBox = await dataTable.boundingBox();

        if (parentBox && tableBox) {
            // If it escapes, the top/left/width/height will likely mismatch significantly.
            // For example, if it hits the body, it might be much larger.

            // Allow for small rounding differences, but a "break" should be obvious.
            // If the table is NOT contained, it might be 0x0 or screen size.

            // Warning: precise pixel assertions can be flaky.
            // But here we expect a structural failure.

            // Let's assert that they do NOT match if it's broken.
            // Or simpler: check if the table is visible at all. 
            // If the user says "breaks", it might mean blank screen (0 height).
            // In a flex container without height and without "relative", absolute child might be 0 height.

            // If table height is ~0, it's broken.
            if (tableBox.height < 50) {
                // Pass: it is broken as expected.
            } else {
                // If it renders, check if it matches parent.
                // If the parent is small but table is huge -> broken.
                // If matching -> then the test setup failed to reproduce breakage.

                // Let's assume breakage means it doesn't fit the parent.
                const isContained =
                    Math.abs(tableBox.x - parentBox.x) < 2 &&
                    Math.abs(tableBox.y - parentBox.y) < 2 &&
                    Math.abs(tableBox.width - parentBox.width) < 2 &&
                    Math.abs(tableBox.height - parentBox.height) < 2;

                expect(isContained).toBeFalsy();
            }
        }
    });

    test('should fix layout with container in bad parent', async ({ page }) => {
        await loadTestApp(page, true); // With container

        const dataTable = page.locator('.datatable-wrapper');
        const badParent = page.locator('#bad-parent');

        // With the container, it MUST be contained within the parent.
        // DataTableContainer provides the 'relative' context and 'flex-1' to fill the parent.

        await expect(dataTable).toBeVisible({ timeout: 2000 });

        const parentBox = await badParent.boundingBox();
        const tableBox = await dataTable.boundingBox();

        expect(parentBox).not.toBeNull();
        expect(tableBox).not.toBeNull();

        if (parentBox && tableBox) {
            // Should match closely (inset-0)
            expect(Math.abs(tableBox.x - parentBox.x)).toBeLessThan(5);
            expect(Math.abs(tableBox.y - parentBox.y)).toBeLessThan(5);
            expect(Math.abs(tableBox.width - parentBox.width)).toBeLessThan(5);
            expect(Math.abs(tableBox.height - parentBox.height)).toBeLessThan(5);
        }
    });
});
