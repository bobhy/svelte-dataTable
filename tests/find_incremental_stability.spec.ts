import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('incremental find stays on current row if it still matches', async ({ page }) => {
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

    // 1. Type "C". 
    // All rows contain "C" (e.g. R0C0, R1C0...). 
    // Should match Row 0.
    await findInput.focus();
    await findInput.press('C');
    await page.waitForTimeout(300);

    let activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    expect(activeCellInfo.dataRowIndex).toBe(0);

    // 2. Type "0". Term becomes "C0".
    // Row 0 contains "C0" (R0C0).
    // Row 1 also contains "C0" (R1C0).
    // Row 2 also contains "C0" (R2C0).

    // OLD BEHAVIOR: Would search > 0, find Row 1, and jump.
    // NEW BEHAVIOR: Should search >= 0, find Row 0, and STAY.
    await findInput.press('0');
    await page.waitForTimeout(300);

    activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });

    // Verify it stayed at 0
    expect(activeCellInfo.dataRowIndex).toBe(0);

    // 3. Clear and try a case where it SHOULD jump
    await findInput.clear();
    await page.waitForTimeout(300); // Wait for clear to process

    // Type "R". Matches Row 0.
    await findInput.press('R');
    await page.waitForTimeout(300);

    activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    expect(activeCellInfo.dataRowIndex).toBe(0);

    // Type "1". Term "R1".
    // Row 0 is "R0...". Does NOT match "R1".
    // Row 1 starts with "R1...". Matches.
    // Should jump to Row 1.
    await findInput.press('1');
    await page.waitForTimeout(300);

    activeCellInfo = await page.evaluate(() => {
        return (window as any).getDataTableActiveCell();
    });
    expect(activeCellInfo.dataRowIndex).toBe(1);
});
