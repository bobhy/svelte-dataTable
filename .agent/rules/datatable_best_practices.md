# DataTable Best Practices

## Filtering
- **Frontend Only**: Data filtering MUST be implemented in the logic of the frontend application. The database should only handle pagination and sorting. `DataTable` provides bindable props for filter terms (`globalFilter`, `findTerm`) which the parent component can use to filter data within the `dataSource` implementation.

## Documentation & Constants
- **Single Source of Truth**: All external interfaces (props, configs) MUST use a centralized constant for default values.
    - Constants should be named `DEFAULT_<INTERFACE_NAME_IN_CAPS>`.
    - Interfaces should use these constants to merge defaults at runtime.
- **JSDoc/TypeDoc**:
    - All external interfaces and public properties MUST have descriptive JSDoc/TypeDoc comments.
    - Optional fields MUST include their default value in the documentation using the `{@link ...}` tag to reference the corresponding default constant (e.g., `Default: {@link DEFAULT_DATA_TABLE_CONFIG.isFilterable}`).
