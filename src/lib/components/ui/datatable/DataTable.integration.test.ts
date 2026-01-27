// Integration tests for DataTable component (renamed from Datagrid)
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import DataTable from './DataTable.svelte';
import type { DataTableConfig, DataSourceCallback, SortKey } from './DataTableTypes.js';

describe('DataTable Component - Navigation and Filtering Integration Tests', () => {
    let dataSourceMock: ReturnType<typeof vi.fn>;
    let defaultConfig: DataTableConfig;
    let testData: any[];

    const testScenarios = [
        { name: 'Small dataset (5 rows)', rowCount: 5, maxVisibleRows: 20 },
        { name: 'Medium dataset (40 rows)', rowCount: 40, maxVisibleRows: 20 },
        { name: 'Large dataset (200 rows)', rowCount: 200, maxVisibleRows: 20 }
    ];

    function generateTestData(count: number) {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
            value: (i + 1) * 10,
            description: `Description for item ${i + 1}`
        }));
    }

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock ResizeObserver which is missing in jsdom
        global.ResizeObserver = class ResizeObserver {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        };

        // Mock HTMLElement dimensions for virtualization
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 500 });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1000 });
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });

        // Mock getBoundingClientRect for virtualizer measurements
        HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
            return {
                width: 1000,
                height: this.offsetHeight || 40,
                top: 0,
                left: 0,
                bottom: this.offsetHeight || 40,
                right: 1000,
                x: 0,
                y: 0,
                toJSON: () => { }
            };
        });

        defaultConfig = {
            name: 'test-grid',
            keyColumn: 'id',
            title: 'Test Grid',
            maxVisibleRows: 20,
            isFilterable: true,
            isFindable: true,
            columns: [
                { name: 'id', title: 'ID', isSortable: true },
                { name: 'name', title: 'Name', isSortable: true },
                { name: 'category', title: 'Category', isSortable: true },
                { name: 'value', title: 'Value', isSortable: true }
            ]
        };
    });

    describe.each(testScenarios)('$name', ({ rowCount, maxVisibleRows }) => {
        beforeEach(() => {
            testData = generateTestData(rowCount);
            defaultConfig.maxVisibleRows = maxVisibleRows;
            dataSourceMock = vi.fn(async (columnKeys, startRow, numRows, sortKeys) => {
                let data = [...testData];
                if (sortKeys && sortKeys.length > 0) {
                    const sortKey = sortKeys[0];
                    data.sort((a, b) => {
                        const aVal = a[sortKey.key];
                        const bVal = b[sortKey.key];
                        if (aVal < bVal) return sortKey.direction === 'asc' ? -1 : 1;
                        if (aVal > bVal) return sortKey.direction === 'asc' ? 1 : -1;
                        return 0;
                    });
                }
                return data.slice(startRow, startRow + numRows);
            });
        });

        it('should initialize and load data', async () => {
            const { container } = render(DataTable, { config: defaultConfig, dataSource: dataSourceMock });
            await waitFor(() => expect(dataSourceMock).toHaveBeenCalled(), { timeout: 2000 });
            const gridElement = container.querySelector('[role="grid"]');
            expect(gridElement).toBeTruthy();
        });

        // Filtering is currently not implemented in the component (no UI input).
        it.skip('should handle filtering', async () => {
            const user = (userEvent as any).setup();
            const { container } = render(DataTable, { config: defaultConfig, dataSource: dataSourceMock });
            await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());
            const initialCalls = dataSourceMock.mock.calls.length;
            const filterInput = container.querySelector('input[placeholder="Filter..."]');
            expect(filterInput).toBeTruthy();
            if (filterInput) await user.type(filterInput, 'Item 1');
            await waitFor(() => expect(dataSourceMock.mock.calls.length).toBeGreaterThan(initialCalls), { timeout: 2000 });
        });

        it('should handle find navigation', async () => {
            const user = (userEvent as any).setup();
            const onFind = vi.fn().mockResolvedValue(1); // Mock returning index 1
            const { container } = render(DataTable, { config: defaultConfig, dataSource: dataSourceMock, onFind, findTerm: 'Item' });

            const nextBtn = container.querySelector('button[title="Find Next"]');
            expect(nextBtn).toBeTruthy();
            if (nextBtn) await user.click(nextBtn);

            expect(onFind).toHaveBeenCalledWith('Item', 'next', expect.any(Number));
        });



        // Skipped: JSDOM doesn't support proper virtualization measurements needed for this test
        it.skip('should apply line clamping styles when maxLines is set', async () => {
            const configWithMaxLines = {
                ...defaultConfig,
                columns: [
                    ...defaultConfig.columns,
                    { name: 'description', title: 'Description', wrappable: 'word', maxLines: 2 }
                ]
            };
            const { container } = render(DataTable, { config: configWithMaxLines, dataSource: dataSourceMock });
            await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());

            // Find a cell in the description column (index 4)
            // Rows are in [role="rowgroup"] -> [role="row"] -> div[role="gridcell"]
            await waitFor(() => expect(container.querySelectorAll('[role="row"]').length).toBeGreaterThan(0));
            const rows = container.querySelectorAll('[role="row"]');
            expect(rows.length).toBeGreaterThan(0);

            const firstRow = rows[0];
            const cells = firstRow.querySelectorAll('[role="gridcell"]');
            expect(cells.length).toBe(5); // 4 default + 1 description

            const descCell = cells[4];
            // The styles are now on the inner div
            const innerWrapper = descCell.querySelector('div');
            expect(innerWrapper).toBeTruthy();

            // Check for styles on the inner wrapper
            const styleAttr = innerWrapper?.getAttribute('style') || "";
            expect(styleAttr).toContain('display: -webkit-box');
            expect(styleAttr).toContain('-webkit-line-clamp: 2');
            expect(styleAttr).toContain('overflow: hidden');

            // Also check class on inner wrapper
            expect(innerWrapper).toHaveClass('break-words', 'whitespace-normal');
        });

        // Additional tests (sorting, keyboard navigation, etc.) can be added similarly.
    });
});
