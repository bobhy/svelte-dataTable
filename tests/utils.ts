import { type Page } from '@playwright/test';

export interface TestConfig {
    config?: any; // Partial<DataTableConfig>
    rows?: number;
    cols?: number;
    latency?: number;
    scenario?: string;
}

export async function loadWithConfig(page: Page, config: TestConfig) {
    // We need to set the config BEFORE the app mounts or reads it.
    // Playwright's addInitScript runs before the page loads scripts.
    await page.addInitScript((c) => {
        (window as any).__TEST_CONFIG__ = c;
    }, config);

    await page.goto('/?test_app=true');
}
