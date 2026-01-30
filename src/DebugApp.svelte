<script lang="ts">
    import DataTable from './lib/components/ui/datatable/DataTable.svelte';
    import type { DataTableConfig, DataSourceCallback } from './lib/components/ui/datatable/DataTableTypes.ts';

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

    const testData = generateData(500);

    const config: DataTableConfig = {
        name: 'debug-grid',
        keyColumn: 'id',
        title: 'Debug DataTable (Internal Logic)',
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

    const dataSource: DataSourceCallback = async (cols: string[], startRow: number, numRows: number, sortKeys: any[]) => {
        // Simple raw data source (No filtering here anymore!)
        await new Promise(resolve => setTimeout(resolve, 50));
        
        let processed = [...testData];
        if (sortKeys && sortKeys.length > 0) {
            const { key, direction } = sortKeys[0];
            const dir = direction === 'desc' ? -1 : 1;
            processed.sort((a, b) => {
                const aVal = a[key as keyof typeof a];
                const bVal = b[key as keyof typeof b];
                if (aVal < bVal) return -dir;
                if (aVal > bVal) return dir;
                return 0;
            });
        }
        
        return processed.slice(startRow, startRow + numRows);
    };

    let filterTerm = $state("");
    let findTerm = $state("");
</script>

<div class="min-h-screen bg-background p-8">
    <h1 class="text-2xl font-bold mb-4">DataTable Debug Page</h1>
    
    <div class="mb-4 p-4 bg-muted rounded-lg">
        <h2 class="font-semibold mb-2">Internalized Logic Test</h2>
        <p class="text-sm italic text-muted-foreground mb-2">Filtering, Finding, and Caching (Pruning) are now handled inside DataTable.</p>
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
        />
    </div>
</div>
