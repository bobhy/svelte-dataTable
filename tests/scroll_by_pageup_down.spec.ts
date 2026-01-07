
import { test, expect } from '@playwright/test';

test('scroll_by_pageup_down', async ({ page }) => {
    // 1. Setup Test Scenario
    // "creates a datatable of a fixed size" -> We use query params to config the app
    // Rows: 100, Cols: 20
    const rows = 100;
    const cols = 20;

    // Navigate to the test page
    console.log(`Navigating to test scenario: scroll_by_pageup_down, rows=${rows}, cols=${cols}`);
    await page.goto(`/?scenario=scroll_by_pageup_down&rows=${rows}&cols=${cols}`);

    // Wait for the grid container to be visible
    const grid = page.locator('#grid-container');
    await expect(grid).toBeVisible();

    // Focus the grid for keyboard navigation (we added tabindex="0")
    // Use .locator('[role="grid"]') which matches the inner scrollable div
    const scrollContainer = page.getByRole('grid');
    await scrollContainer.focus();

    // Define Layout Constants
    // From App.svelte CSS override:
    // Container: 800x600
    // Header Height: 50px
    // Row Height: 50px
    // Visible Body Height: 600 - 50 = 550px
    // Visible Rows: 550 / 50 = 11 rows.
    // Visible Cols: 800px width. Columns are 100px. 8 columns visible.

    const VISIBLE_ROWS_COUNT = 11;
    const VISIBLE_COLS_COUNT = 8;

    // Helper to verify corners
    // Corners logic defined by requirement: "visible cells in all four corners"
    // "Corners" relative to VIEWPORT.
    // Top-Left: First visible row, first visible col.
    // Top-Right: First visible row, last visible col.
    // Bottom-Left: Last visible row, first visible col.
    // Bottom-Right: Last visible row, last visible col.

    const verifyCorners = async (startRowIndex: number) => {
        // startRowIndex is the index of the row at the TOP of the viewport.
        const topRow = startRowIndex;
        const bottomRow = startRowIndex + VISIBLE_ROWS_COUNT - 1;

        const leftCol = 0;
        const rightCol = VISIBLE_COLS_COUNT - 1; // 7

        const topLeft = `R${topRow}C${leftCol}`;
        const topRight = `R${topRow}C${rightCol}`;
        const bottomLeft = `R${bottomRow}C${leftCol}`;
        const bottomRight = `R${bottomRow}C${rightCol}`;

        console.log(`Verifying corners for TopRow=${topRow}: ${topLeft}, ${topRight}, ${bottomLeft}, ${bottomRight}`);

        await expect(page.getByText(topLeft)).toBeVisible();
        await expect(page.getByText(topRight)).toBeVisible();
        await expect(page.getByText(bottomLeft)).toBeVisible();
        await expect(page.getByText(bottomRight)).toBeVisible();
    };

    const verifyActiveCell = async (expectedRowIndex: number, expectedColName: string) => {
        const activeCell = await page.evaluate(() => (window as any).getDataTableActiveCell());
        console.log(`Verifying Active Cell. Expected: [${expectedRowIndex}, ${expectedColName}]. Actual:`, activeCell);

        expect(activeCell).not.toBeNull();
        expect(activeCell.dataRowIndex).toBe(expectedRowIndex);
        expect(activeCell.dataColumnName).toBe(expectedColName);
        expect(activeCell.viewportRowIndex).toBeGreaterThanOrEqual(0);
        expect(activeCell.viewportRowIndex).toBeLessThan(VISIBLE_ROWS_COUNT + 5);
    };

    // --- STEP 1: Initial State (Top) ---
    // Start Row 0. Active Cell 0,0 ('col0').
    await verifyCorners(0);
    await verifyActiveCell(0, 'col0');

    // --- STEP 2: Scroll Page Down ---
    // Press PageDown ONCE.
    await scrollContainer.press('PageDown');
    await page.waitForTimeout(200);

    // PageDown moves active cell by ~visible rows (11).
    await verifyCorners(11);
    await verifyActiveCell(11, 'col0');

    // Now Scroll to End
    let currentTop = 11;
    let activeRow = 11;

    while (currentTop < 89 && activeRow < 99) {
        await scrollContainer.press('PageDown');
        currentTop += 11;
        activeRow += 11;

        if (activeRow > 99) activeRow = 99;
        if (currentTop > 89) currentTop = 89;

        await page.waitForTimeout(100);
    }

    // Verify End State
    await verifyCorners(89);
    await verifyActiveCell(99, 'col0');

    // --- STEP 3: Scroll Page Up to Top ---
    await scrollContainer.press('PageUp');
    await page.waitForTimeout(200);

    // active was 99. -11 = 88.
    // Top was 89. Scroll active to 88. 88 is above 89. 
    // Virtualizer scrollToIndex(88) will probably put 88 at top?
    // If so, Top Row becomes 88.
    await verifyCorners(88); // 88..98
    await verifyActiveCell(88, 'col0');

    // Loop up to top
    activeRow = 88;
    currentTop = 88;

    while (activeRow > 0) {
        await scrollContainer.press('PageUp');
        activeRow -= 11;
        if (activeRow < 0) activeRow = 0;

        currentTop = activeRow;

        await page.waitForTimeout(100);
    }

    // Verify Top State
    await verifyCorners(0);
    await verifyActiveCell(0, 'col0');
});
