<script lang="ts">
    import { cn } from "$lib/utils.ts";
    import type { HTMLAttributes } from "svelte/elements";

    let {
        class: className,
        children,
        ...restProps
    }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<!-- 
    DataTableContainer
    Acts as the responsive boundary for a DataTable.
    - flex-1 min-h-0: Ensures it fills available flex space and allows shrinking (scrolling).
    - w-full h-full: Ensures it fills non-flex containers.
    - relative: Establishes a positioning context for the absolute DataTable.
-->
<div
    class={cn("flex-1 min-h-0 w-full h-full relative", className)}
    {...restProps}
>
    {@render children?.()}
</div>
