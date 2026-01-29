/**
 * Default values for a {@link DataTableColumn}
 */
export const DEFAULT_DATA_TABLE_COLUMN = {
    /** Whether the column is sortable. Default: `false` */
    isSortable: false,
    /** Whether the column is wrappable. Default: `'none'` */
    wrappable: 'none',
    /** If wrapping a column, the maximum number of lines the row can use. Default: `1` */
    maxLines: 2,
    /** The justification of the column. Default: `'left'` */
    justify: 'left',
    /** The maximum width of the column in characters. Default: `20` */
    maxWidth: 20,
    /** Convert/format column value from data source to table. Default: `String(value ?? '')` */
    formatter: (value: any) => String(value ?? '')
} as const;

/**
 * DataTable Column Definition
 * 
 * @property {string} name - Column name in data source (key).
 * @property {string} [title] - Column title (display name). Default is name in title case.
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
    /** The maximum number of visible rows. Default: `20` */
    maxVisibleRows: 20,
    /** Whether the config is filterable. Default: `false` */
    isFilterable: false,
    /** Whether the config is findable. Default: `false` */
    isFindable: false,
    /** Whether the config is editable. Default: `false` */
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
 * DataSourceCallback
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
 * SortKey
 * 
 * @property {string} key - The key of the sort.
 * @property {'asc' | 'desc'} direction - The direction of the sort.
 */
export interface SortKey {
    key: string;
    direction: 'asc' | 'desc';
}

/**
 * RowEditCallback
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
 * RowAction
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

// Selection Callback Types
export interface SelectedCell {
    rowKey: any;
    columnKey: string;
}

export type SelectedCellsCallback = (selectedCells: SelectedCell[]) => Promise<string | null>;

// Find Callback Types
export type FindDirection = 'next' | 'previous';

export interface FindResult {
    rowIndex: number;      // 0-based row index in the dataset
    columnName?: string;   // Optional: column containing the match
}

export type FindCallback = (
    searchTerm: string,
    direction: FindDirection,
    currentRowIndex: number
) => Promise<FindResult | number | null>;  // Can return FindResult, just row index, or null

export interface DataTableProps {
    config: DataTableConfig;
    dataSource: DataSourceCallback;
    onRowEdit?: RowEditCallback;
    onSelection?: SelectedCellsCallback;
    onFind?: FindCallback;
    class?: string;
    globalFilter?: string;
    findTerm?: string;
}

export interface ActiveCellInfo {
    // Data Source coordinates
    dataRowIndex: number; // 0-based index in the full dataset
    dataColumnName: string; // Key of the column

    // Grid coordinates (Visible window relative? Or just generic grid coords?)
    // Request: "visible position in the grid of the active cell (by grid row and column name)"
    // "Grid Row" usually means 0..N relative to the viewport? Or 0..N in the table?
    // "visible position... by grid row" implies 0-based index in the CURRENT VIEWPORT.
    viewportRowIndex: number | null; // 0-based index in the rendered window, null if not visible
    viewportColumnName: string; // Same as dataColumnName usually
}
