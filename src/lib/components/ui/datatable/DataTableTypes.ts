export interface DataTableColumn {
    name: string;
    title?: string;
    isSortable?: boolean;
    wrappable?: 'none' | 'word' | 'hard'; // default 'none'
    maxLines?: number; // default 1
    justify?: 'left' | 'center' | 'right'; // default 'left'
    maxWidth?: number; // characters
    formatter?: (value: any) => string;
}

export interface DataTableConfig {
    name: string; // ID for callbacks
    keyColumn: string;
    title?: string;
    maxVisibleRows?: number;
    isFilterable?: boolean; // Default false
    isFindable?: boolean; // Default false
    isEditable?: boolean; // Default false
    columns: DataTableColumn[];
}

// Data Source Callback Types
export interface SortKey {
    key: string;
    direction: 'asc' | 'desc';
}

export type DataSourceCallback = (
    columnKeys: string[],
    startRow: number,
    numRows: number,
    sortKeys: SortKey[]
) => Promise<any[]>; // Returns array of row objects

// Edit Callback Types
export interface DataEditCallbackResult {
    validationFailures: { columnKey: string; message: string }[];
    dbStatus: string | null;
}

export type DataEditCallback = (
    beforeData: any[],
    afterData: any[]
) => Promise<DataEditCallbackResult>;

export type RowAction = 'update' | 'create' | 'delete';
export type RowEditResult = boolean | { error: string };

export type RowEditCallback = (
    action: RowAction,
    row: any
) => Promise<RowEditResult>;

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
    onEdit?: DataEditCallback;
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
