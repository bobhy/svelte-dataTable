
/**
View and edit tabular data

Supports:

- Infinite scrolling with keyboard navigation
- Sort by multiple columns
- Filtering and finding
- Editing (single row at a time)
- Column resizing and column pinning
- Callbacks for fetching from and editing data in any source

Not a data "grid". Unlikely to ever support column reordering, grouping,
aggregation, etc.

todo's:
- Validate that data source actually provides the columns named in config.
- Support bulk edit: select a rectangle, collect 1 value for each col and update
  all rows with those values.

@example
```svelte
<script lang="ts">
    import { DataTable, DataTableContainer } from 'datatable';
    import type { DataTableConfig, DataSourceCallback, RowEditResult } from 'datatable';

    const config: DataTableConfig = {
        name: 'yourSourceView',
        keyColumn: 'name',
        isEditable: true,
        isFilterable: true,
        columns: [
            { name: 'name', isSortable: true },
            { name: 'age', isSortable: true,
                formatter: (value: number) => `${value} years young` }
        ]
    };

    const dataSource: DataSourceCallback = async (columnKeys, startRow, numRows, sortKeys) => {
        // Fetch data from your source
        return [];
    };

    const handleRowEdit = async (action: RowEditAction, row: any, oldRow: any): Promise<RowEditResult> => {
        // Handle row edit
        return true;
    };
</script>

<div class="w-full p-4">
    <DataTableContainer>
        <DataTable {config} {dataSource} onRowEdit={handleRowEdit} />
    </DataTableContainer>
</div>
```

See {@link DataTableProps}

 */
export interface DataTable {
    /** 
     * Get the currently active cell.
     * The active cell is the one currently highlighted by the keyboard navigation, 
     * and is not necessarily *selected*.
     * 
     * @returns {ActiveCellInfo | null} The currently active cell, or null if no cell is active.
    */
    getActiveCell(): ActiveCellInfo | null;

    /**
     * Scroll the grid to make the specified row visible.
     * 
     * @param {number} index - 0-based index of the row in the full dataset.
     * @param {string} [columnName] - Optional name of the column to focus/mark as active.
     */
    scrollToRow(index: number, columnName?: string): void;
}

/**
 * Container for a {@link DataTable}
 * 
 * Allows table to fill parent container and react to changes in height.  
 * If your app's container for DataTable already sets these styles, you don't need a DataTableContainer.
 * @see DataTableContainer.svelte
 */
export interface DataTableContainer {

}

/**
 * Default values for a {@link DataTableColumn}
 */
export const DEFAULT_DATA_TABLE_COLUMN = {
    isSortable: false,
    wrappable: 'none',
    maxLines: 2,
    justify: 'left',
    maxChars: 9,    // wide enough for a date or dollar amount
    formatter: (value: any) => String(value ?? '')
} as const;

/**
 * Definition for one column of a {@link DataTable}
 * 
 * @property {string} name - Column name in data source (key).
 * @property {string} [title] - Column title (display name).<br>Default is name in title case.
 * @property {boolean} [isSortable] - Whether the column is sortable. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.isSortable}
 * @property {'none' | 'word' | 'hard'} [wrappable] - Whether the column is wrappable. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.wrappable}
 * @property {number} [maxLines] - If wrapping a column, the maximum number of lines the row can use. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.maxLines}
 * @property {'left' | 'center' | 'right'} [justify] - The justification of the column. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.justify}
 * @property {number} [maxChars] - The maximum width of the column in characters. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.maxChars}
 * @property {(value: any) => string} [formatter] - convert/format column value from data source to table. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.formatter}
 * @property {(value: any) => string[]} [validator] - validate user-entered value. Returns error messages.
 * @property {() => string[]} [enumValues] - List of legal values for select fields.
 * 
 * @example
 * ```typescript
 * const column: DataTableColumn = {
 *     ...DEFAULT_DATA_TABLE_COLUMN,
 *     name: 'name',
 *     title: 'Name'
 * };
 * ```
 */
export interface DataTableColumn {
    name: string;
    title?: string;
    isSortable?: boolean;
    wrappable?: 'none' | 'word' | 'hard';
    maxLines?: number;
    justify?: 'left' | 'center' | 'right';
    maxChars?: number;
    formatter?: (value: any) => string;
    validator?: (value: any) => string[];
    enumValues?: () => string[];
}

/**
 * Default values for a {@link DataTableConfig}
 */
export const DEFAULT_DATA_TABLE_CONFIG = {
    isFilterable: false,
    isFindable: false,
    isEditable: false
} as const;

