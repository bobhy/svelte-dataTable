<script lang="ts">
    import DataTable from './lib/components/ui/datatable/DataTable.svelte';
    import type { DataTableConfig, DataSourceCallback } from './lib/components/ui/datatable/DataTableTypes';

    // Simple test data source
    const generateData = (count: number) => {
        return Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            category: ['A', 'B', 'C'][i % 3],
            value: (i + 1) * 100,
            description: `This is a longer description for item ${i + 1} that might wrap if needed.`
        }));
    };

    const testData = generateData(50);

    const config: DataTableConfig = {
        name: 'debug-grid',
        keyColumn: 'id',
        title: 'Debug DataTable',
        maxVisibleRows: 20,
        isFilterable: true,
        isFindable: true,
        columns: [
            { name: 'id', title: 'ID', isSortable: true },
            { name: 'name', title: 'Name', isSortable: true },
            { name: 'category', title: 'Category', isSortable: true },
            { name: 'value', title: 'Value', isSortable: true },
            { name: 'description', title: 'Description', wrappable: 'word', maxLines: 2 }
        ]
    };

    // State to track current view params
    let currentSortKeys: any[] = [];
    let currentFilters: any = {};

    // Helper to get processed data
    const getProcessedData = (filters: any, sortKeys: any[]) => {
        let processed = [...testData];
        
        // Apply filtering
        if (filters?.global) {
            const term = filters.global.toLowerCase();
            processed = processed.filter(row => 
                Object.values(row).some(val => String(val).toLowerCase().includes(term))
            );
        }
        
        // Apply sorting
        if (sortKeys && sortKeys.length > 0) {
            const key = sortKeys[0].key;
            const dir = sortKeys[0].direction === 'desc' ? -1 : 1;
            processed.sort((a, b) => {
                const aVal = a[key as keyof typeof a];
                const bVal = b[key as keyof typeof b];
                if (aVal < bVal) return -dir;
                if (aVal > bVal) return dir;
                return 0;
            });
        }
        return processed;
    };

    const dataSource: DataSourceCallback = async (cols, startRow, numRows, sortKeys) => {
        // Capture current state
        currentSortKeys = sortKeys;
        currentFilters = { global: filterTerm };

        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const processed = getProcessedData(currentFilters, sortKeys);
        
        const result = processed.slice(startRow, startRow + numRows);
        return result;
    };

    let filterTerm = $state("");
    let findTerm = $state("");
    
    const handleFind = async (term: string, direction: 'next' | 'previous', currentIndex: number) => {
        const processed = getProcessedData(currentFilters, currentSortKeys);
        
        // Search in processed data
        const lowerTerm = term.toLowerCase();
        
        const findInRow = (index: number): string | null => {
            if (index < 0 || index >= processed.length) return null;
            const row = processed[index];
            
            // Search through all columns to find which one contains the match
            for (const [key, value] of Object.entries(row)) {
                if (String(value).toLowerCase().includes(lowerTerm)) {
                    return key;  // Return the column name
                }
            }
            return null;
        };
        
        if (direction === 'next') {
            for (let i = currentIndex + 1; i < processed.length; i++) {
                const columnName = findInRow(i);
                if (columnName) {
                    return { rowIndex: i, columnName };
                }
            }
        } else {
            for (let i = currentIndex - 1; i >= 0; i--) {
                const columnName = findInRow(i);
                if (columnName) {
                    return { rowIndex: i, columnName };
                }
            }
        }
        
        return null;
    };
</script>

<div class="min-h-screen bg-background p-8">
    <h1 class="text-2xl font-bold mb-4">DataTable Debug Page</h1>
    
    <div class="mb-4 p-4 bg-muted rounded-lg">
        <h2 class="font-semibold mb-2">Debug Info:</h2>
        <p class="text-sm">Filter: "{filterTerm}"</p>
        <p class="text-sm">Find: "{findTerm}"</p>
        <p class="text-sm">Total test data: {testData.length} rows</p>
    </div>

    <div class="h-[600px] border rounded-lg">
        <DataTable 
            {config} 
            {dataSource} 
            bind:globalFilter={filterTerm} 
            bind:findTerm={findTerm}
            onFind={handleFind}
        />
    </div>
</div>
