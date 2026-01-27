# Datatable row editability
DataTable supports CRUD for individual rows, using a form based on the underlying model.
This editability is optional, it is enabled by setting the `isEditable` property of the DataTable to `true`, with a default value of `false`.

When enabled, the user can edit a row by double clicking on it, or by pressing the `Enter` key on a row.

When the user doubleclicks or hits 'enter' on a row:
1. A form pops up which is populated with the data from the row.  The form also has a "cancel", "delete", "update" and "save as new record" buttons, and a field at the bottom which displays form level error messages.
2. The individual data fields of the form each have an error message field for displaying field level data validation errors.
3. The order and labels for the data fields in form refer back to the column definitions for name of the field in the model and label in the form.
4. When the one of the action buttons, the form invokes a service of the model to update the database and, if this succeeds, also updates the table row cache and the visible grid (if the row is visible) and the form closes. If the database operations fails, the form displays the text of the error does not update the table data and remains open.
5. When the user hits cancel, the form closes.
6. When user hits delete or update, the current row is deleted or updated in the database.  
7. When the user hits save as new record, the data is written as a new record.  If the db operation succeeds, the table data and visible grid are updated as appropriate and the form closes.