/**
 * Configuration for a {@link DataTable}
 * 
 * @property {string} name - The name of the dataTable (id in the DOM).
 * @property {string} keyColumn - The key column. Values must be unique in the table (for view optimization) and column must be unique primary key in data source (for row update/delete).
 * @property {string} [title] - The title of the table.
 * @property {boolean} [isFilterable] - Enables incremental filtering. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isFilterable}
 * @property {boolean} [isFindable] - Enables incremental find. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isFindable}
 * @property {boolean} [isEditable] - Enables row editing. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isEditable}
 * @property {DataTableColumn[]} columns - Individual column definitions.
 * @property {(row: any) => string[]} [rowValidator] - Does form-level validation when editing a row.
 * 
 * @example
 * ```typescript
 * const config: DataTableConfig = {
 *     ...DEFAULT_DATA_TABLE_CONFIG,
 *     name: 'config',
 *     keyColumn: 'id',
 *     columns: [ ... ]
 * };
 * ```
 */
export interface DataTableConfig {
    name: string; // ID for callbacks
    keyColumn: string;
    title?: string;
    isFilterable?: boolean;
    isFindable?: boolean;
    isEditable?: boolean;
    columns: DataTableColumn[];
    rowValidator?: (row: any) => string[];
}

/**
 * Callback to fetch data
 * 
 * @param columnKeys - The column keys.
 * @param startRow - The start row.
 * @param numRows - The number of rows.
 * @param sortKeys - The sort keys.
 * @returns A promise that resolves to an array of row objects.
 */
export type DataSourceCallback = (
    columnKeys: string[],
    startRow: number,
    numRows: number,
    sortKeys: SortKey[]
) => Promise<any[]>; // Returns array of row objects

/**
 * Sort order for a column
 * 
 * @property {string} key - The key of the sort.
 * @property {'asc' | 'desc'} direction - The direction of the sort.
 */
export interface SortKey {
    key: string;
    direction: 'asc' | 'desc';
}

/**
 * Callback to update data source when user edits data in the table.
 *  
 * The point of providing `originalRow` is to allow the callback to select the original
 * record in the data source to delete or update if the user changes the primary key field
 * when editing the form.
 * If the back end is a relational database, it can maintain referential integrity
 * automagically via constraint `ON UPDATE CASCADE` and `ON DELETE SET DEFAULT`. 
 * 
 * @param action - The action to perform.
 * @param row - The row to edit.
 * @param originalRow - The original row before edits (create: null, update, delete: original object)
 * @param keyColumn - The name of the primary key column from config
 * @returns A promise that resolves to a boolean or an object with an error property.
 */
export type RowEditCallback = (
    action: RowEditAction,
    row: any,
    originalRow?: any, // The original row before edits (for 'update')
    keyColumn?: string // The name of the PK column
) => Promise<RowEditResult>;

/**
 * Kind of data source update to perform
 * 
 * @property {'update' | 'create' | 'delete'} action - The action to perform.
 */
export type RowEditAction = 'update' | 'create' | 'delete';

/**
 * Return from applying a row edit to the data source
 * 
 * @property {boolean | { error: string }} result - The result of the row edit.
 */
export type RowEditResult = boolean | { error: string };

/**
 * Props for a {@link DataTable}
 * 
 * @property {DataTableConfig} config - The config of the table.
 * @property {DataSourceCallback} dataSource - The data source of the table.
 * @property {RowEditCallback} [onRowEdit] - The row edit callback of the table.
 * @property {string} [class] - The class of the table.
 * @property {string} [filterTerm] - Current filter term of the table.
 * @property {string} [findTerm] - Current find term of the table.
 */
export interface DataTableProps {
    config: DataTableConfig;
    dataSource: DataSourceCallback;
    onRowEdit?: RowEditCallback;
    class?: string;
    filterTerm?: string;
    findTerm?: string;
}

/**
 * Row and column info about the currently active cell, returned by {@link DataTable.getActiveCell}
 * 
 * @property {number} dataRowIndex - The 0-based index of the row in the backend data source.
 * @property {string} dataColumnName - The name of the key column.
 * @property {number | null} viewportRowIndex - The 0-based index of the row in the rendered window, null if not visible.
 */
export interface ActiveCellInfo {
    // Data Source coordinates
    dataRowIndex: number; // 0-based index in the full dataset
    dataColumnName: string; // Key of the column

    // Grid coordinates (Visible window relative? Or just generic grid coords?)
    // Request: "visible position in the grid of the active cell (by grid row and column name)"
    // "Grid Row" usually means 0..N relative to the viewport? Or 0..N in the table?
    // "visible position... by grid row" implies 0-based index in the CURRENT VIEWPORT.
    viewportRowIndex: number | null; // 0-based index in the rendered window, null if not visible
}


