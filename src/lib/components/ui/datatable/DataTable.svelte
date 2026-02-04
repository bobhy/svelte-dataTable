<script lang="ts">
    import {
        createTable,
        getCoreRowModel,
        FlexRender,
        type ColumnDef,
        type TableOptions,
        type Row,
        type SortingState,
    } from "@tanstack/svelte-table";
    import {
        createVirtualizer,
        type VirtualItem,
    } from "@tanstack/svelte-virtual";
    import {
        type DataTableProps,
        type DataTableConfig,
        type DataTableColumn,
        type SortKey,
        type ActiveCellInfo,
        DEFAULT_DATA_TABLE_COLUMN,
        DEFAULT_DATA_TABLE_CONFIG,
    } from "./DataTableTypes.ts";
    import { untrack } from "svelte";
    import { cn } from "$lib/utils.ts";
    import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from "@lucide/svelte";
    import { get } from "svelte/store";
    import SortOptions from "./SortOptions.svelte";
    import RowEditForm from "./RowEditForm.svelte";
    import type {
        RowEditCallback,
        RowAction,
        RowEditResult,
    } from "./DataTableTypes.ts";

    // search directions
    type FindDirection = "next" | "prev";

    let {
        config,
        dataSource,
        onRowEdit,
        class: className,
        filterTerm: filterTerm = $bindable(""),
        findTerm = $bindable(""),
    }: DataTableProps = $props();

    // -- Centralized Defaults --
    const actualConfig = $derived({ ...DEFAULT_DATA_TABLE_CONFIG, ...config });
    const actualColumns = $derived(
        actualConfig.columns.map((col) => ({
            ...DEFAULT_DATA_TABLE_COLUMN,
            ...col,
        })),
    );

    const PRUNED_ROW = { __pruned: true };

    // -- State --
    let rawCache = $state(new Map<number, any>());
    let matchedIndices = $state<number[]>([]);
    let data = $derived(
        matchedIndices.map((idx) => rawCache.get(idx) || PRUNED_ROW),
    );
    let backendOffset = $state(0); // Next raw index to fetch
    let backendHasMore = $state(true);
    let hasMore = $state(true); // Whether more matches are possible
    let isLoading = $state(false);
    let fetchErrorCount = $state(0);
    const MAX_FETCH_RETRIES = 10;
    let sorting = $state<SortingState>([]);
    let columnSizing = $state<Record<string, number>>({});
    let columnSizingInfo = $state<any>({});
    let columnPinning = $state({ left: [], right: [] });

    // Auto-refresh when criteria changes (Filter or Sort)
    let lastFilter = "";
    let lastSortJson = JSON.stringify([]);

    let fetchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        const f = filterTerm;
        const s = sorting;
        const sJson = JSON.stringify(s);

        if (f !== lastFilter || sJson !== lastSortJson) {
            const isFilterChange = f !== lastFilter;

            // Logic to execute the refresh
            const doRefresh = () => {
                lastFilter = f;
                lastSortJson = sJson;

                untrack(() => {
                    rawCache.clear();
                    matchedIndices = [];
                    backendOffset = 0;
                    backendHasMore = true;
                    hasMore = true;
                    isLoading = false;
                    fetchErrorCount = 0; // Reset error count on user interaction
                    const instance = get(virtualizerStore);
                    if (instance) instance.setOptions({ count: 0 });
                    performFetch(0, actualConfig.maxVisibleRows);
                });
            };

            if (isFilterChange) {
                // Debounce filter changes
                clearTimeout(fetchDebounceTimer);
                fetchDebounceTimer = setTimeout(doRefresh, 300);
            } else {
                // Immediate update for sort changes (and clear pending filter debounce if any)
                clearTimeout(fetchDebounceTimer);
                doRefresh();
            }
        }
    });

    // Active Cell State (Navigation)
    let activeRowIndex = $state(0);
    let activeColIndex = $state(0);

    // Auto-focus grid on mount so keyboard navigation works immediately
    $effect(() => {
        if (tableContainer) {
            tableContainer.focus();
        }
    });

    // "Not Found" Notification State
    let notFoundVisible = $state(false);
    let notFoundPosition = $state({ x: 0, y: 0 });
    let notFoundSource = $state<"input" | "prev" | "next">("input");
    let notFoundTimeout: ReturnType<typeof setTimeout> | null = null;
    let findInputElement = $state<HTMLInputElement>();
    let findPrevButton = $state<HTMLButtonElement>();
    let findNextButton = $state<HTMLButtonElement>();

    const CHAR_WIDTH_REM = 1; // 1rem approx width of 'M'

    // Selection & Editing
    let selectedRowIndices = $state<Set<number>>(new Set());

    // Sorting Dialog
    let showSortDialog = $state(false);

    // Row Editing
    let editingRow: any = $state(null);
    let isEditDialogOpen = $state(false);

    async function handleRowEdit(
        action: RowAction,
        formData: any,
        originalRow?: any,
        keyColumn?: string,
    ) {
        if (!onRowEdit) return { error: "No edit handler defined" };

        const result = await onRowEdit(
            action,
            formData,
            originalRow,
            keyColumn,
        );

        if (result === true) {
            const keyCol = actualConfig.keyColumn;
            const itemId = formData[keyCol];

            if (action === "delete") {
                const matchIdx = matchedIndices.findIndex(
                    (idx) => rawCache.get(idx)?.[keyCol] === itemId,
                );
                if (matchIdx !== -1) {
                    const rawIdx = matchedIndices[matchIdx];
                    matchedIndices.splice(matchIdx, 1);
                    rawCache.delete(rawIdx);
                    matchedIndices = [...matchedIndices];
                }
            } else if (action === "update") {
                for (const [rawIdx, row] of rawCache.entries()) {
                    if (row[keyCol] === itemId) {
                        rawCache.set(rawIdx, { ...row, ...formData });
                        break;
                    }
                }
                matchedIndices = [...matchedIndices];
            } else if (action === "create") {
                const localIdx = -1 - Date.now(); // Unique negative index
                rawCache.set(localIdx, formData);
                matchedIndices.unshift(localIdx);
                matchedIndices = [...matchedIndices];
            }
            return true;
        }
        return result;
    }

    // -- Columns --
    const columns = $derived(
        actualColumns.map(
            (col: DataTableColumn) =>
                ({
                    accessorKey: col.name,
                    header: col.title || col.name,
                    enableSorting: col.isSortable,
                    enableResizing: true,
                    // Use rem units for initial column width (assuming 1rem = 16px for the engine)
                    size: (col.maxChars || 20) * CHAR_WIDTH_REM * 16,
                    meta: { config: col },
                    cell: (info: any) => {
                        const val = info.getValue();
                        // Safety check for sparse data (pruned rows)
                        if (info.row.original.__pruned) return "...";

                        if (col.formatter) return col.formatter(val);
                        return val;
                    },
                }) as ColumnDef<any>,
        ),
    );

    // Base estimated row height (should be conservative to avoid gaps)
    const estimatedRowHeight = 40;

    // -- Table Instance --
    const options: TableOptions<any> = {
        get data() {
            return $state.snapshot(data);
        },
        get columns() {
            return columns;
        },
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true,
        manualPagination: true,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
        state: {
            get sorting() {
                return sorting;
            },
            get columnSizing() {
                return columnSizing;
            },
            get columnSizingInfo() {
                return columnSizingInfo;
            },
            get columnPinning() {
                return columnPinning;
            },
        },
        onSortingChange: (updater: any) => {
            if (typeof updater === "function") sorting = updater(sorting);
            else sorting = updater;
        },
        onColumnSizingInfoChange: (updater: any) => {
            if (typeof updater === "function")
                columnSizingInfo = updater(columnSizingInfo);
            else columnSizingInfo = updater;
        },
        onColumnSizingChange: (updater: any) => {
            let newVal;
            if (typeof updater === "function") newVal = updater(columnSizing);
            else newVal = updater;
            columnSizing = newVal;
        },
        filterFns: {},
        sortingFns: {},
        aggregationFns: {},
    };

    function getColumnWidth(id: string, sizing: any, defaultSize: number) {
        const w = sizing[id] ?? defaultSize;
        // console.log(`[WidthHelper] ${id} -> ${w}`);
        return w;
    }

    const table = createTable(options);

    // -- Sync State to Table --
    let uiRows = $state<Row<any>[]>([]);
    let headerGroups = $state(table.getHeaderGroups());

    $effect(() => {
        const snapshot = $state.snapshot(data);
        const colState = columns;
        const sortState = sorting;
        const sizeState = columnSizing;
        const pinState = columnPinning;

        untrack(() => {
            table.setOptions({
                ...options,
                onStateChange: () => {}, // Provide default to satisfy strict internal type
                data: snapshot,
                columns: colState,
                state: {
                    ...table.getState(),
                    sorting: sortState,
                    columnSizing: sizeState,
                    columnSizingInfo: columnSizingInfo, // Sync persistent state
                    columnPinning: pinState,
                },
            } as any);
            uiRows = table.getRowModel().rows;
            headerGroups = table.getHeaderGroups();
        });
    });

    // Helper to sync Sort State (TanStack <-> Internal/UI)
    function updateSorting(newSortKeys: SortKey[]) {
        // Convert SortKey[] to SortingState
        const newSorting: SortingState = newSortKeys.map((k) => ({
            id: k.key,
            desc: k.direction === "desc",
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
        measureElement: (el) =>
            el?.getBoundingClientRect().height ?? estimatedRowHeight,
        overscan: 5,
    });

    // Reactive state derived from virtualizer store
    let virtualItems = $state<VirtualItem[]>([]);
    let totalSize = $state(0);

    $effect(() => {
        const unsubscribe = virtualizerStore.subscribe((v) => {
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

        tContainer.addEventListener("scroll", handleScroll);
        return () => tContainer.removeEventListener("scroll", handleScroll);
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
                measureElement: (el) =>
                    el?.getBoundingClientRect().height ?? estimatedRowHeight,
                overscan: 5,
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
                if (Math.abs(newHeight - prevHeight) > 1) {
                    // Tolerance for sub-pixel
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

    async function performFetch(
        startMatchIndex: number,
        neededMatchCount: number,
    ) {
        if (isLoading) return;
        isLoading = true;
        try {
            const cols = [
                actualConfig.keyColumn,
                ...actualConfig.columns.map((c: any) => c.name),
            ];
            const sortKeys: SortKey[] = sorting.map((s) => ({
                key: s.id,
                direction: s.desc ? "desc" : "asc",
            }));

            const filterLower = (filterTerm || "").toLowerCase();
            const isMatch = (row: any) => {
                if (!filterLower) return true;
                return Object.values(row).some((v) =>
                    String(v).toLowerCase().includes(filterLower),
                );
            };

            // 1. Handle RE-FETCHING of pruned rows in requested range
            const requestedEnd = startMatchIndex + neededMatchCount;
            for (
                let i = startMatchIndex;
                i < Math.min(requestedEnd, matchedIndices.length);
                i++
            ) {
                const rawIdx = matchedIndices[i];
                if (rawIdx !== undefined && !rawCache.has(rawIdx)) {
                    // Missing due to pruning. Re-fetch a batch starting here.
                    const fetchStart = rawIdx;
                    const batchSize = Math.max(50, requestedEnd - i);
                    const batch = await dataSource(
                        cols,
                        fetchStart,
                        batchSize,
                        sortKeys,
                    );
                    if (batch && batch.length > 0) {
                        batch.forEach((r, idx) =>
                            rawCache.set(fetchStart + idx, r),
                        );
                        // Force reactivity
                        rawCache = new Map(rawCache);
                    } else {
                        backendHasMore = false;
                        break;
                    }
                }
            }

            // 2. Handle FETCHING NEW rows (Forward expansion)
            // Aggressively pre-fetch to tolerate network latency.
            // 300 rows buffer allows for significant lookahead.
            const matchesToFind = Math.max(neededMatchCount * 4, 300);
            const targetMatchCount = startMatchIndex + matchesToFind;

            const BATCH_SIZE = 100;
            const MAX_BATCHES_PER_CYCLE = 5; // Prevent indefinitely locking the UI
            let batchesFetched = 0;
            let consecutiveEmptyBatches = 0;

            while (
                matchedIndices.length < targetMatchCount &&
                backendHasMore &&
                consecutiveEmptyBatches < 3 &&
                batchesFetched < MAX_BATCHES_PER_CYCLE
            ) {
                // Safety timeout for data fetch
                const fetchPromise = dataSource(
                    cols,
                    backendOffset,
                    BATCH_SIZE,
                    sortKeys,
                );
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Fetch timeout")), 10000),
                );

                const batch = (await Promise.race([
                    fetchPromise,
                    timeoutPromise,
                ])) as any[];
                batchesFetched++;

                if (batch && batch.length > 0) {
                    // ... (omitted cache logic details for brevity, assume correct)
                    batch.forEach((row, idx) => {
                        const rawIdx = backendOffset + idx;
                        rawCache.set(rawIdx, row);
                        if (isMatch(row)) {
                            matchedIndices.push(rawIdx);
                        }
                    });

                    // Force reactivity for standard Map in Svelte 5 state
                    rawCache = new Map(rawCache);

                    backendOffset += batch.length;

                    // If we got data, assume there might be more unless explicitly empty next time
                } else {
                    consecutiveEmptyBatches++;
                    backendHasMore = false;
                }
            }

            if (!backendHasMore && matchedIndices.length < targetMatchCount) {
                hasMore = false;
            }

            fetchErrorCount = 0; // Success!

            // Debug: Log state after forward fetch

            // If we hit the batch limit but still have more to check, ensure we remain in a valid state
            // to cycle again (isLoading will clear in finally, triggering effects if still needed)

            // 3. Heuristic 2: Pruning (10 screens away)
            const pageSize = actualConfig.maxVisibleRows || 20;
            const threshold = pageSize * 10;

            const keepIndices = new Set<number>();
            const startRange = Math.max(0, activeRowIndex - threshold);
            // Extend endRange to cover any virtual items that might be visible
            // (the virtualizer might render beyond activeRowIndex + threshold if user scrolled quickly)
            const instance = get(virtualizerStore);
            const virtualItems = instance ? instance.getVirtualItems() : [];
            let maxVirtualIndex = activeRowIndex;
            if (virtualItems.length > 0) {
                maxVirtualIndex = Math.max(...virtualItems.map((v) => v.index));
            }
            // Keep rows from startRange to max(activeRowIndex + threshold, maxVirtualIndex + buffer)
            const endRange = Math.min(
                matchedIndices.length,
                Math.max(activeRowIndex + threshold, maxVirtualIndex + 50),
            );
            for (let i = startRange; i < endRange; i++) {
                keepIndices.add(matchedIndices[i]);
            }

            for (const key of rawCache.keys()) {
                if (!keepIndices.has(key)) {
                    rawCache.delete(key);
                }
            }

            // Debug: Log pruning info

            matchedIndices = [...matchedIndices];

            // Reuse instance from pruning calculation above
            if (instance) {
                const totalCount = hasMore
                    ? matchedIndices.length + 1
                    : matchedIndices.length;
                instance.setOptions({ ...instance.options, count: totalCount });
                // Force a measure/re-render for the virtualizer
                instance.measure();
            }
        } catch (e) {
            console.error("Internal fetch error:", e);
            fetchErrorCount++;
            if (fetchErrorCount >= MAX_FETCH_RETRIES) {
                console.error(
                    `DataTable: Max fetch retries (${MAX_FETCH_RETRIES}) reached. Stopping automatic fetches to prevent infinite loop.`,
                );
            }
        } finally {
            // Log unconditionally for debug
            const lastIdx =
                matchedIndices.length > 0
                    ? matchedIndices[matchedIndices.length - 1]
                    : -1;
            const hasLast = rawCache.has(lastIdx);

            isLoading = false;

            // Burst-process pending navigations until we hit the data limit
            while (pendingNavigationQueue.length > 0) {
                const startRow = activeRowIndex;
                const nav = pendingNavigationQueue[0]; // Peek

                performNavigation(nav.key, nav.ctrlKey);

                // If we didn't move
                if (
                    activeRowIndex === startRow &&
                    ["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(
                        nav.key,
                    )
                ) {
                    break;
                }

                // Consumed successfully
                pendingNavigationQueue.shift();
            }
        }
    }

    // Smart Infinite Scroll / Range Detection
    $effect(() => {
        if (matchedIndices.length === 0) {
            // Initial load
            if (hasMore && !isLoading) {
                untrack(() =>
                    performFetch(0, actualConfig.maxVisibleRows || 20),
                );
            }
            return;
        }

        // Check for missing data in visible range (due to pruning or incomplete fill)
        const start = virtualItems[0]?.index ?? 0;
        const end = virtualItems[virtualItems.length - 1]?.index ?? 0;

        let missingStart = -1;
        for (const item of virtualItems) {
            const rawIdx = matchedIndices[item.index];
            if (rawIdx === undefined || !rawCache.has(rawIdx)) {
                missingStart = item.index;
                break;
            }
        }

        if (
            missingStart !== -1 &&
            !isLoading &&
            fetchErrorCount < MAX_FETCH_RETRIES
        ) {
            // Re-fetch missing data (could be pruned or never fetched)
            // This must work even when hasMore=false for end-of-data scenarios

            const needed = end - missingStart + 1;
            untrack(() => performFetch(missingStart, Math.max(needed, 10)));
        } else if (
            !isLoading &&
            hasMore &&
            end >= matchedIndices.length - 100 &&
            fetchErrorCount < MAX_FETCH_RETRIES
        ) {
            // Pre-fetch new data if approaching end
            // console.log(`[Effect] Near end. calling performFetch`);
            untrack(() => performFetch(matchedIndices.length, 20));
        }
    });

    // State for pending navigation during async operations or rendering
    let pendingNavigationQueue: { key: string; ctrlKey: boolean }[] = [];
    let isNavigating = $state(false); // Local flag to track navigation "busy" state beyond just isLoading

    function performNavigation(key: string, ctrlKey: boolean) {
        const rowCount = data.length;
        const instance = get(virtualizerStore);
        const items = virtualItems;
        const tContainer = tableContainer;

        const getPageSize = () => {
            if (!tContainer || items.length === 0) return 10;
            const rowHeight = items[0].size;
            return Math.floor(tContainer.clientHeight / rowHeight);
        };

        let handled = false;
        let newRow = activeRowIndex;
        let newCol = activeColIndex;

        // Reset editing state if moving
        if (key !== "Enter" && isEditDialogOpen) {
            isEditDialogOpen = false;
        }

        switch (key) {
            case "Enter":
                if (config.isEditable && items.length > 0) {
                    const row = uiRows[activeRowIndex];
                    if (row) {
                        editingRow = row.original;
                        isEditDialogOpen = true;
                    }
                }
                handled = true;
                break;
            case "ArrowUp":
                if (items.length > 0) {
                    newRow = Math.max(0, newRow - 1);

                    // Manual visibility check
                    const item = items.find((i) => i.index === newRow);
                    if (item && tContainer) {
                        const itemTop = item.start;
                        const itemBottom = item.start + item.size;
                        const scrollTop = tContainer.scrollTop;
                        const clientHeight = tContainer.clientHeight;

                        if (itemTop < scrollTop) {
                            instance.scrollToIndex(newRow, { align: "start" });
                        } else if (itemBottom > scrollTop + clientHeight) {
                            instance.scrollToIndex(newRow, { align: "end" });
                        }
                    } else {
                        instance.scrollToIndex(newRow, { align: "auto" });
                    }
                }
                handled = true;
                break;
            case "ArrowDown":
                if (items.length > 0) {
                    const effectiveMax = hasMore
                        ? data.length
                        : data.length - 1;
                    newRow = Math.min(effectiveMax, newRow + 1);

                    const item = items.find((i) => i.index === newRow);
                    if (item && tContainer) {
                        const itemTop = item.start;
                        const itemBottom = item.start + item.size;
                        const scrollTop = tContainer.scrollTop;
                        const clientHeight = tContainer.clientHeight;

                        if (itemBottom > scrollTop + clientHeight) {
                            instance.scrollToIndex(newRow, { align: "end" });
                        } else if (itemTop < scrollTop) {
                            instance.scrollToIndex(newRow, { align: "start" });
                        }
                    } else {
                        instance.scrollToIndex(newRow, { align: "auto" });
                    }
                }
                handled = true;
                break;
            case "PageUp":
                if (items.length > 0) {
                    const pageSize = getPageSize();
                    newRow = Math.max(0, activeRowIndex - pageSize);
                    instance.scrollToIndex(newRow, { align: "start" });
                }
                handled = true;
                break;
            case "PageDown":
                if (items.length > 0) {
                    const pageSize = getPageSize();
                    const effectiveMax = hasMore
                        ? data.length
                        : data.length - 1;
                    newRow = Math.min(effectiveMax, activeRowIndex + pageSize);
                    instance.scrollToIndex(newRow, { align: "start" });
                }
                handled = true;
                break;
            case "ArrowLeft":
                newCol = Math.max(0, newCol - 1);
                handled = true;
                break;
            case "ArrowRight":
                newCol = Math.min(columns.length - 1, newCol + 1);
                handled = true;
                break;
            case "Home":
                if (ctrlKey) newRow = 0;
                else newCol = 0;
                handled = true;
                break;
            case "End":
                if (ctrlKey) newRow = rowCount - 1;
                else newCol = columns.length - 1;
                handled = true;
                break;
        }

        if (handled) {
            activeRowIndex = newRow;
            activeColIndex = newCol;
        }
    }

    // -- Keyboard Navigation (Enhanced) --
    function handleKeyDown(e: KeyboardEvent) {
        if (
            [
                "Enter",
                "ArrowUp",
                "ArrowDown",
                "PageUp",
                "PageDown",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
            ].includes(e.key)
        ) {
            e.preventDefault();

            // If busy, queue the key
            if (isLoading) {
                pendingNavigationQueue.push({ key: e.key, ctrlKey: e.ctrlKey });
                return;
            }

            performNavigation(e.key, e.ctrlKey);
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

            // todo notify parent when cell(s) selected
        } else {
            if (selectedRowIndices.size > 0 && !e.shiftKey) {
                selectedRowIndices = new Set();
            }
        }
    }

    function handleRowDoubleClick(index: number) {
        if (onRowEdit && config.isEditable) {
            const row = uiRows[index];
            if (row) {
                editingRow = row.original;
                isEditDialogOpen = true;
            }
        }
    }

    // Doc for this public interface moved to DataTableTypes.ts due to lack of tsdoc extractor for svelte components.
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
            dataColumnName: (columns[activeColIndex] as any)
                .accessorKey as string,
            viewportRowIndex,
        };
    }

    // Doc for this public interface moved to DataTableTypes.ts due to lack of tsdoc extractor for svelte components.
    export function scrollToRow(index: number, columnName?: string) {
        // Update active row
        activeRowIndex = index;

        // Update active column if specified
        if (columnName) {
            const colIndex = columns.findIndex(
                (col: any) => col.accessorKey === columnName,
            );
            if (colIndex !== -1) {
                activeColIndex = colIndex;
            }
        }

        // Scroll to it - with a small delay to ensure layout
        setTimeout(() => {
            const instance = get(virtualizerStore);
            if (instance) {
                instance.scrollToIndex(index, { align: "start" });
            }
        }, 50);
    }

    async function handleFind(
        direction: FindDirection,
        sourceElement?: HTMLElement,
        fromIndex?: number,
    ) {
        if (!findTerm) return;

        const lowerTerm = findTerm.toLowerCase();
        let currentIndex = fromIndex !== undefined ? fromIndex : activeRowIndex;

        const cols = [
            actualConfig.keyColumn,
            ...actualConfig.columns.map((c: any) => c.name),
        ];
        const sortKeys: SortKey[] = sorting.map((s) => ({
            key: s.id,
            direction: s.desc ? "desc" : "asc",
        }));

        while (true) {
            if (direction === "next") {
                currentIndex++;
                if (currentIndex >= matchedIndices.length) {
                    if (backendHasMore) {
                        await performFetch(matchedIndices.length, 20);
                        if (currentIndex >= matchedIndices.length) break;
                    } else {
                        break;
                    }
                }
            } else {
                currentIndex--;
                if (currentIndex < 0) break;
            }

            const rawIdx = matchedIndices[currentIndex];
            let row = rawCache.get(rawIdx);

            if (!row) {
                const batch = await dataSource(cols, rawIdx, 50, sortKeys);
                if (batch && batch.length > 0) {
                    batch.forEach((r, idx) => rawCache.set(rawIdx + idx, r));
                    row = rawCache.get(rawIdx);
                }
            }

            if (row) {
                for (const col of actualColumns) {
                    const val = row[col.name];
                    if (
                        val !== undefined &&
                        val !== null &&
                        String(val).toLowerCase().includes(lowerTerm)
                    ) {
                        scrollToRow(currentIndex, col.name);
                        return;
                    }
                }
            }
        }

        showNotFoundNotification(sourceElement);
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
            if (
                sourceElement.classList.contains("find-prev-btn") ||
                sourceElement.classList.contains("find-next-btn")
            ) {
                // Position above the button
                notFoundPosition = {
                    x: rect.left + rect.width / 2,
                    y: rect.top - 30, // Position above the button
                };
                notFoundSource = sourceElement.classList.contains(
                    "find-prev-btn",
                )
                    ? "prev"
                    : "next";
            } else {
                // Position near the input field (bottom right)
                notFoundPosition = {
                    x: rect.right - 50,
                    y: rect.bottom + 10, // Position below the input
                };
                notFoundSource = "input";
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
        if (term && term !== lastFindTerm) {
            lastFindTerm = term;
            // Trigger search from current position (forward)
            // Start from activeRowIndex - 1 so that the current row is checked first
            untrack(() =>
                handleFind("next", findInputElement, activeRowIndex - 1),
            );
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
            },
        };
    }

    function getCellStyles(
        colConfig: DataTableColumn,
        isFocused: boolean,
    ): {
        cellClasses: string;
        cellStyles: string;
        wrapperClasses: string;
        wrapperStyles: string;
        usesLineClamping: boolean;
    } {
        let cellClasses = "";
        let cellStyles = "";

        let wrapperClasses = "";
        let wrapperStyles = "";
        let usesLineClamping = false;

        if (colConfig.justify === "center")
            cellClasses += " text-center justify-center";
        else if (colConfig.justify === "right")
            cellClasses += " text-right justify-end";
        else cellClasses += " text-left justify-start";

        if (isFocused) {
            cellClasses += " bg-primary/20 ring-1 ring-inset ring-primary";
        }

        if (colConfig.wrappable === "word") {
            wrapperClasses += " break-words whitespace-normal";
            if (colConfig.maxLines && colConfig.maxLines > 0) {
                wrapperStyles += `display: -webkit-box; -webkit-line-clamp: ${colConfig.maxLines}; -webkit-box-orient: vertical; overflow: hidden;`;
                usesLineClamping = true;
            }
        } else {
            wrapperClasses += " truncate whitespace-nowrap";
        }

        wrapperClasses += " leading-normal";

        return {
            cellClasses,
            cellStyles,
            wrapperClasses,
            wrapperStyles,
            usesLineClamping,
        };
    }
</script>

<div
    class={cn(
        "flex flex-col h-full w-full border rounded-md overflow-hidden bg-background relative",
        className,
    )}
>
    <!-- Toolbar -->
    {#if config.isFilterable || config.isFindable}
        <div class="flex-none p-2 border-b bg-muted/20 flex gap-2">
            {#if config.isFilterable}
                <input
                    type="text"
                    placeholder="Filter..."
                    bind:value={filterTerm}
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
                            if (e.key === "Enter")
                                handleFind(
                                    e.shiftKey ? "prev" : "next",
                                    e.currentTarget,
                                );
                        }}
                        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 find-input"
                    />
                    <button
                        bind:this={findPrevButton}
                        class="p-2 hover:bg-muted rounded find-prev-btn"
                        onclick={(e) => handleFind("prev", e.currentTarget)}
                        title="Find Previous"
                    >
                        <ChevronUp class="w-4 h-4" />
                    </button>
                    <button
                        bind:this={findNextButton}
                        class="p-2 hover:bg-muted rounded find-next-btn"
                        onclick={(e) => handleFind("next", e.currentTarget)}
                        title="Find Next"
                    >
                        <ChevronDown class="w-4 h-4" />
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Header -->
    <div
        bind:this={headerContainer}
        class="flex-none border-b bg-muted/40 font-medium text-sm overflow-hidden"
        style="scrollbar-gutter: stable;"
    >
        <div class="flex w-full min-w-max">
            {#each headerGroups as headerGroup}
                {#each headerGroup.headers as header}
                    {@const colConfig = (header.column.columnDef.meta as any)
                        ?.config as DataTableColumn}
                    <div
                        class={cn(
                            "px-4 py-3 font-medium flex items-center gap-1 border-r border-transparent hover:border-border/50 shrink-0 relative group",
                            colConfig?.justify === "center"
                                ? "justify-center text-center"
                                : colConfig?.justify === "right"
                                  ? "justify-end text-right"
                                  : "justify-start text-left",
                        )}
                        style="width: {columnSizing[header.column.id]
                            ? getColumnWidth(
                                  header.column.id,
                                  columnSizing,
                                  header.getSize(),
                              ) + 'px'
                            : (header.column.columnDef.meta as any)?.config
                                  ?.maxChars + 'rem'};"
                    >
                        {#if !header.isPlaceholder}
                            <button
                                type="button"
                                class={cn(
                                    "truncate w-full flex items-center gap-1",
                                    colConfig?.justify === "center"
                                        ? "justify-center text-center"
                                        : colConfig?.justify === "right"
                                          ? "justify-end text-right"
                                          : "justify-start text-left",
                                )}
                                onclick={() => (showSortDialog = true)}
                            >
                                <FlexRender
                                    content={header.column.columnDef.header}
                                    context={header.getContext()}
                                />
                                {#if sorting.find((s) => s.id === header.column.id)}
                                    {@const sortState = sorting.find(
                                        (s) => s.id === header.column.id,
                                    )}
                                    {@const idx = sorting.findIndex(
                                        (s) => s.id === header.column.id,
                                    )}
                                    <span
                                        class="text-[10px] font-bold ml-1 flex items-center"
                                    >
                                        {idx + 1}
                                        {#if sortState?.desc}
                                            <ArrowDown class="w-3 h-3" />
                                        {:else}
                                            <ArrowUp class="w-3 h-3" />
                                        {/if}
                                    </span>
                                {/if}
                            </button>
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                            <div
                                class="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary touch-none select-none opacity-0 group-hover:opacity-100 transition-opacity"
                                role="separator"
                                onmousedown={(e) => {
                                    header.getResizeHandler()(e);
                                }}
                                ontouchstart={(e) => {
                                    header.getResizeHandler()(e);
                                    e.stopPropagation();
                                }}
                                onclick={(e) => e.stopPropagation()}
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
            <div
                style="transform: translateY({virtualItems[0]?.start ?? 0}px);"
            >
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
                        <!-- svelte-ignore a11y_interactive_supports_focus -->
                        <!-- Row doesn't need tabindex - focus stays on grid container for keyboard navigation -->
                        <div
                            data-index={virtualRow.index}
                            use:measureRow={virtualRow.index}
                            class={cn(
                                "flex border-b w-full min-w-max hover:bg-muted/50 transition-colors data-[state=selected]:bg-muted",
                                activeRowIndex === virtualRow.index
                                    ? "bg-muted"
                                    : "",
                            )}
                            data-state={selectedRowIndices.has(virtualRow.index)
                                ? "selected"
                                : undefined}
                            role="row"
                            onclick={(e) => handleRowClick(virtualRow.index, e)}
                            ondblclick={() =>
                                handleRowDoubleClick(virtualRow.index)}
                        >
                            {#each row.getVisibleCells() as cell, cellIndex}
                                {@const colConfig = (
                                    cell.column.columnDef.meta as any
                                )?.config as DataTableColumn}
                                {@const isFocused =
                                    virtualRow.index === activeRowIndex &&
                                    cellIndex === activeColIndex}
                                {@const cellStyle = colConfig
                                    ? getCellStyles(colConfig, isFocused)
                                    : {
                                          cellClasses: "",
                                          cellStyles: "",
                                          wrapperClasses: "",
                                          wrapperStyles: "",
                                          usesLineClamping: false,
                                      }}
                                {@const _size = getColumnWidth(
                                    cell.column.id,
                                    columnSizing,
                                    cell.column.getSize(),
                                )}
                                <div
                                    class={cn(
                                        "px-4 py-2 text-sm border-r border-transparent shrink-0",
                                        cellStyle.usesLineClamping
                                            ? ""
                                            : "flex items-center",
                                        cellStyle.cellClasses,
                                    )}
                                    style="width: {columnSizing[cell.column.id]
                                        ? _size + 'px'
                                        : (colConfig?.maxChars ||
                                              DEFAULT_DATA_TABLE_COLUMN.maxChars) +
                                          'rem'}; {cellStyle.cellStyles}"
                                    role="gridcell"
                                >
                                    <div
                                        class={cellStyle.wrapperClasses}
                                        style={cellStyle.wrapperStyles}
                                    >
                                        <FlexRender
                                            content={cell.column.columnDef.cell}
                                            context={cell.getContext()}
                                        />
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

    <div
        class="flex-none border-t bg-muted/40 p-2 text-xs flex justify-between"
    >
        <span
            >Rows: {matchedIndices.length} | Cached: {rawCache.size}
            {isLoading ? "(Fetching...)" : ""}</span
        >
        <span>Active: {activeRowIndex}, {activeColIndex}</span>
    </div>

    <SortOptions
        bind:open={showSortDialog}
        columns={actualColumns}
        sorting={sorting.map((s) => ({
            key: s.id,
            direction: s.desc ? "desc" : "asc",
        }))}
        onApply={updateSorting}
    />

    {#if actualConfig.isEditable}
        <RowEditForm
            bind:open={isEditDialogOpen}
            data={editingRow}
            columns={actualColumns}
            config={actualConfig}
            onAction={handleRowEdit}
        />
    {/if}

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
