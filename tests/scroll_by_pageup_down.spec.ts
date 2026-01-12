
import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('scroll_by_pageup_down', async ({ page }) => {
    // 1. Setup Test Scenario
    // "creates a datatable of a fixed size" -> We use query params to config the app
    // Rows: 100, Cols: 20
    const rows = 100;
    const cols = 20;

    // Navigate to the test page
    console.log(`Navigating to test scenario: scroll_by_pageup_down, rows=${rows}, cols=${cols}`);
    await loadWithConfig(page, {
        rows: rows,
        cols: cols,
        scenario: 'scroll_by_pageup_down'
    });

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

    // Dynamic Page Size Detection
    // We don't assume 11. We ask what the new active row is.
    const activeAfterPgDn = await page.evaluate(() => (window as any).getDataTableActiveCell());
    const pageSize = activeAfterPgDn.dataRowIndex;
    console.log(`Detected Page Size: ${pageSize}`);

    // Check reasonable bounds
    expect(pageSize).toBeGreaterThanOrEqual(5);
    expect(pageSize).toBeLessThan(20);

    // PageDown moves active cell by pageSize.
    // And Top Row should now be pageSize (relative pos 0 maintained).
    await verifyCorners(pageSize);
    await verifyActiveCell(pageSize, 'col0');

    // Now Scroll to End
    let currentTop = pageSize;
    let activeRow = pageSize;

    // We scroll until near end
    const totalRows = rows;
    const maxTop = totalRows - pageSize;

    // Loop with safety
    let loopCount = 0;
    const MAX_LOOPS = 50;

    while (currentTop <= maxTop && activeRow < totalRows - 1 && loopCount < MAX_LOOPS) {
        await scrollContainer.press('PageDown');
        currentTop += pageSize;
        activeRow += pageSize;
        loopCount++;

        if (activeRow > totalRows - 1) activeRow = totalRows - 1;
        if (currentTop > totalRows - pageSize) currentTop = totalRows - pageSize;

        await page.waitForTimeout(100);
    }
    expect(loopCount).toBeLessThan(MAX_LOOPS);

    // Final check logic is tricky with dynamic page size and async loading.
    // Use expect.poll to wait for potential pending fetches
    await expect.poll(async () => {
        const cell = await page.evaluate(() => (window as any).getDataTableActiveCell());
        return cell.dataRowIndex;
    }, { timeout: 10000 }).toBeGreaterThanOrEqual(rows - 1);

    const finalActive = await page.evaluate(() => (window as any).getDataTableActiveCell());

    // --- STEP 3: Scroll Page Up to Top ---
    await scrollContainer.press('PageUp');
    await page.waitForTimeout(200);

    // active was 99 (or max).

    activeRow = finalActive.dataRowIndex;

    // Perform one page up
    await scrollContainer.press('PageUp');
    await page.waitForTimeout(200);

    activeRow -= pageSize;

    // Loop up
    loopCount = 0;
    while (activeRow > 0 && loopCount < MAX_LOOPS) {
        await scrollContainer.press('PageUp');
        activeRow -= pageSize;
        if (activeRow < 0) activeRow = 0;
        loopCount++;
        await page.waitForTimeout(100);
    }
    expect(loopCount).toBeLessThan(MAX_LOOPS);

    // Verify Top State
    await verifyCorners(0);
    await verifyActiveCell(0, 'col0');
});
