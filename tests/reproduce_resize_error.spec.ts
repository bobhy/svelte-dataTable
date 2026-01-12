import { test, expect } from '@playwright/test';
import { loadWithConfig } from './utils';

test('datatable should not throw ResizeObserver loop error on aggressive resize', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
        console.log(`[Page Error]: ${err.message}`);
        errors.push(err.message);
    });
    // Also catch console errors just in case
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`[Console Error]: ${msg.text()}`);
            if (msg.text().includes('ResizeObserver loop')) {
                errors.push(msg.text());
            }
        }
    });

    await page.setViewportSize({ width: 1280, height: 1200 });

    // Just a standard load is fine, the loop is external
    await loadWithConfig(page, {
        rows: 50,
        cols: 10
    });

    const gridContainer = page.locator('#grid-container');
    await expect(gridContainer).toBeVisible({ timeout: 15000 });

    // Aggressive resizing loop
    console.log('Starting aggressive resize...');
    for (let i = 0; i < 20; i++) {
        const width = 800 + (i % 2 === 0 ? 400 : -200);
        const height = 600 + (i % 2 === 0 ? 300 : -200);

        await page.evaluate(({ w, h }) => {
            const el = document.getElementById('grid-container');
            if (el) {
                el.style.width = `${w}px`;
                el.style.height = `${h}px`;
            }
        }, { w: width, h: height });

        // Small random delay to simulate human-ish but fast interaction
        await page.waitForTimeout(Math.random() * 50 + 20);
    }
    console.log('Finished aggressive resize.');

    // Check for errors
    const resizeObserverErrors = errors.filter(e => e.includes('ResizeObserver loop'));
    expect(resizeObserverErrors.length).toBe(0);
});
