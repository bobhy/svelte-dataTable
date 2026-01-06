<script lang="ts">
  import DataTable from '$lib/components/ui/datagrid/DataTable.svelte';
  import type { DataTableConfig } from '$lib/components/ui/datagrid/DataTableTypes';

  // Sample data and config for testing
  const config: DataTableConfig = {
    columns: [
      { name: 'id', title: 'ID', isSortable: true, maxWidth: 50 },
      { name: 'name', title: 'Name', isSortable: true, maxWidth: 200 },
      { name: 'email', title: 'Email', isSortable: true, maxWidth: 300 },
      { name: 'role', title: 'Role', isSortable: true, maxWidth: 100 },
    ],
    keyColumn: 'id',
    isFilterable: true,
    maxVisibleRows: 20
  };

  const data = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    email: `person${i + 1}@example.com`,
    role: i % 3 === 0 ? 'Admin' : i % 3 === 1 ? 'User' : 'Guest'
  }));

  const fetchDataSource = async (cols: string[], start: number, limit: number, sortKeys: any[]) => {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 300));
      
      let res = [...data];
      
      // Sort
      if (sortKeys.length > 0) {
          const { key, direction } = sortKeys[0];
          res.sort((a: any, b: any) => {
              if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
              if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      
      return res.slice(start, start + limit);
  };
</script>

<div class="p-10 h-screen w-full flex flex-col gap-4">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold">DataTable Standalone Test</h1>
        <button onclick={() => document.documentElement.classList.toggle('dark')} class="px-4 py-2 border rounded">
            Toggle Dark Mode
        </button>
    </div>
    <div class="flex-1 border rounded-lg h-[600px]">
        <DataTable {config} dataSource={fetchDataSource} class="h-full" />
    </div>
</div>
