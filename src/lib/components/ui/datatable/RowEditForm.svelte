<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog/index.ts";
    import { Button } from "$lib/components/ui/button/index.ts";
    import { Input } from "$lib/components/ui/input/index.ts";
    import { Label } from "$lib/components/ui/label/index.ts";
    import * as Form from "$lib/components/ui/form/index.ts";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.ts";
    import { superForm, defaults } from "sveltekit-superforms";
    import { zod } from "sveltekit-superforms/adapters";
    import { z } from "zod";
    import type { DataTableColumn, RowEditCallback, RowAction } from "./DataTableTypes.ts";
    import { toast } from "svelte-sonner";

    let { 
        open = $bindable(false), 
        data, 
        columns,
        onAction 
    }: { 
        open: boolean; 
        data: any; 
        columns: DataTableColumn[];
        onAction: RowEditCallback;
    } = $props();

    // Dynamically build schema based on columns
    // We assume all fields are strings for now, can be enhanced with type metadata in columns later
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    // svelte-ignore state_referenced_locally - Schema is built once at component creation, intentionally non-reactive
    columns.forEach(col => {
        schemaShape[col.name] = z.string().optional(); 
        // TODO: Infer types from value or config if available
    });
    const schema = z.object(schemaShape);

    // Initialize form
    // In SPA mode, we use 'defaults' to create initial form data structure
    // svelte-ignore state_referenced_locally - Initial form data is captured once, synced via $effect
    const initialData = defaults(data || {}, zod(schema));
    
    const { form, errors, enhance, message, delayed } = superForm(initialData, {
        SPA: true,
        validators: zod(schema),
        onUpdate: async ({ form: f }) => {
            if (f.valid) {
                 // Handled via buttons
            }
        }
    });

    // Sync data when opening
    $effect(() => {
        if (open && data) {
            $form = { ...data };
        }
    });

    let showConfirmDelete = $state(false);

    async function handleAction(action: RowAction) {
        if (action === 'delete' && !showConfirmDelete) {
            showConfirmDelete = true;
            return;
        }

        // Close confirmation if it was open
        showConfirmDelete = false;

        const result = await onAction(action, $form);
        
        if (result === true) {
            open = false;
        } else if (typeof result === 'object' && result?.error) {
           $message = result.error;
        }
    }

</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>Edit Row</Dialog.Title>
            <Dialog.Description>
                Make changes to your data here. Click save when you're done.
            </Dialog.Description>
        </Dialog.Header>

        <!-- Display Form Level Error -->
        {#if $message}
            <div class="text-destructive text-sm font-medium p-2 bg-destructive/10 rounded">
                {$message}
            </div>
        {/if}

        <div class="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            {#each columns as col}
                <div class="grid grid-cols-4 items-center gap-4">
                    <Label for={col.name} class="text-right">
                        {col.title || col.name}
                    </Label>
                    <div class="col-span-3">
                         <Input 
                            id={col.name} 
                            bind:value={$form[col.name]} 
                            placeholder={col.title || col.name}
                        />
                         {#if $errors[col.name]}
                            <span class="text-xs text-destructive">{$errors[col.name]}</span>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

        <Dialog.Footer class="flex-col sm:flex-row gap-2">
            <div class="flex-1 flex justify-start">
                 <Button variant="destructive" onclick={() => handleAction('delete')} disabled={$delayed}>
                    Delete
                </Button>
            </div>
            <div class="flex gap-2 justify-end">
                <Button variant="outline" onclick={() => open = false}>Cancel</Button>
                <Button variant="secondary" onclick={() => handleAction('create')} disabled={$delayed}>
                    Save as New
                </Button>
                <Button onclick={() => handleAction('update')} disabled={$delayed}>
                    Save Changes
                </Button>
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={showConfirmDelete}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
                This action cannot be undone. This will permanently delete the row.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onclick={() => handleAction('delete')}>
                Delete
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
