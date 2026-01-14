<script lang="ts">
  import DataTable from '$lib/components/ui/datatable/DataTable.svelte';
  import type { DataTableConfig } from '$lib/components/ui/datatable/DataTableTypes';
  import { TestGridDataSource } from '$lib/utils/TestGridDataSource';
  import { onMount } from 'svelte';

  let config: DataTableConfig = $state({
    name: 'loading',
    keyColumn: 'id',
    columns: []
  });
  
  let dataSource: any = $state(() => Promise.resolve([]));
  let isReady = $state(false);
  let tableComponent: any = $state();
  
  // Test config injection interface
  interface TestConfig {
      config?: Partial<DataTableConfig>;
      rows?: number;
      cols?: number;
      scenario?: string;
  }

  onMount(() => {
    // Check for injected test configuration
    const testConfig = (window as any).__TEST_CONFIG__ as TestConfig | undefined;
    
    let rows = testConfig?.rows ?? 50;
    let cols = testConfig?.cols ?? 5;
    const scenario = testConfig?.scenario;

    // Fallback to URL params if no injected config (legacy support or manual debug)
    const params = new URLSearchParams(window.location.search);
    if (!testConfig) {
        if (params.get('scenario') === 'scroll_by_pageup_down') {
            rows = parseInt(params.get('rows') || '100');
            cols = parseInt(params.get('cols') || '20');
        }
    }

    const ds = new TestGridDataSource(rows, cols);
    const baseCols = ds.getColumns();

    let finalConfig: DataTableConfig = {
        name: 'test-grid',
        keyColumn: 'id',
        title: scenario ? `Test: ${scenario}` : 'PWTestApp',
        maxVisibleRows: 20,
        isFilterable: true,
        isFindable: true,
        columns: baseCols
    };

    // Apply overrides from test config
    if (testConfig?.config) {
        finalConfig = { ...finalConfig, ...testConfig.config };
        // If columns are provided in config, use them, otherwise default to DS columns
        if (testConfig.config.columns) {
            finalConfig.columns = testConfig.config.columns;
        }
    }

    config = finalConfig;
    dataSource = ds.getRows.bind(ds);
    isReady = true;

    // Expose API for testing
    (window as any).getDataTableActiveCell = () => {
        return tableComponent?.getActiveCell();
    };
  });
</script>

<div class="p-10 h-screen w-full flex flex-col gap-4">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">PWTestApp</h1>
    </div>
    
    {#if isReady}
        <div id="grid-container" class="h-[calc(100vh-100px)] w-full p-4 fixed-row-height">
            <DataTable 
                bind:this={tableComponent} 
                {config} 
                {dataSource}
                onFind={async (term, direction, currentIndex) => {
                    // Simple linear search through test data
                    const lowerTerm = term.toLowerCase();
                    const totalRows = (window as any).__TEST_CONFIG__?.rows ?? 50;
                    
                    if (direction === 'next') {
                        for (let i = currentIndex + 1; i < totalRows; i++) {
                            // Check if row contains the term (simplified search)
                            const rowText = `R${i}`;
                            if (rowText.toLowerCase().includes(lowerTerm)) {
                                return i;
                            }
                        }
                    } else {
                        for (let i = currentIndex - 1; i >= 0; i--) {
                            const rowText = `R${i}`;
                            if (rowText.toLowerCase().includes(lowerTerm)) {
                                return i;
                            }
                        }
                    }
                    return null;  // Not found
                }}
                class="h-full w-full" 
            />
        </div>
    {:else}
        <div>Loading...</div>
    {/if}
</div>

<style>
    :global(#grid-container.fixed-row-height th) {
        height: 50px !important;
        max-height: 50px !important;
        box-sizing: border-box;
    }
    :global(#grid-container.fixed-row-height td) {
        height: 50px !important;
        max-height: 50px !important;
        box-sizing: border-box;
        padding: 0 8px;
    }
</style>
