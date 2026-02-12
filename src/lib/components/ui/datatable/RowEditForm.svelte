<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog/index.ts";
    import { Button } from "$lib/components/ui/button/index.ts";
    import { Input } from "$lib/components/ui/input/index.ts";
    import { Label } from "$lib/components/ui/label/index.ts";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.ts";
    import { superForm, defaults } from "sveltekit-superforms";
    import { zod } from "sveltekit-superforms/adapters";
    import { z } from "zod";
    import type {
        DataTableColumn,
        DataTableConfig,
        RowEditCallback,
        RowEditAction,
    } from "./DataTableTypes.ts";

    let {
        open = $bindable(false),
        data,
        columns,
        config,
        onAction,
    }: {
        open: boolean;
        data: any;
        columns: DataTableColumn[];
        config: DataTableConfig;
        onAction: RowEditCallback;
    } = $props();

    // Dynamically build schema based on columns
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    // svelte-ignore state_referenced_locally
    columns.forEach((col) => {
        schemaShape[col.name] = z.string().optional();
    });
    const schema = z.object(schemaShape);

    // svelte-ignore state_referenced_locally
    // @ts-ignore - Bypassing "Type instantiation is excessively deep" errors with dynamic Zod schemas
    const initialData: any = defaults(data || {}, zod(schema) as any);

    // We'll use our own validation state for field-level errors as required by spec
    let fieldErrors = $state<Record<string, string[]>>({});
    let formErrors = $state<string[]>([]);

    // @ts-ignore - Bypassing "Type instantiation is excessively deep" errors with dynamic Zod schemas
    const { form, enhance, message, delayed } = superForm(initialData as any, {
        SPA: true,
        validators: zod(schema) as any,
    });

    // Sync data when opening
    $effect(() => {
        if (open && data) {
            const formData = { ...data };

            // Apply formatters to initial values where applicable
            columns.forEach((col) => {
                if (
                    col.formatter &&
                    formData[col.name] !== undefined &&
                    formData[col.name] !== null
                ) {
                    formData[col.name] = col.formatter(formData[col.name]);
                }
            });

            $form = formData;
            fieldErrors = {};
            formErrors = [];
            $message = "";
        }
    });

    let showConfirmDelete = $state(false);
    let originalRow = $state<any>(null);

    // Capture original row when dialog opens
    $effect(() => {
        if (open && data) {
            originalRow = { ...data };
        }
    });

    function validateField(col: DataTableColumn) {
        if (col.validator) {
            const errors = col.validator($form[col.name]);
            if (errors.length > 0) {
                fieldErrors[col.name] = errors;
            } else {
                delete fieldErrors[col.name];
            }
        } else if (col.enumValues) {
            const values = col.enumValues();
            if ($form[col.name] && !values.includes($form[col.name] as any)) {
                fieldErrors[col.name] = [
                    "Value must be one of the allowed options",
                ];
            } else {
                delete fieldErrors[col.name];
            }
        }

        // Clear form error when all field errors are cleared
        if (Object.keys(fieldErrors).length === 0) {
            formErrors = [];
        }
    }

    function handleInput(colName: string) {
        // Clear field-level error as soon as user enters new data
        if (fieldErrors[colName]) {
            delete fieldErrors[colName];
        }
        if (Object.keys(fieldErrors).length === 0) {
            formErrors = [];
        }
    }

    async function handleAction(action: RowEditAction) {
        if (action === "delete") {
            if (!showConfirmDelete) {
                showConfirmDelete = true;
                return;
            }
            showConfirmDelete = false;
        } else {
            // Validate all fields
            columns.forEach((col) => validateField(col));

            // Row (form) level validation
            if (config.rowValidator) {
                const errors = config.rowValidator($form);
                if (errors.length > 0) {
                    formErrors = errors;
                }
            }

            if (Object.keys(fieldErrors).length > 0 || formErrors.length > 0) {
                return;
            }
        }

        const result = await onAction(
            action,
            $form,
            originalRow,
            config.keyColumn,
        );

        if (result === true) {
            open = false;
        } else if (typeof result === "object" && result?.error) {
            $message = result.error;
        }
    }

    const hasErrors = $derived(
        Object.keys(fieldErrors).length > 0 || formErrors.length > 0,
    );
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-2xl flex flex-col max-h-[90vh]">
        <Dialog.Header>
            <Dialog.Title>Edit Row</Dialog.Title>
            <Dialog.Description>
                Make changes to your data here. Click save when you're done.
            </Dialog.Description>
        </Dialog.Header>

        <!-- Display Messages (Toast / Form Messages) -->
        {#if $message}
            <div
                class="text-destructive text-sm font-medium p-2 bg-destructive/10 rounded mb-2"
            >
                {$message}
            </div>
        {/if}

        <div class="grid gap-4 py-4 overflow-y-auto px-1 flex-1">
            {#each columns as col}
                <div class="grid grid-cols-4 items-start gap-4">
                    <Label for={col.name} class="text-right pt-2.5">
                        {col.title || col.name}
                    </Label>
                    <div class="col-span-3 flex flex-col gap-1">
                        {#if col.enumValues}
                            <select
                                id={col.name}
                                bind:value={$form[col.name]}
                                onblur={() => validateField(col)}
                                oninput={() => handleInput(col.name)}
                                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Select option...</option>
                                {#each col.enumValues() as val}
                                    <option value={val}>{val}</option>
                                {/each}
                            </select>
                        {:else}
                            <Input
                                id={col.name}
                                bind:value={$form[col.name]}
                                placeholder={col.title || col.name}
                                onblur={() => validateField(col)}
                                oninput={() => handleInput(col.name)}
                            />
                        {/if}

                        {#if fieldErrors[col.name]}
                            {#each fieldErrors[col.name] as error}
                                <span
                                    class="text-xs text-destructive font-medium leading-none"
                                    >{error}</span
                                >
                            {/each}
                        {/if}
                    </div>
                </div>
            {/each}
        </div>

        <!-- Row Level Errors -->
        {#if formErrors.length > 0}
            <div
                class="p-3 bg-destructive/5 border border-destructive/20 rounded-md mb-4 bg-red-50"
            >
                <ul class="list-disc list-inside space-y-1">
                    {#each formErrors as error}
                        <li class="text-xs text-destructive font-medium">
                            {error}
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <Dialog.Footer class="flex-col sm:flex-row gap-2 pt-4 border-t">
            <div class="flex-1 flex justify-start">
                <Button
                    variant="destructive"
                    onclick={() => handleAction("delete")}
                    disabled={$delayed}
                >
                    Delete
                </Button>
            </div>
            <div class="flex gap-2 justify-end">
                <Button variant="outline" onclick={() => (open = false)}
                    >Cancel</Button
                >

                <Button
                    onclick={() => handleAction("update")}
                    disabled={$delayed || hasErrors}
                >
                    Update this row
                </Button>
                <Button
                    onclick={() => handleAction("create")}
                    disabled={$delayed || hasErrors}
                >
                    Save as new row
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
                This action cannot be undone. This will permanently delete the
                row.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onclick={() => handleAction("delete")}>
                Delete
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
