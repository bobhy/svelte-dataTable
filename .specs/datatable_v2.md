# datatable v2

## Paginated datasource
The DataTable component invokes the datasource callback to fetch extra data to reduce data  source overhead.  It also caches previously fetched data to when it is no longer visible in case the user scrolls back to make the cached data visible again.
It uses 2 hueristics to limit the amount of cached data.
- fetch-ahead hueristic -- when it needs to fetch more data, datatable asks for twice as many rows as it needs to fill in the rest of the datatable (from visible row of the active location down to end of data grid) and caches the extra.  So if datatable is 10 rows and user did full page down, datatable would request 20 rows.  But if datatable is doing a client-side filter and has filled 5 rows (with filtered data), it would request only 10 more rows.  
- limiting hueristic -- when data datatable is about to fetch more data, it will throw away cached rows that are more than 10 screens away from the current location.
- add unit tests to verify the amount of cached data complies with the hueristics when the datagrid is scrolled by half-grids and several grids, both forward and backward.
Add a unit tests to correct operation when the data source does not have as many rows as the data table was requesting.  

## New sort
Rather than allowing only sort by one column at a time, new datatable sort operation allows user to select any or all of the columns that are configured as sortable.  
Add a  table configuration property to specify the inital sort list of columns (default, empty list).

When user clicks on any sortable column header, datatable will expose a sort selection form. the form looks like:
```
Sort <drop down: uparrow - ascending, downarrow -descending> by: <drop down of sortable columns, including "none">  
Then <drop down: uparrow - ascending, downarrow -descending> by: <drop down of sortable columns, including "none", but excluding the previous chosen column>  
Then <drop down: uparrow - ascending, downarrow -descending> by: <drop down of sortable columns, including "none", but excluding the previous 2 chosen columns>  
... repeat for all sortable columns

<cancel> <ok>
```
If the user confirms the sort, the column headers in the table will show the new sort order, showing a small number 1,2,3 followed by the sort direction arrow
And the datatable will do a full requery and re-render with the new sort order.

- unit tests verify correct operation when sort requested on none, one, two, and three columns in a selection of ascending and descending. Unit tests should use a dummy data source that returns a known data in each row and column whose contents can be used to verify the correct cell is populated with the expected data.  Dummy data set can be configured to provide as many or as few rows and columns as needed for the particular test scenario.

## table scrolling behavior
the datagrid tries to minimize scrolling, to avoid confusing the user.

### pageup/pagedown rules
When the user hits page down, the active data row will move by a full visible grid.  E.g if the visible grid is 10 rows high and the current data row is 2, then the updated data row becomes 12.  However the visible row in the grid does not change.  The *data* in that visible row changes.  However, if the user hits page down and the data source returns fewer rows than requested (which indicates end of the data source), then the active row will be displayed at the bottom of the grid.  Likewise, if user hits page up and data source indicates it's at top of data, the grid will be displayed with active row at the top of the grid.

### up/down arrow rules
Down arrow rules:
If the active row is not at the bottom of the visual grid when the user hits down arrow, the grid does not scroll.  Instead the active row moves down one and the next row is highlighted. When the active row is at the bottom of the grid, then the grid scrolls one row, but the highlighted row remains at the bottom of the grid.

Up arrow rules:
If the active row is not at the top of the visual grid when the user hits up arrow, the grid does not scroll.  Instead the active row moves up one and the previous row is highlighted. When the active row is at the top of the grid, then the grid scrolls one row, but the highlighted row remains at the top of the grid.
