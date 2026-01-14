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
	import type { DataTableProps, DataTableConfig, DataTableColumn, SortKey, ActiveCellInfo, FindDirection, FindResult } from './DataTableTypes';
	import { untrack } from 'svelte';
    import { cn } from '$lib/utils';
    import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from '@lucide/svelte';
    import { get } from 'svelte/store';
    import SortOptions from './SortOptions.svelte';

	let { config, dataSource, onEdit, onSelection, onFind, class: className, globalFilter = $bindable(""), findTerm = $bindable("") }: DataTableProps = $props();

    // -- State --
	let data = $state<any[]>([]);
    let hasMore = $state(true);
    let isLoading = $state(false);
	let sorting = $state<SortingState>([]);
    let columnSizing = $state({});
    let columnPinning = $state({ left: [], right: [] });
    
    // Auto-refresh when criteria changes (Filter or Sort)
    let lastFilter = "";
    let lastSortJson = JSON.stringify([]);
    
    $effect(() => {
        const f = globalFilter;
        const s = sorting;
        const sJson = JSON.stringify(s);
        
        if (f !== lastFilter || sJson !== lastSortJson) {
            lastFilter = f;
            lastSortJson = sJson;
            
            // Reset and fetch
            untrack(() => {
                data = [];
                hasMore = true;
                isLoading = false;
                const instance = get(virtualizerStore);
                if (instance) instance.setOptions({ count: 0 });
                performFetch(0, 20);
            });
        }
    }); 

    // Active Cell State (Navigation)
    let activeRowIndex = $state(0);
    let activeColIndex = $state(0);

    // "Not Found" Notification State
    let notFoundVisible = $state(false);
    let notFoundPosition = $state({ x: 0, y: 0 });
    let notFoundSource = $state<'input' | 'prev' | 'next'>('input');
    let notFoundTimeout: ReturnType<typeof setTimeout> | null = null;
    let findInputElement = $state<HTMLInputElement>();
    let findPrevButton = $state<HTMLButtonElement>();
    let findNextButton = $state<HTMLButtonElement>();

    // Selection & Editing
    let selectedRowIndices = $state<Set<number>>(new Set());
    
    // Sorting Dialog
    let showSortDialog = $state(false);

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
                // Safety check for sparse data (pruned rows)
                if (val === undefined && !info.row.original) return '...'; 
                
                if (col.formatter) return col.formatter(val);
                return val;
            }
        } as ColumnDef<any>))
    );

    // Base estimated row height (should be conservative to avoid gaps)
    const estimatedRowHeight = 40;


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
                    ...table.getState(),
                    sorting: sortState,
                    columnSizing: sizeState,
                    columnPinning: pinState
                },
                enableColumnResizing: true
            });
            uiRows = table.getRowModel().rows;
        });
    });



    // Helper to sync Sort State (TanStack <-> Internal/UI)
    function updateSorting(newSortKeys: SortKey[]) {
        // Convert SortKey[] to SortingState
        const newSorting: SortingState = newSortKeys.map(k => ({
            id: k.key,
            desc: k.direction === 'desc'
        }));
        sorting = newSorting;
        
        // Trigger generic data refresh (clear cache due to sort change)
        data = []; // Clear data on sort change
        hasMore = true;
        // The effect monitoring virtualItems will trigger fetch
    }

    // -- Virtualization Setup --
    let tableContainer = $state<HTMLDivElement>();
    let headerContainer = $state<HTMLDivElement>();
    
    // 1. Create Virtualizer (can be created anytime)
    const virtualizerStore = createVirtualizer({
        count: 0,
        getScrollElement: () => tableContainer || null,
        estimateSize: () => estimatedRowHeight,
        measureElement: (el) => el?.getBoundingClientRect().height ?? estimatedRowHeight,
        overscan: 5
    });

    // Reactive state derived from virtualizer store
    let virtualItems = $state([]);
    let totalSize = $state(0);
    
    $effect(() => {
        const unsubscribe = virtualizerStore.subscribe(v => {
            const items = v.getVirtualItems();
            const size = v.getTotalSize();
            virtualItems = items;
            totalSize = size;
        });
        
        return () => unsubscribe();
    });

    // Monitor data changes (trigger reflow if needed, though virtualizer handles it)
    $effect(() => {
        const _ = data.length;
        // ensure dependency
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
        
        untrack(() => {
             const instance = get(virtualizerStore);
             instance.setOptions({
                 count: more ? len + 1 : len,
                 getScrollElement: () => tContainer || null,
                 estimateSize: () => estimatedRowHeight,
                 measureElement: (el) => el?.getBoundingClientRect().height ?? estimatedRowHeight,
                 overscan: 5
             });
        });
    });

    // 4. Handle Container Resize
    $effect(() => {
        const tContainer = tableContainer;
        if (!tContainer) return;

        let prevHeight = tContainer.clientHeight;
        let resizeTimeout: any;

        const ro = new ResizeObserver((entries) => {
             for (const entry of entries) {
                 const newHeight = entry.contentRect.height;
                 if (Math.abs(newHeight - prevHeight) > 1) { // Tolerance for sub-pixel
                     prevHeight = newHeight;
                     
                     // Debounce measurement to prevent ResizeObserver loop limit errors
                     if (resizeTimeout) clearTimeout(resizeTimeout);
                     resizeTimeout = setTimeout(() => {
                         const instance = get(virtualizerStore);
                         if (instance) instance.measure();
                     }, 20);
                 }
             }
        });

        ro.observe(tContainer);
        return () => ro.disconnect();
    });
    
    // -- Data Fetching (Smart Caching) --
    
    async function performFetch(startRow: number, neededCount: number) {
        if (isLoading || !hasMore) return;
        isLoading = true;
        try {
            // Heuristic 1: Fetch Ahead (2x needed)
            const fetchCount = neededCount * 2;
            
            const cols = [config.keyColumn, ...config.columns.map(c => c.name)];
            const sortKeys: SortKey[] = sorting.map(s => ({ key: s.id, direction: s.desc ? 'desc' : 'asc' }));
            
            // Remove filters from call
            const newRawRows = await dataSource(cols, startRow, fetchCount, sortKeys);
            
            // Sparse-safe update
            if (data.length < startRow + newRawRows.length) {
                data.length = startRow + newRawRows.length;
            }
            for (let i = 0; i < newRawRows.length; i++) {
                data[startRow + i] = newRawRows[i];
            }
            
            if (newRawRows.length < fetchCount) hasMore = false;
            
            // Immediately update virtualizer count to prevent race condition
            const instance = get(virtualizerStore);
            const newCount = hasMore ? data.length + 1 : data.length;
            instance.setOptions({
                count: newCount,
                getScrollElement: () => tableContainer || null,
                estimateSize: () => estimatedRowHeight,
                measureElement: (el) => el?.getBoundingClientRect().height ?? estimatedRowHeight,
                overscan: 5
            });
        } catch (e) {
             console.error("Fetch error", e);
        } finally {
            isLoading = false;
        }
    }

    // Smart Infinite Scroll / Range Detection
    $effect(() => {
        // check from state
        if (virtualItems.length === 0) {
            // Initial load
            if (data.length === 0 && hasMore && !isLoading) {
                 untrack(() => performFetch(0, 20));
            }
            return;
        }
        
        // Check finding missing data in visible range + buffer
        const start = virtualItems[0].index;
        const end = virtualItems[virtualItems.length - 1].index;
        
        // Check if we have data for visible items
        let missingStart = -1;
        
        // Iterate visible items to find gaps
        for (const item of virtualItems) {
            if (!data[item.index]) {
                missingStart = item.index;
                break;
            }
        }
        
        // Also check "End of Grid" heuristic
        if (missingStart !== -1 && !isLoading && hasMore) {
             const needed = (end - missingStart) + 1;
             untrack(() => performFetch(missingStart, Math.max(needed, 10)));
        } else if (!isLoading && hasMore && end >= data.length - 5) {
             // Near the physical end of array, fetch more (append)
             untrack(() => performFetch(data.length, 20)); // basic append
        }
    });

    // -- Keyboard Navigation (Enhanced) --
    function handleKeyDown(e: KeyboardEvent) {
        const rowCount = data.length; 
        
        const instance = get(virtualizerStore);
        // virtualItems is already available in state, but let's use the instance for consistency in this function scope
        // actually using the state `virtualItems` is safer visually.
        const items = virtualItems; 
        const tContainer = tableContainer;
        
        // Helper to scroll maintaining relative position
        const scrollRelative = (targetRow: number, relativeOffset: number) => {
             const targetTop = Math.max(0, targetRow - relativeOffset);
             instance.scrollToIndex(targetTop, { align: 'start' }); 
        };

        const getPageSize = () => {
             if (!tContainer || items.length === 0) return 10;
             const rowHeight = items[0].size;
             return Math.floor(tContainer.clientHeight / rowHeight);
        }

        let handled = false;
        let newRow = activeRowIndex;
        let newCol = activeColIndex;

        const targetItem = items.find(i => i.index === newRow);
        
        switch(e.key) {
            case 'ArrowUp':
                if (items.length > 0) {
                     newRow = Math.max(0, newRow - 1);
                     
                     // Manual visibility check
                     // Find the item for the new row
                     const item = items.find(i => i.index === newRow);
                     if (item && tContainer) {
                         const itemTop = item.start;
                         const itemBottom = item.start + item.size;
                         const scrollTop = tContainer.scrollTop;
                         const clientHeight = tContainer.clientHeight;
                         
                         // If "above" the visible area
                         if (itemTop < scrollTop) {
                             instance.scrollToIndex(newRow, { align: 'start' });
                         } 
                         // If "below" the visible area (rare for Up, but possible)
                         else if (itemBottom > scrollTop + clientHeight) {
                             instance.scrollToIndex(newRow, { align: 'end' });
                         }
                         // Else: fully visible. Do NOT scroll.
                     } else {
                         // Fallback if item is not rendered yet (e.g. rapid scrolling)
                         instance.scrollToIndex(newRow, { align: 'auto' });
                     }
                }
                handled = true;
                break;
            case 'ArrowDown':
                if (items.length > 0) {
                     const last = items[items.length - 1].index;
                     
                     newRow = newRow + 1;
                     
                     const item = items.find(i => i.index === newRow);
                     if (item && tContainer) {
                         const itemTop = item.start;
                         const itemBottom = item.start + item.size;
                         const scrollTop = tContainer.scrollTop;
                         const clientHeight = tContainer.clientHeight;
                         
                         if (itemBottom > scrollTop + clientHeight) {
                              instance.scrollToIndex(newRow, { align: 'end' });
                         } else if (itemTop < scrollTop) {
                              instance.scrollToIndex(newRow, { align: 'start' });
                         }
                     } else {
                         instance.scrollToIndex(newRow, { align: 'auto' });
                     }
                }
                handled = true;
                break;
            // PageUp/Down omitted for brevity but logic is same as before, using instance.scrollToIndex
             case 'PageUp':
                if (items.length > 0) {
                    const pageSize = getPageSize();
                    const first = items[0].index;
                    let visualFirst = first;
                    if (tContainer) {
                        const topScan = items.find(i => i.start >= tContainer.scrollTop);
                        if (topScan) visualFirst = topScan.index;
                    }
                    const visualRelative = activeRowIndex - visualFirst;
                    newRow = Math.max(0, activeRowIndex - pageSize);
                    const targetTop = Math.max(0, newRow - visualRelative);
                    instance.scrollToIndex(targetTop, { align: 'start' });
                }
                handled = true;
                break;
            case 'PageDown':
                if (items.length > 0) {
                    const pageSize = getPageSize();
                    const first = items[0].index;
                    let visualFirst = first;
                    if (tContainer) {
                         const topScan = items.find(i => i.start >= tContainer.scrollTop);
                         if (topScan) visualFirst = topScan.index;
                    }
                    const visualRelative = activeRowIndex - visualFirst;
                    const effectiveMax = hasMore ? data.length : data.length - 1;
                    newRow = Math.min(effectiveMax, activeRowIndex + pageSize);
                    const targetTop = Math.max(0, newRow - visualRelative);
                     instance.scrollToIndex(targetTop, { align: 'start' });
                }
                handled = true;
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, newCol - 1);
                handled = true;
                break;
            case 'ArrowRight':
                newCol = Math.min(columns.length - 1, newCol + 1);
                handled = true;
                break;
             case 'Home':
                if (e.ctrlKey) newRow = 0;
                else newCol = 0;
                handled = true;
                break;
            case 'End':
                if (e.ctrlKey) newRow = rowCount - 1;
                else newCol = columns.length - 1;
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
            activeRowIndex = newRow;
            activeColIndex = newCol;
        }
    }

    // -- Row Interaction --
    function handleRowClick(index: number, e: MouseEvent) {
        // Update active row for keyboard nav continuity
        activeRowIndex = index;

        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            const newSet = new Set(selectedRowIndices);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            selectedRowIndices = newSet;
            
            if (onSelection) {
                // Notify parent...
            }
        } else {
            if (selectedRowIndices.size > 0 && !e.shiftKey) {
                selectedRowIndices = new Set();
            }
        }
    }

    function handleRowDoubleClick(index: number) {
        if (onEdit) {
            const row = uiRows[index];
            if (row) onEdit(row.original, []); 
        }
    }

    // -- Public API --
    export function getActiveCell(): ActiveCellInfo | null {
        if (data.length === 0) return null;
        
        const items = virtualItems;
        
        let viewportRowIndex: number | null = null;
        if (items.length > 0) {
            const start = items[0].index;
            const end = items[items.length - 1].index;
            
            if (activeRowIndex >= start && activeRowIndex <= end) {
                viewportRowIndex = activeRowIndex - start; 
            }
        }

        return {
            dataRowIndex: activeRowIndex,
            dataColumnName: columns[activeColIndex].accessorKey as string,
            viewportRowIndex,
            viewportColumnName: columns[activeColIndex].accessorKey as string
        };
    }

    export function scrollToRow(index: number, columnName?: string) {
        // Update active row
        activeRowIndex = index;
        
        // Update active column if specified
        if (columnName) {
            const colIndex = columns.findIndex(col => col.accessorKey === columnName);
            if (colIndex !== -1) {
                activeColIndex = colIndex;
            }
        }
        
        // Scroll to it
        const instance = get(virtualizerStore);
        instance.scrollToIndex(index, { align: 'start' });
    }

    async function handleFind(direction: FindDirection, sourceElement?: HTMLElement, fromIndex?: number) {
        if (!onFind || !findTerm) return;
        
        // If fromIndex is provided, use it. Otherwise use activeRowIndex.
        // This allows searching from (activeRowIndex - 1) when typing to keep the current match.
        const startIndex = fromIndex !== undefined ? fromIndex : activeRowIndex;
        
        const result = await onFind(findTerm, direction, startIndex);
        
        // Handle different return types: FindResult object, number, or null
        if (result !== null && result !== undefined) {
            if (typeof result === 'number') {
                // Legacy: just a row index
                scrollToRow(result);
            } else {
                // FindResult object with rowIndex and optional columnName
                scrollToRow(result.rowIndex, result.columnName);
            }
        } else {
            // No match found - show notification
            showNotFoundNotification(sourceElement);
        }
    }

    function showNotFoundNotification(sourceElement?: HTMLElement) {
        // Clear any existing timeout
        if (notFoundTimeout) {
            clearTimeout(notFoundTimeout);
            notFoundTimeout = null;
        }

        if (sourceElement) {
            const rect = sourceElement.getBoundingClientRect();
            
            // Use viewport coordinates directly since we're positioning relative to viewport
            if (sourceElement.classList.contains('find-prev-btn') || sourceElement.classList.contains('find-next-btn')) {
                // Position above the button
                notFoundPosition = {
                    x: rect.left + rect.width / 2,
                    y: rect.top - 30  // Position above the button
                };
                notFoundSource = sourceElement.classList.contains('find-prev-btn') ? 'prev' : 'next';
            } else {
                // Position near the input field (bottom right)
                notFoundPosition = {
                    x: rect.right - 50,
                    y: rect.bottom + 10  // Position below the input
                };
                notFoundSource = 'input';
            }
        }

        notFoundVisible = true;

        // Auto-hide after 1 second with fade-out
        notFoundTimeout = setTimeout(() => {
            notFoundVisible = false;
            notFoundTimeout = null;
        }, 1000);
    }

    // Auto-search when findTerm changes
    let lastFindTerm = "";
    $effect(() => {
        const term = findTerm;
        if (term && term !== lastFindTerm && onFind) {
            lastFindTerm = term;
            // Trigger search from current position (forward)
            // Start from activeRowIndex - 1 so that the current row is checked first
            // (assuming onFind searches strictly after the given index)
            untrack(() => handleFind('next', findInputElement, activeRowIndex - 1));
        } else if (!term) {
            lastFindTerm = "";
        }
    });

    // Helpers
    function measureRow(node: HTMLElement, index: number) {
        // Initial measurement
        const instance = get(virtualizerStore); // Store access is fine for non-reactive measure
        instance.measureElement(node);

        // Watch for size changes (e.g. content loading, wrapping)
        const ro = new ResizeObserver((entries) => {
            for (let entry of entries) {
                 // Wrap in rAF to ensure layout is settled / prevent loop errors
                 requestAnimationFrame(() => {
                     if (node.isConnected) {
                         const inst = get(virtualizerStore); 
                         inst.measureElement(node);
                     }
                 });
            }
        });
        
        ro.observe(node);
        
        return {
            destroy() {
                ro.disconnect();
            }
        };
    }

     function getCellStyles(colConfig: DataTableColumn, isFocused: boolean): { cellClasses: string; cellStyles: string; wrapperClasses: string; wrapperStyles: string; usesLineClamping: boolean } {
        let cellClasses = "";
        let cellStyles = "";
        
        let wrapperClasses = "";
        let wrapperStyles = "";
        let usesLineClamping = false;
        
        if (colConfig.justify === 'center') cellClasses += " text-center justify-center";
        else if (colConfig.justify === 'right') cellClasses += " text-right justify-end";
        else cellClasses += " text-left justify-start";
        
        if (isFocused) {
            cellClasses += " bg-primary/20 ring-1 ring-inset ring-primary";
        }
        
        if (colConfig.wrappable === 'word') {
            wrapperClasses += " break-words whitespace-normal";
            if (colConfig.maxLines && colConfig.maxLines > 0) {
                wrapperStyles += `display: -webkit-box; -webkit-line-clamp: ${colConfig.maxLines}; -webkit-box-orient: vertical; overflow: hidden;`;
                usesLineClamping = true;
            }
        } else {
             wrapperClasses += " truncate whitespace-nowrap";
        }
        
        wrapperClasses += " leading-normal"; 

        return { cellClasses, cellStyles, wrapperClasses, wrapperStyles, usesLineClamping };
    }

