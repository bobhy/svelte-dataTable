
import type { SortKey, DataTableColumn } from '$lib/components/ui/datatable/DataTableTypes';

export class TestGridDataSource {
    rowCount: number;
    colCount: number;

    constructor(rowCount: number, colCount: number) {
        this.rowCount = rowCount;
        this.colCount = colCount;
    }

    async getRows(columns: string[], startRow: number, numRows: number, sortKeys: SortKey[]): Promise<any[]> {
        // Create an array of row indices
        const indices = Array.from({ length: this.rowCount }, (_, i) => i);

        // Sort if needed
        if (sortKeys && sortKeys.length > 0) {
            const { key, direction } = sortKeys[0];
            indices.sort((a, b) => {
                const valA = this.getCellContent(a, key);
                const valB = this.getCellContent(b, key);

                // Natural sort might be better, but string sort is consistent for "R1C1"
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
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
