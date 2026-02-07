<script lang="ts">
    import DataTable from "$lib/components/ui/datatable/DataTable.svelte";
    import DataTableContainer from "$lib/components/ui/datatable/DataTableContainer.svelte";
    import type { DataTableConfig } from "$lib/components/ui/datatable/DataTableTypes.ts";
    import { TestGridDataSource } from "$lib/utils/TestGridDataSource.ts";
    import { onMount } from "svelte";

    let config: DataTableConfig = $state({
        name: "loading",
        keyColumn: "id",
        columns: [],
    });

    let dataSource: any = $state(() => Promise.resolve([]));
    let isReady = $state(false);
    let tableComponent: any = $state();
    let currentFilter = $state("");
    let onRowEdit: any = $state(undefined);

    // Test configuration state
    let scenario = $state("");
    let useContainer = $state(true);

    // Test config injection interface
    interface TestConfig {
        config?: Partial<DataTableConfig>;
        rows?: number;
        cols?: number;
        latency?: number;
        scenario?: string;
        useContainer?: boolean;
    }

    onMount(() => {
        try {
            console.log("[PWTestApp] onMount started");

            // Check for injected test configuration
            const testConfig = (window as any).__TEST_CONFIG__ as
                | TestConfig
                | undefined;

            let rows = testConfig?.rows ?? 50;
            let cols = testConfig?.cols ?? 5;
            let latency = testConfig?.latency ?? 0;

            // Fallback or Override from URL params
            const params = new URLSearchParams(window.location.search);

            // Priority: Injected Config > URL Params > Defaults
            scenario = testConfig?.scenario || params.get("scenario") || "";

            // Handle boolean useContainer from params
            const paramUseContainer = params.get("useContainer");
            if (testConfig?.useContainer !== undefined) {
                useContainer = testConfig.useContainer;
            } else if (paramUseContainer !== null) {
                useContainer = paramUseContainer === "true";
            } else {
                useContainer = true; // Default
            }

            console.log("[PWTestApp] Config:", {
                scenario,
                useContainer,
                search: window.location.search,
            });

            if (!testConfig) {
                if (params.get("scenario") === "scroll_by_pageup_down") {
                    rows = parseInt(params.get("rows") || "100");
                    cols = parseInt(params.get("cols") || "20");
                }
                if (params.get("latency")) {
                    latency = parseInt(params.get("latency") || "0");
                }
            }

            const ds = new TestGridDataSource(rows, cols, latency);
            const baseCols = ds.getColumns();

            let finalConfig: DataTableConfig = {
                name: "test-grid",
                keyColumn: "id",
                title: scenario ? `Test: ${scenario}` : "PWTestApp",
                isFilterable: true,
                isFindable: true,
                columns: baseCols,
            };

            // Apply overrides from test config
            if (testConfig?.config) {
                finalConfig = { ...finalConfig, ...testConfig.config };
                // If columns are provided in config, use them, otherwise default to DS columns
                if (testConfig.config.columns) {
                    finalConfig.columns = testConfig.config.columns;
                }
            }

            if (testConfig?.config?.isEditable) {
                onRowEdit = async (action: any, row: any) => {
                    if ((window as any).__onRowEdit) {
                        return await (window as any).__onRowEdit(action, row);
                    }
                    return true;
                };
            }

            config = finalConfig;
            dataSource = (
                cols: string[],
                start: number,
                num: number,
                sort: any[],
            ) => ds.getRows(cols, start, num, sort);

            isReady = true;
            console.log("[PWTestApp] isReady set to true");

            // Expose API for testing
            (window as any).getDataTableActiveCell = () => {
                return tableComponent?.getActiveCell();
            };
        } catch (err) {
            console.error("[PWTestApp] onMount Error:", err);
        }
    });
</script>

<div class="p-10 h-screen w-full flex flex-col gap-4">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">PWTestApp</h1>
        <div id="debug-info" class="text-xs font-mono bg-gray-100 p-2">
            Scenario: {scenario}, UseContainer: {useContainer}, Search: {window
                .location.search}
        </div>
    </div>

    {#if isReady}
        <!-- Mimic App.svelte and Import.svelte structure with min-h-screen -->
        <main class="min-h-screen flex flex-col w-full">
            <div class="flex-1 container mx-auto p-4">
                <!-- mimics App.svelte wrapper -->
                <!-- Mimic Import.svelte root -->
                <div
                    class="h-full flex flex-col gap-4 p-4 border border-red-500"
                >
                    <div
                        class="flex-1 flex flex-col min-h-0 border border-blue-500 rounded-xl relative"
                    >
                        <!-- Mimic Card.Root + Card.Content merged for simplicity or use actual classes -->
                        <!-- Actually Import.svelte has Card.Root(flex-1) -> Card.Content(flex-1 relative) -->
                        <div
                            class="flex-1 flex flex-col min-h-0 bg-card rounded-xl border"
                        >
                            <!-- 
                                Layout Test Logic:
                                If scenario is 'layout-test', we simulate a specific "bad" parent.
                                Otherwise we use the standard structure.
                            -->
                            {#if scenario === "layout-test"}
                                <!-- Bad Parent: Missing relative, just specific size constraints or flex without relative -->
                                <div
                                    class="flex-1 min-h-0 border border-red-500 p-0"
                                    id="bad-parent"
                                >
                                    {#if useContainer}
                                        <DataTableContainer id="grid-container">
                                            <DataTable
                                                bind:this={tableComponent}
                                                {config}
                                                {dataSource}
                                                bind:filterTerm={currentFilter}
                                                {onRowEdit}
                                                class="absolute inset-0 bg-background border-0"
                                            />
                                        </DataTableContainer>
                                    {:else}
                                        <!-- Broken State: DataTable absolute but direct parent not relative -->
                                        <div
                                            id="grid-container-raw"
                                            class="w-full h-full"
                                        >
                                            <!-- Note: wrapping in a plain div to mimic 'no container component' structure if needed, 
                                                 or just placing DataTable directly. 
                                                 If we put absolute DataTable here, it will look for nearest relative ancestor.
                                                 grid-container ID needed for test targeting.
                                            -->
                                            <DataTable
                                                bind:this={tableComponent}
                                                {config}
                                                {dataSource}
                                                bind:filterTerm={currentFilter}
                                                {onRowEdit}
                                                class="absolute inset-0 bg-background border-0"
                                            />
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <!-- Standard App Flow (mimicking Import view fixed state) -->
                                <div class="flex-1 min-h-0 relative p-0">
                                    <!-- Card.Content -->
                                    <DataTableContainer id="grid-container">
                                        <DataTable
                                            bind:this={tableComponent}
                                            {config}
                                            {dataSource}
                                            bind:filterTerm={currentFilter}
                                            {onRowEdit}
                                            class="absolute inset-0 bg-background border-0"
                                        />
                                    </DataTableContainer>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        </main>
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