</script>

<div class={cn("flex flex-col h-full w-full border rounded-md overflow-hidden bg-background relative", className)}>
    <!-- Toolbar -->
    {#if config.isFilterable || config.isFindable}
        <div class="flex-none p-2 border-b bg-muted/20 flex gap-2">
            {#if config.isFilterable}
                <input 
                    type="text" 
                    placeholder="Filter..." 
                    bind:value={globalFilter}
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-sm"
                />
            {/if}
            {#if config.isFindable}
                <div class="flex gap-1 items-center w-full max-w-sm">
                    <input 
                        bind:this={findInputElement}
                        type="text" 
                        placeholder="Find..." 
                        bind:value={findTerm}
                        onkeydown={(e) => {
                            if (e.key === 'Enter') handleFind(e.shiftKey ? 'previous' : 'next', e.currentTarget);
                        }}
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 find-input"
                    />
                    <button 
                        bind:this={findPrevButton}
                        class="p-2 hover:bg-muted rounded find-prev-btn" 
                        onclick={(e) => handleFind('previous', e.currentTarget)} 
                        title="Find Previous"
                    >
                        <ChevronUp class="w-4 h-4" />
                    </button>
                    <button 
                        bind:this={findNextButton}
                        class="p-2 hover:bg-muted rounded find-next-btn" 
                        onclick={(e) => handleFind('next', e.currentTarget)} 
                        title="Find Next"
                    >
                        <ChevronDown class="w-4 h-4" />
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Header -->
    <div bind:this={headerContainer} class="flex-none border-b bg-muted/40 font-medium text-sm overflow-x-auto" style="scrollbar-gutter: stable;">
        <div class="flex w-full min-w-max">
             {#each table.getHeaderGroups() as headerGroup}
                {#each headerGroup.headers as header}
                    <div class="px-4 py-3 text-left font-medium flex items-center gap-1 border-r border-transparent hover:border-border/50" 
                         style="width: {header.getSize()}px;">
                        {#if !header.isPlaceholder}
                            <button type="button" class="truncate w-full text-left flex items-center gap-1" onclick={() => showSortDialog = true}>
                                <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                                {#if sorting.find(s => s.id === header.column.id)}
                                    {@const sortState = sorting.find(s => s.id === header.column.id)}
                                    {@const idx = sorting.findIndex(s => s.id === header.column.id)}
                                    <span class="text-[10px] font-bold ml-1 flex items-center">
                                        {idx + 1}
                                        {#if sortState?.desc}
                                            <ArrowDown class="w-3 h-3" />
                                        {:else}
                                            <ArrowUp class="w-3 h-3" />
                                        {/if}
                                    </span>
                                {/if}
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
        style="scrollbar-gutter: stable;"
        role="grid"
        tabindex="0"
        onkeydown={handleKeyDown}
    >
        <div 
            style="height: {totalSize}px; width: 100%; position: relative;" 
            class="w-full"
        >
            <!-- Wrapper for flow layout positioning -->
            <div style="transform: translateY({virtualItems[0]?.start ?? 0}px);">
            {#each virtualItems as virtualRow (virtualRow.key)}
                <!-- Render the row -->
                 {@const row = uiRows[virtualRow.index]}
                 {#if row}
                    <!-- 
                        Row Container
                        Using normal flow (relative) instead of absolute positioning.
                        Letting the browser handle height accumulation to prevent overlap and RO loops.
                    -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div
                        data-index={virtualRow.index} 
                        use:measureRow={virtualRow.index}
                        class={cn("flex border-b w-full hover:bg-muted/50 transition-colors data-[state=selected]:bg-muted", 
                            activeRowIndex === virtualRow.index ? "bg-muted" : "")}
                        data-state={selectedRowIndices.has(virtualRow.index) ? "selected" : undefined}
                        role="row"
                        onclick={(e) => handleRowClick(virtualRow.index, e)}
                        ondblclick={() => handleRowDoubleClick(virtualRow.index)}
                    >
                        {#each row.getVisibleCells() as cell, cellIndex}
                            {@const colConfig = (cell.column.columnDef.meta as any)?.config as DataTableColumn}
                            {@const isFocused = virtualRow.index === activeRowIndex && cellIndex === activeColIndex}
                            {@const cellStyle = colConfig ? getCellStyles(colConfig, isFocused) : { cellClasses: "", cellStyles: "", wrapperClasses: "", wrapperStyles: "", usesLineClamping: false }}
                            <div 
                                class={cn("px-4 py-2 text-sm border-r border-transparent", cellStyle.usesLineClamping ? "" : "flex items-center", cellStyle.cellClasses)}
                                style="width: {cell.column.getSize()}px; {cellStyle.cellStyles}"
                                role="gridcell"
                            >
                                <div class={cellStyle.wrapperClasses} style={cellStyle.wrapperStyles}>
                                    <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                                </div>
                            </div>
                        {/each}
                    </div>
                     {:else}
                        <!-- Skeleton or placeholder if needed, though uiRows usually in sync -->
                     {/if}
            {/each}
            </div>
        </div>
    </div>
    
    <div class="flex-none border-t bg-muted/40 p-2 text-xs flex justify-between">
        <span>{Object.keys(data).length} rows cached. {isLoading ? '(Fetching)' : ''}</span>
        <span>Active: {activeRowIndex}, {activeColIndex}</span>
    </div>
    
    <SortOptions 
        bind:open={showSortDialog} 
        columns={config.columns}
        sorting={sorting.map(s => ({ key: s.id, direction: s.desc ? 'desc' : 'asc' }))} 
        onApply={updateSorting}
    />
    
    <!-- "Not Found" Notification -->
    {#if notFoundVisible}
        <div 
            class="fixed px-3 py-1.5 bg-destructive/90 text-destructive-foreground text-xs rounded-full shadow-lg pointer-events-none z-50 transition-opacity duration-300"
            style="left: {notFoundPosition.x}px; top: {notFoundPosition.y}px; transform: translate(-50%, 0);"
        >
            not found
        </div>
    {/if}
</div>
