<script lang="ts">
    import type { DataTableColumn, SortKey } from './DataTableTypes.ts';

    import * as Dialog from "$lib/components/ui/dialog/index.ts";
    
    // Fallback styles for button since Button component is missing
    const btnClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2";
    const btnOutline = "border border-input bg-background hover:bg-accent hover:text-accent-foreground";

    let { open = $bindable(false), columns, sorting, onApply } = $props<{
        open: boolean,
        columns: DataTableColumn[],
        sorting: SortKey[],
        onApply: (newSorting: SortKey[]) => void
    }>();

    let localSorting = $state<SortKey[]>([]);

    const sortableCols = $derived(columns.filter((c: DataTableColumn) => c.isSortable));

    $effect(() => {
        if (open) {
            // Initialize local state from props, ensuring 3 slots
            const current = [...sorting];
            while (current.length < 3) {
                current.push({ key: '', direction: 'asc' });
            }
            // Ensure first is populated if empty and we have columns
            if (!current[0].key && sortableCols.length > 0) {
                // current[0].key = sortableCols[0].name; // Don't auto-select, let user choose? 
                // "Sort by: <drop down>" - usually defaults to None or first.
            }
            localSorting = current.slice(0, 3);
        }
    });

    function handleApply() {
        // Filter out empty keys
        const valid = localSorting.filter(s => s.key && s.key !== 'none');
        onApply(valid);
        open = false;
    }

    function getAvailableColumns(level: number) {
        // "including 'none', but excluding the previous chosen column"
        const prevKeys = localSorting.slice(0, level).map(s => s.key);
        return [
            { name: 'none', title: '(None)' },
            ...sortableCols.filter((c: DataTableColumn) => !prevKeys.includes(c.name))
        ];
    }
</script>

<Dialog.Root bind:open={open}>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>Sort Rows</Dialog.Title>
            <Dialog.Description>
                Configure up to 3 levels of sorting.
            </Dialog.Description>
        </Dialog.Header>
        
        <div class="grid gap-4 py-4">
            {#each localSorting as sortLayer, i}
                <div class="flex items-center gap-2">
                    <span class="w-16 text-right text-sm font-medium">
                        {i === 0 ? 'Sort by' : 'Then by'}
                    </span>
                    
                    <!-- Direction -->
                    <select 
                        bind:value={sortLayer.direction}
                        class="h-9 w-[100px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>

                    <span class="text-sm">of</span>

                    <!-- Column -->
                    <select 
                        bind:value={sortLayer.key}
                        class="h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="">(None)</option>
                        {#each getAvailableColumns(i) as col}
                            <option value={col.name}>{col.title || col.name}</option>
                        {/each}
                    </select>
                </div>
            {/each}
        </div>

        <Dialog.Footer>
            <button class="{btnClass} {btnOutline}" onclick={() => open = false}>Cancel</button>
            <button class={btnClass} onclick={handleApply}>Apply Sort</button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
