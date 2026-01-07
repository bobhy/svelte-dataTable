<script lang="ts">
	import {
		createTable,
		getCoreRowModel,
		FlexRender,
		type ColumnDef,
		type TableOptions,
        type Row,
        type SortingState
	} from '@tanstack/svelte-table';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import type { DataTableProps, DataTableConfig, DataTableColumn, SortKey } from './DataTableTypes';
	import { untrack } from 'svelte';
    import { cn } from '$lib/utils';
    import * as Dialog from '$lib/components/ui/dialog';
    import { ArrowUp, ArrowDown, ArrowUpDown } from '@lucide/svelte';
    import { get } from 'svelte/store';

	let { config, dataSource, onEdit, onSelection, class: className }: DataTableProps = $props();



    // -- State --
	let data = $state<any[]>([]);
    let hasMore = $state(true);
    let isLoading = $state(false);
	let sorting = $state<SortingState>([]);
    let columnSizing = $state({});
    let columnPinning = $state({ left: [], right: [] });
    let globalFilter = $state(""); 

    // Selection & Editing
    let selectedRowIndices = $state<Set<number>>(new Set());
    let lastSelectedIndex = $state<number | null>(null);
    let isEditOpen = $state(false);
    let editingRowData = $state<any>({}); 
    let editingRowIndex = $state<number|null>(null);

    // -- Columns --
    const columns = $derived(
        config.columns.map((col) => ({
            accessorKey: col.name,
            header: col.title || col.name,
            enableSorting: col.isSortable ?? false,
            enableResizing: true, 
            size: col.maxWidth ?? 150, 
            meta: { config: col },
            cell: (info: any) => {
                const val = info.getValue();
                if (col.formatter) return col.formatter(val);
                return val;
            }
        } as ColumnDef<any>))
    );

    // -- Table Instance --
	const options: TableOptions<any> = {
		get data() { return $state.snapshot(data); },
		get columns() { return columns; },
		getCoreRowModel: getCoreRowModel(),
        manualSorting: true, 
        manualPagination: true,
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        state: {
            get sorting() { return sorting; },
            get columnSizing() { return columnSizing; },
            get columnPinning() { return columnPinning; }
        },
        onSortingChange: (updater) => {
            if (typeof updater === 'function') sorting = updater(sorting);
            else sorting = updater;
        },
        onColumnSizingChange: (updater) => {
            if (typeof updater === 'function') columnSizing = updater(columnSizing);
            else columnSizing = updater;
        }
	};

    const table = createTable(options);

    // -- Sync State to Table --
    let uiRows = $state<Row<any>[]>([]);

    $effect(() => {
        const snapshot = $state.snapshot(data);
        const colState = columns;
        const sortState = sorting;
        const sizeState = columnSizing;
        const pinState = columnPinning;

        untrack(() => {
             table.setOptions({
                data: snapshot,
                columns: colState,
                getCoreRowModel: getCoreRowModel(),
                state: {
                    sorting: sortState,
                    columnSizing: sizeState,
                    columnPinning: pinState
                },
                enableColumnResizing: true
            });
            uiRows = table.getRowModel().rows;
        });
    });

    // -- Virtualization Setup --
    let tableContainer = $state<HTMLDivElement>();
    let headerContainer = $state<HTMLDivElement>();
    
    // 1. Create Virtualizer (can be created anytime)
    const rowVirtualizer = createVirtualizer({
        count: 0,
        getScrollElement: () => tableContainer || null,
        estimateSize: () => 40,
        overscan: 5
    });


    // 2. Sync Header Scroll
    $effect(() => {
        const tContainer = tableContainer;
        const hContainer = headerContainer;
        if (!tContainer || !hContainer) return;

        const handleScroll = () => {
             hContainer.scrollLeft = tContainer.scrollLeft;
        };

        tContainer.addEventListener('scroll', handleScroll);
        return () => tContainer.removeEventListener('scroll', handleScroll);
    });

    // 3. Update Virtualizer Options (Reactivity)
    $effect(() => {
        const len = data.length;
        const more = hasMore;
        const tContainer = tableContainer;
        
        if (!tContainer) return;

        untrack(() => {
             const instance = get(rowVirtualizer);
             instance.setOptions({
                 count: more ? len + 1 : len,
                 getScrollElement: () => tContainer,
                 estimateSize: () => 40,
                 overscan: 5
             });
        });
    });
    
    // -- Data Fetching --
    let backendFetchedCount = $state(0);
    
    async function performFetch(wantedGridRows: number) {
        if (isLoading || !hasMore) return;
        isLoading = true;
        try {
            const cols = [config.keyColumn, ...config.columns.map(c => c.name)];
            const sortKeys: SortKey[] = sorting.map(s => ({ key: s.id, direction: s.desc ? 'desc' : 'asc' }));
            const newRawRows = await dataSource(cols, backendFetchedCount, 100, sortKeys);
            
            if (newRawRows.length < 100) hasMore = false;
            backendFetchedCount += newRawRows.length;
            
            data = [...data, ...newRawRows];
        } catch (e) {
             console.error("Fetch error", e);
        } finally {
            isLoading = false;
        }
    }

    // Scroll Reach End Detection
    $effect(() => {
        // Access store reactively to trigger on scroll/update
        const virtualItems = $rowVirtualizer.getVirtualItems(); 
        const dLen = data.length;
        const more = hasMore;
        const loading = isLoading;

        if (dLen === 0 && more && !loading) {
            untrack(() => performFetch(50));
            return;
        }

        if (virtualItems.length > 0) {
            const last = virtualItems[virtualItems.length - 1];
            if (last.index >= dLen - 1 && more && !loading) {
                 untrack(() => performFetch(50));
            }
        }
    });

    // Helpers
     function getCellStyles(colConfig: DataTableColumn) {
        let classes = "";
        if (colConfig.justify === 'center') classes += " text-center";
        else if (colConfig.justify === 'right') classes += " text-right";
        else classes += " text-left";
        return classes + " truncate whitespace-nowrap";
    }

