
import { describe, it, expect } from 'vitest';
import { TestGridDataSource } from './TestGridDataSource.ts';

describe('TestGridDataSource', () => {
    it('should generate correct number of columns', () => {
        const ds = new TestGridDataSource(100, 5);
        const cols = ds.getColumns();
        expect(cols.length).toBe(5);
        expect(cols[0].name).toBe('col0');
        expect(cols[4].name).toBe('col4');
    });

    it('should return correct row content', async () => {
        const ds = new TestGridDataSource(10, 3);
        const rows = await ds.getRows(['col0', 'col1'], 0, 1, []);
        expect(rows.length).toBe(1);
        expect(rows[0].id).toBe(0);
        expect(rows[0].col0).toBe('R0C0');
        expect(rows[0].col1).toBe('R0C1');
    });

    it('should handle pagination', async () => {
        const ds = new TestGridDataSource(10, 3);
        const rows = await ds.getRows(['col0'], 5, 2, []);
        expect(rows.length).toBe(2);
        expect(rows[0].col0).toBe('R5C0');
        expect(rows[1].col0).toBe('R6C0');
    });

    it('should handle sorting ascending', async () => {
        // String sorting: "R0.." < "R10.." < "R1C.."
        const ds = new TestGridDataSource(15, 1);
        const rows = await ds.getRows(['col0'], 0, 15, [{ key: 'col0', direction: 'asc' }]);

        // Expected order: R0C0, R10C0, R11C0, ... R14C0, R1C0, R2C0...
        // Index 0: R0C0
        // Index 1: R10C0
        // ...
        // Index 6: R14C0
        // Index 7: R1C0

        expect(rows[0].col0).toBe('R0C0');
        expect(rows[1].col0).toBe('R10C0');
        // R1C0 should come after R14C0
        // Sequence: R0, R10, R11, R12, R13, R14, R1C0 (no, R1C0 > R14 is false? '1' < '4'. 
        // Wait. R1C0 chars: R, 1, C, 0.
        // R14C0 chars: R, 1, 4, C, 0.
        // Third char: 'C' vs '4'.
        // '4' (52) < 'C' (67).
        // So R14C0 < R1C0.
        // Correct.
        expect(rows.find((r: any) => r.col0 === 'R1C0')).toBeTruthy();
    });

    it('should handle sorting descending', async () => {
        const ds = new TestGridDataSource(5, 1);
        // R0C0, R1C0, R2C0, R3C0, R4C0
        // Desc: R4C0, R3C0, ...
        const rows = await ds.getRows(['col0'], 0, 5, [{ key: 'col0', direction: 'desc' }]);
        expect(rows[0].col0).toBe('R4C0');
    });
});
