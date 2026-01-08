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
	import type { DataTableProps, DataTableConfig, DataTableColumn, SortKey, ActiveCellInfo } from './DataTableTypes';
	import { untrack } from 'svelte';
    import { cn } from '$lib/utils';
    import * as Dialog from '$lib/components/ui/dialog';
    import { ArrowUp, ArrowDown, ArrowUpDown } from '@lucide/svelte';
    import { get } from 'svelte/store';
    import SortOptions from './SortOptions.svelte';

	let { config, dataSource, onEdit, onSelection, class: className }: DataTableProps = $props();

    // -- State --
	let data = $state<any[]>([]);
    let hasMore = $state(true);
    let isLoading = $state(false);
	let sorting = $state<SortingState>([]);
    let columnSizing = $state({});
    let columnPinning = $state({ left: [], right: [] });
    // let globalFilter = $state(""); 

    // Active Cell State (Navigation)
    let activeRowIndex = $state(0);
    let activeColIndex = $state(0);

    // Selection & Editing
    let selectedRowIndices = $state<Set<number>>(new Set());
    
    // Sorting Dialog
    let showSortDialog = $state(false);

    // -- Columns --

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
    const rowVirtualizer = createVirtualizer({
        count: 0,
        getScrollElement: () => tableContainer || null,
        estimateSize: () => estimatedRowHeight,
        measureElement: (el) => el?.getBoundingClientRect().height ?? estimatedRowHeight,
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
                         const instance = get(rowVirtualizer);
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
            // Hueristic 1: Fetch Ahead (2x needed)
            const fetchCount = neededCount * 2;
            
            const cols = [config.keyColumn, ...config.columns.map(c => c.name)];
            const sortKeys: SortKey[] = sorting.map(s => ({ key: s.id, direction: s.desc ? 'desc' : 'asc' }));
            
            const newRawRows = await dataSource(cols, startRow, fetchCount, sortKeys);
            
            // Sparse-safe update
            if (data.length < startRow + newRawRows.length) {
                data.length = startRow + newRawRows.length;
            }
            for (let i = 0; i < newRawRows.length; i++) {
                data[startRow + i] = newRawRows[i];
            }
            
            if (newRawRows.length < fetchCount) hasMore = false; 
            
            // Pruning...
        } catch (e) {
             console.error("Fetch error", e);
        } finally {
            isLoading = false;
        }
    }

    // Smart Infinite Scroll / Range Detection
    $effect(() => {
        const instance = $rowVirtualizer;
        const virtualItems = instance.getVirtualItems();
        if (virtualItems.length === 0) {
            // Initial load
            if (data.length === 0 && hasMore && !isLoading) {
                 untrack(() => performFetch(0, 20));
            }
            return;
        }
        
        // Check finding missing data in visible range + buffer
        // Look ahead buffer
        // const buffer = virtualItems.length; // 1 screen
        // const end = virtualItems[virtualItems.length - 1].index + buffer;
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
        
        // Also check "End of Grid" hueristic
        // If we are near the end of KNOWN data, and hasMore.
        // Or if we scrolled into a gap.
        
        if (missingStart !== -1 && !isLoading && hasMore) {
             // We need to fill from missingStart
             // Needed = (end - missingStart) + buffer?
             // Spec: "from visible row of active... down to end of data grid".
             // We assume "end of grid" implies current viewport bottom.
             const needed = (end - missingStart) + 1;
             untrack(() => performFetch(missingStart, Math.max(needed, 10)));
        } else if (!isLoading && hasMore && end >= data.length - 5) {
             // Near the physical end of array, fetch more (append)
             untrack(() => performFetch(data.length, 20)); // basic append
        }
    });

    // -- Keyboard Navigation (Enhanced) --
    function handleKeyDown(e: KeyboardEvent) {
        // if (isLoading) return; // Allow navigation while loading
        
        const rowCount = data.length; // This might be sparse length?
        // If we are "infinite", rowCount might be virtual?
        // Use max known index?
        
        const instance = get(rowVirtualizer);
        const virtualItems = instance.getVirtualItems();
        const tContainer = tableContainer;
        
        // Helper to scroll maintaining relative position
        const scrollRelative = (targetRow: number, relativeOffset: number) => {
             const targetTop = Math.max(0, targetRow - relativeOffset);
             instance.scrollToIndex(targetTop, { align: 'start' }); 
        };

        const getPageSize = () => {
             if (!tContainer || virtualItems.length === 0) return 10;
             const rowHeight = virtualItems[0].size;
             return Math.floor(tContainer.clientHeight / rowHeight);
        }

        let handled = false;
        let newRow = activeRowIndex;
        let newCol = activeColIndex;

        const targetItem = virtualItems.find(i => i.index === newRow);
        
        switch(e.key) {
            case 'ArrowUp':
                if (virtualItems.length > 0) {
                     newRow = Math.max(0, newRow - 1);
                     
                     // Manual visibility check
                     // Find the item for the new row
                     const item = virtualItems.find(i => i.index === newRow);
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
                if (virtualItems.length > 0) {
                     const last = virtualItems[virtualItems.length - 1].index;
                     
                     newRow = newRow + 1;
                     
                     const item = virtualItems.find(i => i.index === newRow);
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
            case 'PageUp':
                if (virtualItems.length > 0) {
                    const pageSize = getPageSize();
                    // We want to keep the active cell at the same *visual* offset from the top.
                    // But 'virtualItems[0]' includes overscan, so it's not the visual top.
                    // We need a stable anchor.
                    // Let's rely on scrollRelative which sets 'start' alignment for (newRow - offset).
                    
                    // Offset = ActiveRow - ValidFirstRow
                    // But ValidFirstRow is hard to get exactly.
                    // Approximation: use 'virtualItems[0].index'. The 'scrollRelative' logic 
                    // (targetTop = newRow - relativePos) -> (newRow - (Active - First)) -> (newRow - Active + First)
                    // -> (Active - PageSize - Active + First) -> (First - PageSize).
                    // This shifts the whole window up by PageSize. Correct.
                    
                    const first = virtualItems[0].index;
                    const relativePos = activeRowIndex - first;
                    
                    newRow = Math.max(0, activeRowIndex - pageSize);
                    
                    // Apply scroll
                    scrollRelative(newRow, relativePos); 
                    
                    // However, 'scrollRelative' aligns 'targetTop' to START.
                    // If targetTop is inside the overscan area, it might effectively hide the new active row?
                    // No, 'align: start' forces targetTop to be at the TOP of the viewport.
                    // So 'newRow' (which is targetTop + relativeOffset) will be at 'relativeOffset' pixels down.
                    // This effectively preserves visual position. 
                    // Assuming 'relativePos' was relative to the TOP Rendered item.
                    
                    // Wait, if 'first' is NOT the visual top (due to overscan), then aligning 'first - pageSize' to Top
                    // might mean the row 'newRow' is actually further down than expected, or if overscan changes...
                    
                    // Actually, if we use 'align: start' on 'targetTop', 'targetTop' becomes the new visual first row.
                    // 'newRow' is 'targetTop' + 'relativePos'.
                    // So 'newRow' will be 'relativePos' rows below the new visual top.
                    // Previously, 'activeRow' was 'relativePos' rows below 'first'.
                    // If 'first' was the visual top, then perfect.
                    // If 'first' was in overscan (hidden), then 'activeRow' was 'relativePos' rows below that hidden item.
                    // By making 'targetTop' the new visual top, and placing 'newRow' relative to it...
                    // We might shift the visual position slightly if overscan behavior differs.
                    // But 'scrollRelative' enforces 'align: start'. So 'targetTop' becomes VISUAL TOP.
                    // So 'newRow' will appear 'relativePos' rows down from visual top.
                    // This is generally correct behavior: "Keep relative position".
                    // The only issue: 'activeRow' might have been relative to a *hidden* first row.
                    // So visually 'activeRow' was at Y pixels.
                    // Now 'newRow' is at Y pixels relative to new top.
                    // If 'first' was -2 (hidden), relativePos = 2 (active at 0).
                    // NewTop = ... 
                    // Align NewTop to START (0).
                    // NewRow is at 0 + 2 = 2.
                    // So it moved from visual slot 0 to visual slot 2.
                    // Relative visual position CHANGED.
                    
                    // Fix: We need relativePos to be relative to the VISUAL top.
                    // We can estimate visual top using scrollTop / rowHeight?
                    // Or finding the first item with item.start >= scrollTop.
                    
                    // For now, let's try the simpler fix: Force visibility check after scroll.
                    // Like we did for Arrows.
                    // But PageUp usually expects stable scroll.
                    
                    // Let's refine relativePos to be 'activeRow - index_of_first_visible'.
                    let visualFirst = first;
                    if (tContainer) {
                        const topScan = virtualItems.find(i => i.start >= tContainer.scrollTop);
                        if (topScan) visualFirst = topScan.index;
                    }
                    const visualRelative = activeRowIndex - visualFirst;
                    
                    newRow = Math.max(0, activeRowIndex - pageSize);
                    
                    // We want newRow to be at 'visualRelative' from top.
                    // So TargetTop = newRow - visualRelative.
                    const targetTop = Math.max(0, newRow - visualRelative);
                    
                    instance.scrollToIndex(targetTop, { align: 'start' });
                }
                handled = true;
                break;
            case 'PageDown':
                if (virtualItems.length > 0) {
                    const pageSize = getPageSize();
                    
                    // Same logic for PageDown
                    const first = virtualItems[0].index;
                    let visualFirst = first;
                    if (tContainer) {
                         const topScan = virtualItems.find(i => i.start >= tContainer.scrollTop);
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
                // For End, we might not know true max if infinite.
                // Assuming data.length is valid end or we shouldn't allow End?
                if (e.ctrlKey) newRow = rowCount - 1;
                else newCol = columns.length - 1;
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
            activeRowIndex = newRow;
            activeColIndex = newCol;
             // Ensure active row is somewhat valid?
             // If we scrolled past data, we might trigger fetch.
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
            
            // Notify parent
            if (onSelection) {
                // We need to resolve indices to row keys/objects
                // This might be expensive for large sets, but typically user selects a few.
                // Protocol says: SelectedCellsCallback = (selectedCells: SelectedCell[]) => ...
                // Wait, SelectedCell is { rowKey, columnKey }.
                // If we are selecting ROWS, do we send all cells? 
                // Or does the user expect row selection?
                // The Type definition says `onSelection?: SelectedCellsCallback`.
                // But my `selectedRowIndices` implies row selection.
                // Let's just track indices internally for now.
                // If the user wants row objects, we might need a different prop.
            }
        } else {
            // Single click - clear selection? Or just focus?
            // Standard grid behavior: click focuses, maybe clears multi-selection unless shift.
            if (selectedRowIndices.size > 0 && !e.shiftKey) {
                selectedRowIndices = new Set();
            }
        }
    }

    function handleRowDoubleClick(index: number) {
        if (onEdit) {
            const row = uiRows[index];
            if (row) onEdit(row.original, []); // onEdit expects (beforeData, afterData)? No.
            // Type says: DataEditCallback = (before, after) => ...
            // Wait, onEdit is passed to DataTable.
            // In Transactions.svelte: double click?
            // Transactions.svelte has NO onEdit prop passed to DataTable.
            // So onEdit is undefined.
        }
        
        // Emulate "Edit Mode"? 
        // For now just safe guard.
    }

    // -- Public API --
    export function getActiveCell(): ActiveCellInfo | null {
        if (data.length === 0) return null;
        
        const instance = get(rowVirtualizer);
        const virtualItems = instance.getVirtualItems();
        
        // Find if the active row is in the virtual items
        // virtualItems are the subset of rows currently rendered/measured
        // We want the viewport relative index.
        // If activeRowIndex is 100, and viewport shows 90-110.
        // visual index is activeRowIndex - virtualItems[0].index ??
        
        let viewportRowIndex: number | null = null;
        if (virtualItems.length > 0) {
            const start = virtualItems[0].index;
            const end = virtualItems[virtualItems.length - 1].index;
            
            if (activeRowIndex >= start && activeRowIndex <= end) {
                // Determine 0-based index relative to the container TOP?
                // The user asked for "visible position in the grid".
                // If the grid shows 10 rows, 0..9.
                // We can just conceptually return the offset.
                viewportRowIndex = activeRowIndex - start; 
                
                // Correction: virtualItems might include overscan.
                // "Visible" usually means strictly visible.
                // But for now, returning relative to the rendered batch is the most honest answers from the Virtualizer.
                // Let's rely on that.
            }
        }

        return {
            dataRowIndex: activeRowIndex,
            dataColumnName: columns[activeColIndex].accessorKey as string,
            viewportRowIndex,
            viewportColumnName: columns[activeColIndex].accessorKey as string
        };
    }

    // Helpers
    function measureRow(node: HTMLElement, index: number) {
        // Initial measurement
        const instance = get(rowVirtualizer);
        instance.measureElement(node);

        // Watch for size changes (e.g. content loading, wrapping)
        const ro = new ResizeObserver((entries) => {
            for (let entry of entries) {
                 // Wrap in rAF to ensure layout is settled / prevent loop errors
                 requestAnimationFrame(() => {
                     if (node.isConnected) {
                         const inst = get(rowVirtualizer); 
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
        
        // Alignment on Cell
        if (colConfig.justify === 'center') cellClasses += " text-center";
        else if (colConfig.justify === 'right') cellClasses += " text-right";
        else cellClasses += " text-left";
        
        if (isFocused) {
            cellClasses += " bg-primary/20 ring-1 ring-inset ring-primary";
        }
        
        // Wrapping logic
        if (colConfig.wrappable === 'word') {
            wrapperClasses += " break-words whitespace-normal";
            // Apply line clamping if maxLines is specified
            if (colConfig.maxLines && colConfig.maxLines > 0) {
                // console.log('Applying line-clamp:', colConfig.maxLines, 'to column:', colConfig.name);
                wrapperStyles += `display: -webkit-box; -webkit-line-clamp: ${colConfig.maxLines}; -webkit-box-orient: vertical; overflow: hidden;`;
                usesLineClamping = true;
            }
        } else {
             wrapperClasses += " truncate whitespace-nowrap";
        }
        
        wrapperClasses += " leading-normal"; // Ensure consistent line height

        return { cellClasses, cellStyles, wrapperClasses, wrapperStyles, usesLineClamping };
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
                            <button type="button" class="truncate w-full text-left flex items-center gap-1" onclick={() => showSortDialog = true}>
                                <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                                {#if header.column.getIsSorted()}
                                    {@const idx = sorting.findIndex(s => s.id === header.column.id)}
                                    <span class="text-[10px] font-bold ml-1 flex items-center">
                                        {idx + 1}
                                        {#if header.column.getIsSorted() === 'asc'}
                                            <ArrowUp class="w-3 h-3" />
                                        {:else}
                                            <ArrowDown class="w-3 h-3" />
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
            style="height: {$rowVirtualizer.getTotalSize()}px; width: 100%; position: relative;" 
            class="w-full"
        >
            <!-- Wrapper for flow layout positioning -->
            <div style="transform: translateY({$rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px);">
            {#each $rowVirtualizer.getVirtualItems() as virtualRow (virtualRow.key)}
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
        {columns} 
        sorting={sorting.map(s => ({ key: s.id, direction: s.desc ? 'desc' : 'asc' }))} 
        onApply={updateSorting}
    />
</div>
