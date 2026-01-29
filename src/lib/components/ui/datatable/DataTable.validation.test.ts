import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import DataTable from './DataTable.svelte';
import type { DataTableConfig, DataSourceCallback } from './DataTableTypes.ts';

describe('DataTable - Validation and Enum Integration Tests', () => {
    let dataSourceMock: ReturnType<typeof vi.fn>;
    let config: DataTableConfig;
    let testData: any[];

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock ResizeObserver
        global.ResizeObserver = class ResizeObserver {
            callback: any;
            constructor(callback: any) {
                this.callback = callback;
            }
            observe(el: HTMLElement) {
                // Trigger callback with element dimensions asynchronously
                // This is crucial for virtualization to start in JSDOM
                Promise.resolve().then(() => {
                    this.callback([{
                        target: el,
                        contentRect: {
                            height: 500,
                            width: 1000
                        }
                    }]);
                });
            }
            unobserve = vi.fn();
            disconnect = vi.fn();
        };

        // Stub requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', (cb: any) => cb());

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

        testData = [
            { id: 1, name: 'Item 1', status: 'Active' },
            { id: 2, name: 'Item 2', status: 'Inactive' }
        ];

        dataSourceMock = vi.fn(async () => testData);

        config = {
            name: 'validation-test',
            keyColumn: 'id',
            isEditable: true,
            columns: [
                {
                    name: 'name',
                    title: 'Name',
                    validator: (val: any) => val?.length < 3 ? ['Name too short'] : []
                },
                {
                    name: 'status',
                    title: 'Status',
                    enumValues: () => ['Active', 'Inactive', 'Pending']
                }
            ],
            rowValidator: (row: any) => row.name === 'Error' ? ['Global error: Name cannot be Error'] : []
        };
    });

    it('should show field error on blur and clear on input', async () => {
        const onRowEdit = vi.fn().mockResolvedValue(true);
        render(DataTable, { config, dataSource: dataSourceMock as DataSourceCallback, onRowEdit });

        await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());

        // Wait for rows to be rendered by virtualizer
        const row = await screen.findByText('Item 1', {}, { timeout: 3000 });
        fireEvent.doubleClick(row);

        // Wait for dialog content to be visible
        const input = await screen.findByPlaceholderText('Name', {}, { timeout: 3000 });

        // Blur with invalid data
        fireEvent.input(input, { target: { value: 'Ab' } });
        fireEvent.blur(input);

        await waitFor(() => expect(screen.getByText('Name too short')).toBeTruthy());

        // Type valid data - error should clear on input
        fireEvent.input(input, { target: { value: 'Abc' } });
        await waitFor(() => expect(screen.queryByText('Name too short')).toBeNull());
    });

    it('should render a select for columns with enumValues', async () => {
        const onRowEdit = vi.fn().mockResolvedValue(true);
        render(DataTable, { config, dataSource: dataSourceMock as DataSourceCallback, onRowEdit });

        await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());

        const row = await screen.findByText('Item 1');
        fireEvent.doubleClick(row);

        // Find select by Label
        const select = await screen.findByLabelText(/Status/i, {}, { timeout: 3000 }) as HTMLSelectElement;

        expect(select).toBeTruthy();

        const options = Array.from(select.querySelectorAll('option'));
        expect(options.map(o => o.value)).toContain('Active');
        expect(options.map(o => o.value)).toContain('Inactive');
        expect(options.map(o => o.value)).toContain('Pending');
    });

    it('should call rowValidator on save and show global error', async () => {
        const onRowEdit = vi.fn().mockResolvedValue(true);
        render(DataTable, { config, dataSource: dataSourceMock as DataSourceCallback, onRowEdit });

        await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());

        const row = await screen.findByText('Item 1');
        fireEvent.doubleClick(row);

        const input = await screen.findByPlaceholderText('Name');
        fireEvent.input(input, { target: { value: 'Error' } });

        const saveBtn = await screen.findByText('Save Changes');
        fireEvent.click(saveBtn);

        await waitFor(() => expect(screen.getByText('Global error: Name cannot be Error')).toBeTruthy());
        expect(onRowEdit).not.toHaveBeenCalled();
    });

    it('should disable save buttons when errors exist', async () => {
        const onRowEdit = vi.fn().mockResolvedValue(true);
        render(DataTable, { config, dataSource: dataSourceMock as DataSourceCallback, onRowEdit });

        await waitFor(() => expect(dataSourceMock).toHaveBeenCalled());

        const row = await screen.findByText('Item 1');
        fireEvent.doubleClick(row);

        const input = await screen.findByPlaceholderText('Name');
        fireEvent.input(input, { target: { value: 'Ab' } });
        fireEvent.blur(input);

        await waitFor(() => {
            const saveBtn = screen.getByText('Save Changes') as HTMLButtonElement;
            const saveAsNewBtn = screen.getByText('Save as New') as HTMLButtonElement;
            expect(saveBtn.disabled).toBe(true);
            expect(saveAsNewBtn.disabled).toBe(true);
        });
    });
});


