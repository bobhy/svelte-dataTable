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
  let scenario = $state<string | null>(null);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    scenario = params.get('scenario');
    
    let rows = 50;
    let cols = 5;

    if (scenario === 'scroll_by_pageup_down') {
        rows = parseInt(params.get('rows') || '100');
        cols = parseInt(params.get('cols') || '20');
    }

    const ds = new TestGridDataSource(rows, cols);
    
    if (scenario === 'justification') {
        const baseCols = ds.getColumns();
        // Override columns for justification test
        config = {
            name: 'test-grid-justification',
            keyColumn: 'id',
            title: 'Test: Justification',
            maxVisibleRows: 20,
            isFilterable: true,
            isFindable: true,
            columns: [
                { ...baseCols[0], name: 'col_left', title: 'Left', justify: 'left' },
                { ...baseCols[1], name: 'col_center', title: 'Center', justify: 'center' },
                { ...baseCols[2], name: 'col_right', title: 'Right', justify: 'right' },
                ...baseCols.slice(3)
            ]
        };
    } else {
        config = {
            name: 'test-grid',
            keyColumn: 'id',
            title: scenario ? `Test: ${scenario}` : 'DataTable Example',
            maxVisibleRows: 20,
            isFilterable: true,
            isFindable: true,
            columns: ds.getColumns()
        };
    }
    
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
        <h1 class="text-2xl font-bold">DataTable Test Environment</h1>
        <button onclick={() => document.documentElement.classList.toggle('dark')} class="px-4 py-2 border rounded">
            Toggle Dark Mode
        </button>
    </div>
    
    {#if isReady}
        <!-- Fixed size container for predictable testing -->
        <!-- Mimic budgetTracker layout -->
        <div id="grid-container" class="h-[calc(100vh-100px)] w-full p-4 {scenario !== 'resize_loop' ? 'fixed-row-height' : ''}">
            <DataTable bind:this={tableComponent} {config} {dataSource} class="h-full w-full" />
        </div>
    {:else}
        <div>Loading...</div>
    {/if}
</div>

<style>
    /* Force predictable layout for tests */
    :global(#grid-container.fixed-row-height th) {
        height: 50px !important;
        max-height: 50px !important;
        box-sizing: border-box;
    }
    :global(#grid-container.fixed-row-height td) {
        height: 50px !important;
        max-height: 50px !important;
        box-sizing: border-box;
        padding: 0 8px; /* Reset padding to be safe */
    }
</style>