</script>

<div class={cn("flex flex-col h-full w-full border rounded-md overflow-hidden bg-background", className)}>
    <!-- Header -->
    <div bind:this={headerContainer} class="flex-none border-b bg-muted/40 font-medium text-sm overflow-x-auto" style="scrollbar-width: none;">
        <div class="flex w-full min-w-max">
             {#each table.getHeaderGroups() as headerGroup}
                {#each headerGroup.headers as header}
                    <div class="px-4 py-3 text-left font-medium flex items-center gap-1 border-r border-transparent hover:border-border/50" 
                         style="width: {header.getSize()}px;">
                        {#if !header.isPlaceholder}
                            <button type="button" class="truncate w-full text-left" onclick={header.column.getToggleSortingHandler()}>
                                <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                            </button>
                            <div 
                                class="w-1 h-full cursor-col-resize hover:bg-primary"
                                role="separator"
                                onmousedown={header.getResizeHandler()}
                                ontouchstart={header.getResizeHandler()}
                            ></div>
                        {/if}
                    </div>
                {/each}
             {/each}
        </div>
    </div>
    
    <!-- Virtual Body -->
    <div 
        bind:this={tableContainer} 
        class="flex-1 overflow-auto w-full relative outline-none focus:ring-2 focus:ring-primary/20"
        role="grid"
        tabindex="0"
    >
        <div style="height: {$rowVirtualizer.getTotalSize()}px; width: 100%; position: relative;" role="rowgroup">
            {#each $rowVirtualizer.getVirtualItems() as virtualRow (virtualRow.index)}
                {@const row = uiRows[virtualRow.index]}
                <div
                    class="absolute top-0 left-0 w-full flex min-w-max border-b bg-background hover:bg-muted/50 transition-colors"
                    style="transform: translateY({virtualRow.start}px); height: {virtualRow.size}px;"
                    role="row"
                >
                     {#if row}
                        {#each row.getVisibleCells() as cell}
                            {@const colConfig = (cell.column.columnDef.meta as any)?.config as DataTableColumn}
                            <div 
                                class={cn("px-4 py-2 text-sm flex items-center border-r border-transparent", colConfig ? getCellStyles(colConfig) : "")}
                                style="width: {cell.column.getSize()}px;"
                                role="gridcell"
                            >
                                <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                            </div>
                        {/each}
                     {:else}
                         <div class="w-full h-full flex items-center justify-center text-xs text-muted-foreground" role="status">
                             Loading...
                         </div>
                     {/if}
                </div>
            {/each}
        </div>
    </div>
    
    <div class="flex-none border-t bg-muted/40 p-2 text-xs">
        {data.length} rows loaded. {isLoading ? '(Fetching)' : ''}
    </div>
</div>
