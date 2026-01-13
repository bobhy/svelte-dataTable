
import type { SortKey, DataTableColumn } from '$lib/components/ui/datatable/DataTableTypes';

export class TestGridDataSource {
    rowCount: number;
    colCount: number;

    constructor(rowCount: number, colCount: number) {
        this.rowCount = rowCount;
        this.colCount = colCount;
    }

    async getRows(columns: string[], startRow: number, numRows: number, sortKeys: SortKey[], filters?: { global?: string }): Promise<any[]> {
        // Create an array of row indices
        let indices = Array.from({ length: this.rowCount }, (_, i) => i);

        // Filter if needed
        if (filters?.global) {
            const term = filters.global.toLowerCase();
            indices = indices.filter(idx => {
                // Check all requested columns for the term
                // Simulator shortcut:
                // We know row content is roughly "R{idx}C{colIndex}"
                // If we check if "R{idx}" or "C{col}" matches?
                // Better: construct a representative string "R{idx}C0 R{idx}C1 ... "
                // and check that.
                const content = Array.from({ length: this.colCount }, (_, c) => `R${idx}C${c}`).join(' ');
                return content.toLowerCase().includes(term);
            });
        }

        // Sort if needed
        // Sort if needed
        if (sortKeys && sortKeys.length > 0) {
            indices.sort((a, b) => {
                for (const { key, direction } of sortKeys) {
                    if (!key || key === 'none') continue;

                    const valA = this.getCellContent(a, key);
                    const valB = this.getCellContent(b, key);

                    if (valA < valB) return direction === 'asc' ? -1 : 1;
                    if (valA > valB) return direction === 'asc' ? 1 : -1;
                    // If equal, continue to next sort key
                }
                return 0;
            });
        }

        // Slice for pagination
        const slice = indices.slice(startRow, startRow + numRows);

        // Map to row objects
        return slice.map(rowIndex => {
            const row: any = { id: rowIndex };
            columns.forEach(colKey => {
                row[colKey] = this.getCellContent(rowIndex, colKey);
            });
            return row;
        });
    }

    getCellContent(rowIndex: number, colKey: string): string {
        // Expecting colKey like "col0", "col1"
        // Return format "R{rowIndex}C{colIndex}"
        // e.g. R0C0, R1C5
        const colPart = colKey.replace('col', '');
        return `R${rowIndex}C${colPart}`;
    }

    getColumns(): DataTableColumn[] {
        return Array.from({ length: this.colCount }, (_, i) => ({
            name: `col${i}`,
            title: `Column ${i}`,
            isSortable: true,
            // Fixed width helpful for layout tests
            width: 100
        }));
    }
}
