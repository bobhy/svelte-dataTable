/**
 * Default values for a {@link DataTableColumn}
 */
export const DEFAULT_DATA_TABLE_COLUMN = {
    isSortable: false,
    wrappable: 'none',
    maxLines: 2,
    justify: 'left',
    maxWidth: 150,
    formatter: (value: any) => String(value ?? '')
} as const;

/**
 * DataTable Column Definition
 * 
 * @property {string} name - Column name in data source (key).
 * @property {string} [title] - Column title (display name).<br>Default is name in title case.
 * @property {boolean} [isSortable] - Whether the column is sortable. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.isSortable}
 * @property {'none' | 'word' | 'hard'} [wrappable] - Whether the column is wrappable. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.wrappable}
 * @property {number} [maxLines] - If wrapping a column, the maximum number of lines the row can use. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.maxLines}
 * @property {'left' | 'center' | 'right'} [justify] - The justification of the column. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.justify}
 * @property {number} [maxWidth] - The maximum width of the column. {@defaultLink DEFAULT_DATA_TABLE_COLUMN.maxWidth}
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
    maxWidth?: number;
    formatter?: (value: any) => string;
    validator?: (value: any) => string[];
    enumValues?: () => string[];
}

/**
 * Default values for a {@link DataTableConfig}
 */
export const DEFAULT_DATA_TABLE_CONFIG = {
    maxVisibleRows: 20,
    isFilterable: false,
    isFindable: false,
    isEditable: false
} as const;

/**
 * DataTable Config
 * 
 * @property {string} name - The name of the config.
 * @property {string} keyColumn - The key column of the config.
 * @property {string} [title] - The title of the config.
 * @property {number} [maxVisibleRows] - The maximum number of visible rows. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.maxVisibleRows}
 * @property {boolean} [isFilterable] - Whether the config is filterable. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isFilterable}
 * @property {boolean} [isFindable] - Whether the config is findable. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isFindable}
 * @property {boolean} [isEditable] - Whether the config is editable. {@defaultLink DEFAULT_DATA_TABLE_CONFIG.isEditable}
 * @property {DataTableColumn[]} columns - The columns of the config.
 * @property {(row: any) => string[]} [rowValidator] - The row validator of the config. Returns error messages.
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
    maxVisibleRows?: number;
    isFilterable?: boolean;
    isFindable?: boolean;
    isEditable?: boolean;
    columns: DataTableColumn[];
    rowValidator?: (row: any) => string[];
}

/**
 * DataTable callback to fetch data
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
 * Callback to update data source when user edits data in the table
 * 
 * @param action - The action to perform.
 * @param row - The row to edit.
 * @returns A promise that resolves to a boolean or an object with an error property.
 */
export type RowEditCallback = (
    action: RowAction,
    row: any
) => Promise<RowEditResult>;

/**
 * Kind of data source update to perform
 * 
 * @property {'update' | 'create' | 'delete'} action - The action to perform.
 */
export type RowAction = 'update' | 'create' | 'delete';

/**
 * RowEditResult
 * 
 * @property {boolean | { error: string }} result - The result of the row edit.
 */
export type RowEditResult = boolean | { error: string };

/**
 * DataTable Props
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

// Doc for public interfaces of DataTable component moved from .svelte file, 
// due to lack of tsdoc extractor for svelte components.
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


