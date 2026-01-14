# DataTable Best Practices

## Filtering
- **Frontend Only**: Data filtering MUST be implemented in the logic of the frontend application. The database should only handle pagination and sorting. `DataTable` provides bindable props for filter terms (`globalFilter`, `findTerm`) which the parent component can use to filter data within the `dataSource` implementation.
